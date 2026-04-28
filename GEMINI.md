# AutoFlow AI Project Overview

AutoFlow is an autonomous AI agent ecosystem designed to control Android devices through a **Perception → Reasoning → Action** loop. By interpreting the Android accessibility tree and executing actions via ADB, it operates devices intelligently without requiring third-party APIs.

## 🚀 Quick Links
- **One-Click EC2 Setup:** `docs/deploy_ec2.sh`
- **Master Guide:** `docs/FULL_GUIDE.md`
- **EC2 Manual Guide:** `docs/EC2_DEPLOYMENT.md`
- **AWS App Runner/RDS Guide:** `docs/AWS_DEPLOYMENT.md`

## 🏗️ Architecture

AutoFlow is a **Bun-managed monorepo**:

- **Agent Core (`src/`)**: The TypeScript "Kernel" that handles the agent loop, LLM reasoning, and ADB interactions.
- **Backend (`server/`)**: A Hono-based server managing WebSocket connections between the dashboard and devices.
- **Web Dashboard (`web/`)**: A SvelteKit application for real-time device monitoring and goal management.
- **Android Companion (`android/`)**: A Kotlin-based app providing necessary permissions to the agent.
- **Shared Package (`packages/shared/`)**: Shared types and communication protocols.

## 🛠️ Technology Stack

- **Runtime:** Bun (primary), Node.js (for PM2)
- **Frontend:** SvelteKit, TailwindCSS
- **Backend:** Hono, Bun.serve (WebSockets)
- **Database:** PostgreSQL (RDS or local), Drizzle ORM
- **Auth:** Better-Auth (Modular @better-auth/api-key)
- **AI:** Vercel AI SDK (Groq, OpenAI, AWS Bedrock)
- **Deployment:** Nginx (Reverse Proxy), PM2 (Process Management)

## 📦 Deployment & Running

### Automated Deployment (Ubuntu 24.04 EC2)
We recommend an **m7i-flex.large** instance for optimal build performance.
```bash
git clone https://github.com/Inshal-1/AutoFlowAI.git AutoFlow
cd AutoFlow
chmod +x docs/deploy_ec2.sh
./docs/deploy_ec2.sh
```

### Key Commands
- **Install:** `bun install`
- **Migrate DB:** `bun run db:push`
- **Build Web:** `bun run build`
- **Start Agent:** `bun run src/kernel.ts`
- **Monitor Logs:** `pm2 logs`

## 📝 Development Conventions

- **Modular Plugins:** Always use `@better-auth/api-key` for authentication plugins.
- **Environment:** Secrets and URLs must be synchronized across `server/.env` and `web/.env`.
- **SvelteKit Origin:** In production, the `ORIGIN` environment variable is required to bypass CSRF protection.
- **WebSocket Pathing:** Nginx routes all backend traffic through the `/ws` path for standardized socket handling.

## 📂 Important Directories

- `src/`: Core agent logic.
- `server/src/`: Backend API and WebSocket sessions.
- `web/src/`: Dashboard source code.
- `android/`: Companion app source.
- `docs/`: Deployment scripts and comprehensive guides.
- `examples/`: Sample AI Workflows (JSON) and Deterministic Flows (YAML).
