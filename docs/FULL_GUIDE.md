# AutoFlow AI: The Comprehensive Guide

AutoFlow (formerly PocketAgent) is an open-source autonomous AI agent designed to control Android phones. This guide explains the core concepts, architecture, and operational workflows of the project.

---

## 1. What is AutoFlow?

AutoFlow is an agentic system that acts as a "human in the machine." Instead of using restricted APIs (which many apps don't have), it uses the **Android Accessibility Tree** to see the screen and **ADB (Android Debug Bridge)** to interact with it.

---

## 2. Technology Stack

- **Runtime:** [Bun](https://bun.sh/) — Primary runtime.
- **Process Management:** [PM2](https://pm2.io/) — Requires **Node.js** to be installed.
- **Backend:** [Hono](https://hono.dev/) — Port 4000.
- **Frontend:** [SvelteKit](https://kit.svelte.dev/) — Port 3000.
- **Database:** [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/).
- **Auth:** [Better-Auth](https://www.better-auth.com/) — Simplified with a manual API Key bypass for stability.

---

## 3. Project Architecture

The project is a **Monorepo**:
- `/src`: The **Kernel** (the brain of the agent).
- `/server`: The **API Server**.
- `/web`: The **Dashboard** UI.
- `/android`: The **Companion App**.

---

## 4. Production Deployment (EC2)

### Automated Setup
The recommended way to deploy is using the provided script on a fresh **Ubuntu 24.04** instance (preferably **m7i-flex.large**):

```bash
git clone https://github.com/Inshal-1/AutoFlowAI.git AutoFlow
cd AutoFlow
chmod +x docs/deploy_ec2.sh
./docs/deploy_ec2.sh
```

### Manual Configuration Highlights
- **ORIGIN:** SvelteKit requires `ORIGIN=http://your-ip` to allow form submissions (Login/Signup).
- **Reverse Proxy:** Nginx must pass `X-Forwarded-Proto` and `Host` headers to prevent 403 Forbidden errors.
- **API Keys:** We use a custom bypass logic that writes directly to the `api_key` table, avoiding `better-auth` plugin schema conflicts.

---

## 5. Common Troubleshooting

### "403 Forbidden" on Login
This is CSRF protection. Ensure your `web/.env` has `ORIGIN=http://your-ip` and your Nginx config has the correct headers.

### "500 Internal Error" on API Keys
We solved this by:
1.  Renaming the table to `api_key`.
2.  Adding `configId` and `referenceId` fields.
3.  Bypassing the strict plugin and inserting records directly into the DB.

### Database Sync
If you change the schema, always run:
```bash
bun run db:push
```

---

## 6. Security
- Keep Port 5432 (Postgres) restricted.
- Use `sudo certbot --nginx` to enable HTTPS in production.
