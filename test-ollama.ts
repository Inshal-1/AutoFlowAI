import OpenAI from "openai";
import { readFileSync } from "fs";

const client = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
});

const imagePath = "/Users/sanju/Downloads/komoot iOS 33.png";
const base64 = readFileSync(imagePath).toString("base64");

console.log("sending image to ollama (gemma3:4b)...\n");

const response = await client.chat.completions.create({
  model: "gemma3:4b",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe what you see in this screenshot. What app is this? What are the key UI elements?" },
        {
          type: "image_url",
          image_url: { url: `data:image/png;base64,${base64}` },
        },
      ],
    },
  ],
});

console.log("model:", response.model);
console.log("tokens:", response.usage);
console.log("\n--- response ---\n");
console.log(response.choices[0].message.content);
