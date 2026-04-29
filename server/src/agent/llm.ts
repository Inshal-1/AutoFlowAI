/**
 * LLM provider abstraction for the AutoFlow server agent loop.
 *
 * Implements support for:
 *  - OpenAI, Groq, OpenRouter, Gemini (via OpenAI-compatible API)
 *  - AWS Bedrock (Claude/Llama) with exponential backoff retries
 *
 * This version supports Model+Key Round Robin Load Balancing:
 * - Cycles through multiple API keys for every request to maximize RPM.
 * - Automatically fails over to next models in the priority list if one is unavailable.
 * - Filters out blacklisted combinations (models not available for specific keys).
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "../env.js";
import { db } from "../db.js";
import { llmModelStatus } from "../schema.js";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// ─── Types ──────────────────────────────────────────────────────

export interface LLMConfig {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  userId?: string;
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
4. SCREEN_CONTEXT -- JSON array of interactive UI elements with coordinates and states.
5. SCREENSHOT -- an image of the current screen.
6. SCREEN_CHANGE -- what changed since your last action.
7. VISION_FALLBACK -- present when the accessibility tree is empty.

Previous conversation turns contain your earlier observations and actions.

You must output ONLY a valid JSON object with your next action.

═══════════════════════════════════════════
THINKING & PLANNING
═══════════════════════════════════════════
Before each action, include a "think" field with your reasoning.

Example:
{"think": "I see the Settings app is open. I need to scroll down.", "action": "swipe", "direction": "up", "reason": "Scroll down"}

═══════════════════════════════════════════
AVAILABLE ACTIONS (23 total)
═══════════════════════════════════════════
Navigation:
  {"action": "tap", "coordinates": [x, y], "reason": "..."}
  {"action": "longpress", "coordinates": [x, y], "reason": "..."}
  {"action": "scroll", "direction": "up|down|left|right", "reason": "..."}
  {"action": "enter", "reason": "..."}
  {"action": "back", "reason": "..."}
  {"action": "home", "reason": "..."}

Text Input:
  {"action": "type", "coordinates": [x, y], "text": "...", "reason": "..."}
  {"action": "clear", "reason": "..."}

App Control:
  {"action": "launch", "package": "com.whatsapp", "reason": "..."}
  {"action": "open_url", "url": "...", "reason": "..."}
  {"action": "switch_app", "package": "...", "reason": "..."}
  {"action": "open_settings", "setting": "wifi|bluetooth|display|sound|battery|location|apps|date|accessibility|developer|dnd|network|storage|security", "reason": "..."}

Data:
  {"action": "clipboard_get", "reason": "..."}
  {"action": "clipboard_set", "text": "...", "reason": "..."}
  {"action": "paste", "coordinates": [x, y], "reason": "..."}

Intent:
  {"action": "intent", "intentAction": "android.intent.action.VIEW", "uri": "...", "reason": "..."}

System:
  {"action": "wait", "reason": "..."}
  {"action": "done", "reason": "Goal achieved"}

Multi-Step Skills:
  {"action": "read_screen", "reason": "..."}
  {"action": "submit_message", "reason": "..."}
  {"action": "copy_visible_text", "reason": "..."}
  {"action": "wait_for_content", "reason": "..."}
  {"action": "find_and_tap", "query": "...", "reason": "..."}
  {"action": "compose_email", "query": "...", "text": "...", "reason": "..."}

═══════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════
1. Use coordinates from SCREEN_CONTEXT "center" field.
2. If enabled: false, DO NOT tap.
3. If SCREEN_CHANGE is "NOT changed", change strategy.
4. Use intents for messaging/navigation when possible to save steps.
5. Say "done" immediately when goal is reached.`;
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

export const GEMINI_FAILOVER_LIST = [
	'gemini-3.1-flash-lite-preview',
	'gemini-3-flash-preview',
	'gemini-2.5-pro',
	'gemini-2.5-flash',
	'gemini-2.5-flash-lite'
];

function getDefaultModel(provider: string): string {
  return DEFAULT_MODELS[provider] ?? "gpt-4o";
}

/**
 * Manages cycling through combinations of [Model + Key].
 */
class ModelKeyRotator {
  public combinations: Array<{ model: string; key: string }>;
  private currentIndex: number = 0;

  constructor(models: string[], keys: string[]) {
    this.combinations = [];
    for (const m of models) {
      for (const k of keys) {
        this.combinations.push({ model: m, key: k });
      }
    }
  }

  getNext(): { model: string; key: string } | null {
    if (this.combinations.length === 0) return null;
    const pair = this.combinations[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.combinations.length;
    return pair;
  }

  get count(): number {
    return this.combinations.length;
  }
}

class BedrockProvider implements LLMProvider {
  private client: BedrockRuntimeClient | null = null;
  private model: string;
  private keys: string[];
  private currentKeyIndex: number = 0;

  constructor(model: string, apiKeyString?: string) {
    this.keys = (apiKeyString || "").split(/[;,\n]/).map(k => k.trim()).filter(Boolean);
    if (this.keys.length === 0 && apiKeyString) this.keys = [apiKeyString.trim()];
    this.model = model;
  }

  private initClient(apiKey: string) {
    let credentials = undefined;
    let region = env.AWS_REGION;
    if (apiKey === "ENVIRONMENT") {
        if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
            credentials = { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY };
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

    const maxTries = Math.max(1, this.keys.length);
    for (let i = 0; i < maxTries; i++) {
        const apiKey = this.keys[this.currentKeyIndex];
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        this.initClient(apiKey);

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
          if (error.name === "ThrottlingException" || error.$metadata?.httpStatusCode === 429) {
              console.warn(`[Bedrock] Throttled. Rotating key...`);
              continue;
          }
          throw err;
        }
    }
    throw new Error("Bedrock: All keys throttled.");
  }
}

class OpenAICompatibleProvider implements LLMProvider {
  private rotator: ModelKeyRotator;
  private baseUrl: string;
  private providerName: string;
  private userId?: string;

  constructor(config: LLMConfig, validCombinations: Array<{ model: string; key: string }>) {
    this.providerName = config.provider.toLowerCase().trim();
    this.baseUrl = config.baseUrl || BASE_URLS[this.providerName] || BASE_URLS.openai;
    this.rotator = new ModelKeyRotator([], []);
    this.rotator.combinations = validCombinations;
    this.userId = config.userId;
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

    const maxTries = Math.min(10, this.rotator.count);
    for (let i = 0; i < maxTries; i++) {
      const pair = this.rotator.getNext();
      if (!pair) break;

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pair.key}`,
          },
          body: JSON.stringify({
            model: pair.model,
            messages,
            temperature: 0.2,
            max_tokens: 1024,
            response_format: { type: "json_object" },
          }),
          signal,
        });

        if (response.status === 429 || response.status === 503) {
          console.warn(`[${this.providerName}] Key limit or high demand reached (${response.status}). Rotating...`);
          continue;
        }

        if (response.status === 404 || response.status === 403) {
            console.error(`[${this.providerName}] Model ${pair.model} unavailable for key. Blacklisting...`);
            if (this.userId) {
                const keyHash = crypto.createHash('sha256').update(pair.key).digest('hex');
                db.update(llmModelStatus)
                    .set({ isAvailable: false, updatedAt: new Date() })
                    .where(and(
                        eq(llmModelStatus.userId, this.userId),
                        eq(llmModelStatus.keyHash, keyHash),
                        eq(llmModelStatus.modelId, pair.model)
                    )).catch(() => {});
            }
            continue;
        }

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`LLM API error (${response.status}): ${error}`);
        }

        const data = (await response.json()) as any;
        return data.choices[0]?.message?.content ?? "";
      } catch (err) {
        if (err instanceof Error && err.message.includes("429")) continue;
        throw err;
      }
    }
    throw new Error(`${this.providerName}: All available Model+Key combinations reached limits or failed.`);
  }
}

export async function getLlmProvider(config: LLMConfig): Promise<LLMProvider> {
  const provider = config.provider.toLowerCase().trim();

  if (provider === "bedrock") {
    return new BedrockProvider(config.model || getDefaultModel("bedrock"), config.apiKey);
  }

  let modelList = [config.model || getDefaultModel(provider)];
  if (provider === "gemini") {
      modelList = GEMINI_FAILOVER_LIST;
  }

  const keys = config.apiKey.split(/[;,\n]/).map(k => k.trim()).filter(Boolean);
  const validCombinations: Array<{ model: string; key: string }> = [];
  
  if (config.userId) {
      const statuses = await db
        .select()
        .from(llmModelStatus)
        .where(and(eq(llmModelStatus.userId, config.userId), eq(llmModelStatus.isAvailable, false)));
      
      const blacklist = new Set(statuses.map(s => `${s.keyHash}:${s.modelId}`));

      for (const m of modelList) {
          for (const k of keys) {
              const hash = crypto.createHash('sha256').update(k).digest('hex');
              if (!blacklist.has(`${hash}:${m}`)) {
                  validCombinations.push({ model: m, key: k });
              }
          }
      }
  } else {
      for (const m of modelList) {
          for (const k of keys) {
              validCombinations.push({ model: m, key: k });
          }
      }
  }

  if (validCombinations.length === 0) {
      throw new Error(`No valid Model+Key combinations found for ${provider}. Check your blacklist.`);
  }

  return new OpenAICompatibleProvider(config, validCombinations);
}

// ─── JSON Response Parsing ──────────────────────────────────────

function sanitizeJsonText(raw: string): string {
  return raw.replace(/\n/g, " ").replace(/\r/g, " ");
}

export function parseJsonResponse(raw: string): Record<string, unknown> | null {
  // 1. Clean markdown artifacts
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?/, "").replace(/```$/, "").trim();
  }

  const parse = (text: string): Record<string, any> | null => {
    try {
      let data = JSON.parse(text);
      // Handle array wrap: [ { "action": ... } ]
      if (Array.isArray(data) && data.length > 0) data = data[0];
      if (typeof data !== "object" || data === null) return null;

      // Handle common field aliases from creative LLMs
      if (!data.coordinates && data.action_location) data.coordinates = data.action_location;
      if (!data.coordinates && data.point) data.coordinates = data.point;
      if (!data.reason && data.thought) data.reason = data.thought;

      return data;
    } catch {
      return null;
    }
  };

  // Try direct parse
  let result = parse(cleaned);
  if (result) return result;

  // Try sanitized parse
  result = parse(sanitizeJsonText(cleaned));
  if (result) return result;

  // Try regex extraction for {...} or [...]
  const match = cleaned.match(/(\{|\[)[\s\S]*(\}|\])/);
  if (match) {
    result = parse(sanitizeJsonText(match[0]));
    if (result) return result;
  }

  return null;
}
