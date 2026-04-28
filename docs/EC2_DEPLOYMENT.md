# Deploying AutoFlow to AWS EC2

This guide provides a step-by-step walkthrough for deploying the AutoFlow monorepo to an Amazon EC2 instance.

## 1. Instance Selection

For optimal performance, we recommend:
- **Instance Type:** `m7i-flex.large` (2 vCPU, 8 GiB RAM) — **Excellent choice.** This provides plenty of memory for the Bun runtime and SvelteKit build processes.
- **Alternative:** `t3.medium` (2 vCPU, 4 GiB RAM) — Minimum recommended for building.
- **Storage:** 20GB+ SSD (gp3).
- **OS:** Ubuntu 24.04 LTS.

---

## 2. Security Group Configuration

Ensure your Security Group allows:
- **SSH (22):** For management.
- **HTTP (80):** For initial connection/Certbot.
- **HTTPS (443):** For secure access.
- **Port 4000 (Optional):** If you want to access the Backend API directly without a proxy.

---

## 3. Server Preparation

Connect via SSH and run:

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 3. Install Nginx and Git
sudo apt install -y nginx git
```

---

## 4. Application Setup

```bash
# 1. Clone the repository
git clone https://github.com/Inshal-1/AutoFlowAI.git AutoFlow
cd AutoFlow

# 2. Install dependencies
bun install

# 3. Configure environment
# Update DATABASE_URL and BETTER_AUTH_SECRET in these files
cp .env.example .env
cp web/.env.example web/.env

# 4. Run Database Migrations
# This creates the necessary tables in your RDS or local Postgres
bun run db:push
```

---

## 5. Build and Process Management

We use PM2 to ensure the processes restart if the server reboots.

```bash
# 1. Install PM2
bun add -g pm2

# 2. Build the frontend
bun run build

# 3. Start services
# We start the backend server and the web dashboard
pm2 start "bun run dev:server" --name autoflow-server
pm2 start "bun run start" --name autoflow-web

# 4. Ensure PM2 starts on boot
pm2 save
pm2 startup
```

---

## 6. Nginx Reverse Proxy & WebSockets

Create a new Nginx configuration:
`sudo nano /etc/nginx/sites-available/autoflow`

```nginx
server {
    listen 80;
    server_name your-domain.com; # Replace with your domain or IP

    # Dashboard / Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API / WebSockets
    location /ws/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable the site and restart Nginx:
```bash
# 1. Force recreate the link to handle potential broken links
sudo ln -sf /etc/nginx/sites-available/autoflow /etc/nginx/sites-enabled/

# 2. Disable the default nginx page
sudo rm -f /etc/nginx/sites-enabled/default

# 3. Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. SSL (Highly Recommended)

AutoFlow's WebSockets and Dashboard should be served over HTTPS.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 8. Connecting Your Devices

Once your EC2 instance is live:
1.  Open the AutoFlow app on your Android device.
2.  Set the **Server URL** to `https://your-domain.com`.
3.  Enter your **API Key** generated from the Dashboard.
4.  The device should now appear as "Online" in your EC2-hosted dashboard.
