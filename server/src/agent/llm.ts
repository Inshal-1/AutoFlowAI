/**
 * LLM provider abstraction for the AutoFlow server agent loop.
 *
 * Implements support for:
 *  - OpenAI, Groq, OpenRouter, Gemini (via OpenAI-compatible API)
 *  - AWS Bedrock (Claude/Llama) with exponential backoff retries
 *
 * All providers support Multi-Key Rotation:
 * Pass multiple keys separated by semicolons (e.g. "key1;key2;key3").
 * If a rate limit (429) or ThrottlingException occurs, the provider
 * automatically cycles to the next key and retries.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "../env.js";

// ─── Types ──────────────────────────────────────────────────────

export interface LLMConfig {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface LLMProvider {
  getAction(
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    signal?: AbortSignal
  ): Promise<string>;
}

// ─── System Prompt ──────────────────────────────────────────────

/**
 * Returns the system prompt that defines all 22+ actions and rules
 * for the Android driver agent.
 */
export function getSystemPrompt(): string {
  return `You are an Android Driver Agent. Your job is to achieve the user's goal by navigating the Android UI.

You will receive:
1. GOAL -- the user's task.
2. FOREGROUND_APP -- the currently active app package and activity.
3. LAST_ACTION_RESULT -- the outcome of your previous action.
4. SCREEN_CONTEXT -- JSON array of interactive UI elements.
5. SCREENSHOT -- an image of the current screen.
6. SCREEN_CHANGE -- what changed since your last action.

Previous conversation turns contain your earlier observations and actions.

You must output ONLY a valid JSON object with your next action.

═══════════════════════════════════════════
THINKING & PLANNING
═══════════════════════════════════════════
Before each action, include a "think" field with your reasoning.

Example:
{"think": "I see the Settings app is open. I need to scroll down.", "action": "swipe", "direction": "up", "reason": "Scroll down"}

═══════════════════════════════════════════
AVAILABLE ACTIONS
═══════════════════════════════════════════
  {"action": "tap", "coordinates": [x, y], "reason": "..."}
  {"action": "type", "coordinates": [x, y], "text": "...", "reason": "..."}
  {"action": "scroll", "direction": "up|down|left|right", "reason": "..."}
  {"action": "launch", "package": "com.package", "reason": "..."}
  {"action": "done", "reason": "Goal achieved"}
  (See full action list in docs)`;
}

/**
 * Stage 2: Classifier Prompt
 */
export function getClassifierPrompt(
  goal: string,
  capabilitySummary: string
): { system: string; user: string } {
  const system = `You are a goal classifier for an Android automation agent.
Respond with ONLY a valid JSON object.
Option A — INTENT: {"type":"intent", ...}
Option B — UI: {"type":"ui", "app":"...", "subGoal":"..."}`;

  const user = `GOAL: ${goal}\nCAPABILITIES:\n${capabilitySummary}`;
  return { system, user };
}

/**
 * Stage 3: Dynamic prompt builder
 */
export function buildDynamicPrompt(options: {
  hasEditableFields: boolean;
  hasScrollable: boolean;
  foregroundApp?: string;
  appHints: string;
  isStuck: boolean;
}): string {
  return `You are an Android UI Agent. Achieve the sub-goal by interacting with the current screen.
Output ONLY a valid JSON object.`;
}

// ─── Provider Implementation ────────────────────────────────────

const BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
};

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  groq: "llama-3.3-70b-versatile",
  openrouter: "google/gemini-2.0-flash-001",
  gemini: "gemini-2.0-flash",
  bedrock: "anthropic.claude-3-5-sonnet-20240620-v1:0",
};

function getDefaultModel(provider: string): string {
  return DEFAULT_MODELS[provider] ?? "gpt-4o";
}

/**
 * Manages cycling through multiple API keys.
 */
class KeyRotator {
  private keys: string[];
  private currentIndex: number = 0;

  constructor(keyString: string) {
    this.keys = keyString
      .split(/[;,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    
    if (this.keys.length === 0 && keyString.trim().length > 0) {
      this.keys = [keyString.trim()];
    }
  }

  getCurrentKey(): string {
    return this.keys[this.currentIndex] || "";
  }

  next(): boolean {
    if (this.currentIndex < this.keys.length - 1) {
      this.currentIndex++;
      return true;
    }
    return false;
  }

  get count(): number {
    return this.keys.length;
  }
}

class BedrockProvider implements LLMProvider {
  private client: BedrockRuntimeClient | null = null;
  private model: string;
  private rotator: KeyRotator;

  constructor(model: string, apiKeyString?: string) {
    this.rotator = new KeyRotator(apiKeyString || "");
    this.model = model;
    this.initClient();
  }

  private initClient() {
    let credentials = undefined;
    let region = env.AWS_REGION;
    const apiKey = this.rotator.getCurrentKey();

    if (apiKey === "ENVIRONMENT") {
        if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
            credentials = {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            };
        }
    } else if (apiKey.includes(":")) {
      const parts = apiKey.split(":");
      if (parts.length >= 2) {
        credentials = { accessKeyId: parts[0], secretAccessKey: parts[1] };
        if (parts[2]) region = parts[2];
      }
    }

    this.client = new BedrockRuntimeClient({ region, credentials });
  }

  async getAction(
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    signal?: AbortSignal
  ): Promise<string> {
    const isAnthropic = this.model.includes("anthropic");
    const isMeta = this.model.includes("meta");

    let body: any;
    if (isAnthropic) {
      const content: any[] = [{ type: "text", text: userPrompt }];
      if (imageBase64) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/png", data: imageBase64 },
        });
      }
      body = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content }],
        temperature: 0.2,
      };
    } else if (isMeta) {
      body = {
        prompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${userPrompt}\n\nRespond with ONLY a valid JSON object.<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
        max_gen_len: 1024,
        temperature: 0.2,
      };
    } else {
      body = {
        inputText: `${systemPrompt}\n\n${userPrompt}\n\nRespond with ONLY a valid JSON object.`,
        textGenerationConfig: { maxTokenCount: 1024, temperature: 0.2 },
      };
    }

    const maxRetriesPerKey = 2;
    while (true) {
      let attempt = 0;
      while (attempt <= maxRetriesPerKey) {
        try {
          const command = new InvokeModelCommand({
            modelId: this.model,
            body: new TextEncoder().encode(JSON.stringify(body)),
            contentType: "application/json",
            accept: "application/json",
          });

          const response = await this.client!.send(command, { abortSignal: signal });
          const responseBody = JSON.parse(new TextDecoder().decode(response.body));

          if (isAnthropic) return responseBody.content[0].text;
          if (isMeta) return responseBody.generation;
          return responseBody.results[0].outputText;
        } catch (err) {
          const error = err as any;
          const isThrottling = error.name === "ThrottlingException" || error.$metadata?.httpStatusCode === 429;

          if (isThrottling) {
            if (attempt < maxRetriesPerKey) {
              attempt++;
              const delay = Math.pow(2, attempt) * 1000;
              console.warn(`[Bedrock] Throttled. Retrying in ${delay}ms...`);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            } else if (this.rotator.next()) {
              console.warn(`[Bedrock] Key rate limited. Cycling keys...`);
              this.initClient();
              break;
            }
          }
          throw err;
        }
      }
      if (attempt > maxRetriesPerKey && !this.rotator.next()) {
         throw new Error("Bedrock max retries and all keys exhausted");
      }
    }
  }
}

class OpenAICompatibleProvider implements LLMProvider {
  private rotator: KeyRotator;
  private baseUrl: string;
  private model: string;
  private providerName: string;

  constructor(config: LLMConfig) {
    this.providerName = config.provider.toLowerCase().trim();
    this.baseUrl = config.baseUrl || BASE_URLS[this.providerName] || BASE_URLS.openai;
    this.model = config.model || getDefaultModel(this.providerName);
    this.rotator = new KeyRotator(config.apiKey);
  }

  async getAction(
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    signal?: AbortSignal
  ): Promise<string> {
    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}`, detail: "low" } },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    while (true) {
      const apiKey = this.rotator.getCurrentKey();
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: 0.2,
            max_tokens: 1024,
            response_format: { type: "json_object" },
          }),
          signal,
        });

        if (response.status === 429 && this.rotator.next()) {
          console.warn(`[${this.providerName}] Rate limited (429). Cycling keys...`);
          continue;
        }

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`LLM API error (${response.status}): ${error}`);
        }

        const data = (await response.json()) as any;
        return data.choices[0]?.message?.content ?? "";
      } catch (err) {
        if (err instanceof Error && err.message.includes("429") && this.rotator.next()) {
           continue;
        }
        throw err;
      }
    }
  }
}

export function getLlmProvider(config: LLMConfig): LLMProvider {
  const provider = config.provider.toLowerCase().trim();
  if (provider === "bedrock") {
    return new BedrockProvider(config.model || getDefaultModel("bedrock"), config.apiKey);
  }
  return new OpenAICompatibleProvider(config);
}

// ─── JSON Response Parsing ──────────────────────────────────────

function sanitizeJsonText(raw: string): string {
  return raw.replace(/\n/g, " ").replace(/\r/g, " ");
}

export function parseJsonResponse(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw); } catch {}
  try { return JSON.parse(sanitizeJsonText(raw)); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(sanitizeJsonText(match[0])); } catch {}
  }
  return null;
}
