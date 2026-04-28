# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project Structure

This is a **monorepo** containing three main components:

1.  **Core Agent (`src/`)**: The AutoFlow AI agent that runs via CLI on your machine.
2.  **Server (`server/`)**: A Hono/Bun backend that handles authentication, device coordination, and state persistence.
3.  **Web Dashboard (`web/`)**: A SvelteKit frontend for managing agents and viewing streams.

---

## 1. Core Agent (Client)

**Location:** Project Root (`src/`)
**Runtime:** Bun (TypeScript)

### Overview
AutoFlow controls Android devices through the Accessibility API. It runs a Perception → Reasoning → Action loop: captures the screen state via `uiautomator dump`, sends it to an LLM for decision-making, and executes the chosen action via ADB.

### Commands
Run from project root:
```bash
bun install                    # Install dependencies
bun run src/kernel.ts          # Start the agent (interactive)
bun run build:agent            # Compile to dist/
bun run typecheck              # Type-check only
```

### Architecture
- **kernel.ts** — Entry point and main agent loop. Reads goal from stdin, runs up to MAX_STEPS iterations.
- **actions.ts** — 15 action implementations (tap, type, enter, swipe, etc.) wrapping ADB commands.
- **llm-providers.ts** — LLM abstraction (OpenAI, Groq, Ollama, Bedrock, OpenRouter). Contains the `SYSTEM_PROMPT`.
- **sanitizer.ts** — Parses Android Accessibility XML into `UIElement[]`. Handles sensitive data redaction.
- **config.ts** — Configuration loader using `process.env`.
- **constants.ts** — ADB keycodes, swipe coordinates, and default values.

### Key Patterns
- **Provider Factory:** `getLlmProvider()` returns the appropriate `LLMProvider`.
- **Screen State Diffing:** Hash-based comparison (id + text + center + state) to detect stuck loops.
- **Vision Fallback:** When the accessibility tree is empty, a screenshot is captured and sent to the LLM.
- **LLM Response Parsing:** Handles both clean JSON and markdown-wrapped code blocks.
- **Native .env**: Bun loads `.env` files natively; no `dotenv` package needed.

---

## 2. Server

**Location:** `server/`
**Runtime:** Bun + Hono

### Overview
The API server managing device sessions, user authentication (`better-auth`), and database connections (`postgres`, `drizzle`).

### Commands
Run from project root or `server/` directory:
```bash
bun run --cwd server dev       # Start development server
bun run --cwd server start     # Start production server
```

### Architecture
- **Framework**: Hono (v4.x) running on Bun.
- **Database**: PostgreSQL accessed via Drizzle ORM.
- **WebSockets**:
    - `/ws/device`: Authenticated connection for Android devices.
    - `/ws/dashboard`: Real-time updates for the web dashboard.
- **Authentication**: `better-auth` for user management (email verification disabled for streamlined onboarding).

### Key Patterns
- **WebSocket Upgrade**: Handled in `index.ts` using `Bun.serve`'s `fetch` hook.
- **Route Separation**: REST routes in `src/routes/`, WebSocket handlers in `src/ws/`.
- **Shared Schema**: Database schema defined in `src/schema.ts`.

---

## 3. Web Dashboard

**Location:** `web/`
**Runtime:** SvelteKit (Node adapter or Bun)

### Overview
The user interface for AutoFlow, featuring real-time device streaming, agent configuration, and workflow management.

### Commands
Run from project root or `web/` directory:
```bash
bun run --cwd web dev          # Start development server
bun run --cwd web build        # Build for production
bun run --cwd web db:push      # Push schema changes to database
```

### Architecture
- **Framework**: SvelteKit (Svelte 5).
- **Styling**: Tailwind CSS v4 + Shadcn-Svelte.
- **State**: Svelte 5 Runes ($state, $derived).
- **Database**: Direct DB access in server-side load functions (`+page.server.ts`).

### Key Patterns
- **Layout**: Global layout in `src/routes/+layout.svelte` handles theme and fonts.
- **Components**: UI components in `src/lib/components/ui` (shadcn).
- **Type Safety**: Full TypeScript integration across the full stack.

---

## Shared Guidelines

### Adding a New LLM Provider
1. Implement `LLMProvider` interface in `src/llm-providers.ts`.
2. Add case to `getLlmProvider()` factory.
3. Update `.env.example`.

### Adding a New Action
1. Add to `ActionDecision` interface in `src/actions.ts`.
2. Implement `executeNewAction()` function.
3. Document action in `SYSTEM_PROMPT`.

### Git Conventions
- Do NOT add `Co-Authored-By: Claude` lines to commit messages.
