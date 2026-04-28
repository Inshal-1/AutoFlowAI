# AutoFlow Project Overview

AutoFlow is an autonomous AI agent that controls Android devices through a **Perception → Reasoning → Action** loop. It interprets the Android accessibility tree to operate devices intelligently without requiring specific app APIs.

## Architecture

The project is a monorepo managed with **Bun**:

- **Agent Core (`src/`)**: The main TypeScript logic for the agent loop, LLM integration, and ADB interactions.
  - `kernel.ts`: Main entry point for the agent.
  - `llm-providers.ts`: Integration with Groq, OpenAI, Ollama, Bedrock, etc., via Vercel AI SDK.
  - `actions.ts`: ADB-based actions (tap, type, swipe, etc.).
  - `skills.ts`: Multi-step high-level actions (submit_message, read_screen, etc.).
  - `sanitizer.ts`: Processes the accessibility XML into a compact format for the LLM.
- **Backend (`server/`)**: Hono-based server that manages device connections and session data.
  - Uses WebSockets for real-time communication between the dashboard and the agent/device.
  - Integrates with `better-auth` for authentication.
- **Web Dashboard (`web/`)**: SvelteKit application for monitoring agents, managing devices, and configuring goals.
  - Uses TailwindCSS for styling and Drizzle ORM for database access.
- **Android Companion (`android/`)**: Kotlin-based app that provides accessibility and screen capture permissions to the agent.
- **Shared Package (`packages/shared/`)**: Common types and protocols used across the agent, server, and web.

## Key Technologies

- **Runtime**: Bun
- **Languages**: TypeScript, Kotlin, SQL (PostgreSQL)
- **Frontend**: SvelteKit, TailwindCSS
- **Backend**: Hono, Bun.serve (WebSockets)
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **AI**: Vercel AI SDK (OpenAI, Groq, Ollama, etc.)
- **Device Control**: ADB (Android Debug Bridge)

## Building and Running

### Prerequisites
- [Bun](https://bun.sh/) installed.
- Android device with ADB enabled and connected.
- PostgreSQL database (e.g., [Neon](https://neon.tech)).

### Installation
```bash
bun install
```

### Database Setup
Copy `.env.example` to `.env` and `web/.env.example` to `web/.env`, then set your `DATABASE_URL`.
```bash
# Push schema to database
bun run db:push
```

### Starting the Dashboard and Server
```bash
bun run dev
```
Visit `http://localhost:5173` to access the dashboard.

### Running the Agent
The agent can be run in several modes:

**Interactive Mode:**
```bash
bun run src/kernel.ts
```

**Workflow Mode (Multi-step AI):**
```bash
bun run src/kernel.ts --workflow examples/workflows/productivity/morning-briefing.json
```

**Flow Mode (Deterministic YAML):**
```bash
bun run src/kernel.ts --flow examples/flows/toggle-wifi.yaml
```

### Android App
Build and install the companion app:
```bash
cd android
./gradlew installDebug
```

## Development Conventions

- **Surgical Actions**: Prefer adding high-level "skills" in `src/skills.ts` for complex multi-step UI interactions to reduce LLM token usage and improve reliability.
- **Type Safety**: Use the shared types in `packages/shared/src/types.ts` for any communication between components.
- **ADB Dependency**: Most agent actions rely on `runAdbCommand` in `src/actions.ts`. Ensure your environment has `adb` in the PATH.
- **Logging**: The agent logs sessions to the `logs/` directory using `SessionLogger`.
- **Environment Variables**: Managed via `.env` files. Key variables include `DATABASE_URL`, `LLM_PROVIDER`, and provider-specific API keys.

## Important Directories

- `src/`: Core agent logic and loop.
- `server/src/`: Backend API and WebSocket handlers.
- `web/src/`: SvelteKit frontend source.
- `android/app/src/main/`: Android companion app source.
- `examples/`: Sample workflows (JSON) and flows (YAML).
- `docs/`: Additional documentation and plans.
