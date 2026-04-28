# AutoFlow AI: The Comprehensive Guide

AutoFlow (formerly PocketAgent) is an open-source autonomous AI agent designed to control Android phones. This guide explains the core concepts, architecture, and operational workflows of the project.

---

## 1. What is AutoFlow?

AutoFlow is an agentic system that acts as a "human in the machine." Instead of using restricted APIs (which many apps don't have), it uses the **Android Accessibility Tree** to see the screen and **ADB (Android Debug Bridge)** to interact with it.

### The Perception-Reasoning-Action Loop:
1.  **Perception:** The agent dumps the UI XML of the current screen. It identifies buttons, text fields, and images.
2.  **Reasoning:** The UI state and the user's goal are sent to an LLM (Claude, GPT, or Groq). The LLM "thinks" about the next step and returns a structured action (e.g., "Tap the Search bar").
3.  **Action:** The agent executes the tap, swipe, or text entry via ADB and waits for the screen to update.

---

## 2. Technology Stack

- **Runtime:** [Bun](https://bun.sh/) — Used for its extreme speed and native support for TypeScript and WebSockets.
- **Backend:** [Hono](https://hono.dev/) — A lightweight web framework running on the server to manage device connections.
- **Frontend:** [SvelteKit](https://kit.svelte.dev/) — The dashboard for real-time monitoring of your agent.
- **Database:** [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/).
- **Auth:** [Better-Auth](https://www.better-auth.com/) — Manages user sessions and API keys.
- **AI Integration:** [Vercel AI SDK](https://sdk.vercel.ai/) — Allows swapping between Groq, OpenAI, and AWS Bedrock easily.

---

## 3. Project Architecture

The project is a **Monorepo**:
- `/src`: The **Kernel** (the brain of the agent). This is what you run to start a task.
- `/server`: The **API Server** that coordinates between your dashboard and your devices.
- `/web`: The **Dashboard** UI.
- `/android`: The **Companion App** that must be installed on the phone to grant accessibility permissions.
- `/packages/shared`: Common types and communication protocols.

---

## 4. Operational Modes

### A. Interactive Mode
You type a goal (e.g., "Order a pepperoni pizza from Domino's"), and the agent figures it out step-by-step.
```bash
bun run src/kernel.ts
```

### B. Workflows (AI-Powered)
JSON files that define complex, multi-app goals. The LLM handles the logic between steps.
```bash
bun run src/kernel.ts --workflow examples/workflows/research/weather-to-whatsapp.json
```

### C. Flows (Deterministic)
YAML files that act like high-speed macros. No AI is used; it just clicks exactly what you tell it to. Ideal for repetitive daily tasks.
```bash
bun run src/kernel.ts --flow examples/flows/toggle-wifi.yaml
```

---

## 5. Deployment Options

### Local (For Testing)
Run everything on your laptop with your phone plugged in via USB.

### EC2 (For 24/7 Monitoring)
Deploy to an AWS instance (like `m7i-flex.large`) to manage your "phone farm" remotely.
- **Script:** Use `docs/deploy_ec2.sh` for an automated setup.
- **Manual:** Follow `docs/EC2_DEPLOYMENT.md`.

### Cloud Native
Deploy to **AWS App Runner** or **ECS** using the Docker instructions in `docs/AWS_DEPLOYMENT.md`.

---

## 6. Common Troubleshooting

### "Bun command not found"
Bun is not in `apt`. Install it via: `curl -fsSL https://bun.sh/install | bash`.

### "TypeError: URL cannot be parsed"
This means your `DATABASE_URL` in `.env` is missing or incorrect. It must start with `postgresql://`.

### "Missing apiKey specifier in better-auth"
We fixed this by modularizing the plugins. Always ensure you run `bun install` after pulling the latest code to get the `@better-auth/api-key` package.

### PM2 Errors
Remember that PM2 requires **Node.js** to be installed on the system, even if you are using Bun for the app logic. Install it with `sudo apt install nodejs npm`.

---

## 7. Security Best Practices
- **VPC Security Groups:** Only open port 80/443 to the public. Keep port 5432 (Postgres) closed or restricted to the server's IP.
- **API Keys:** Never commit your `.env` files to Git.
- **ADB over Network:** If using ADB over WiFi, use a VPN or SSH tunnel to prevent unauthorized access to your phone.
