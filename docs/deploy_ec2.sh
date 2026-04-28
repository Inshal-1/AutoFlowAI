#!/bin/bash

# =================================================================
# AutoFlow AI - Final Stable EC2 Deployment Script (Ubuntu 24.04)
# =================================================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting AutoFlow Final Stable Deployment...${NC}"

# 1. Update and Install System Dependencies
echo -e "${BLUE}1. Installing System Dependencies (Nginx, Git, Node.js, Postgres)...${NC}"
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git nodejs npm postgresql postgresql-contrib curl

# 2. Install Bun
echo -e "${BLUE}2. Installing Bun Runtime...${NC}"
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc

# 3. Setup PostgreSQL
echo -e "${BLUE}3. Configuring Local PostgreSQL Database...${NC}"
DB_PASSWORD=$(openssl rand -base64 12)
sudo -u postgres psql -c "CREATE USER autoflow_user WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE autoflow_db OWNER autoflow_user;"

# 4. Environment Configuration
echo -e "${BLUE}4. Configuring Environment Variables...${NC}"
DB_URL="postgresql://autoflow_user:$DB_PASSWORD@localhost:5432/autoflow_db"
AUTH_SECRET=$(openssl rand -base64 32)
PUBLIC_IP=$(curl -s ifconfig.me)

cat <<EOF > .env
DATABASE_URL="$DB_URL"
BETTER_AUTH_SECRET="$AUTH_SECRET"
BETTER_AUTH_URL="http://$PUBLIC_IP"
PORT=4000
LLM_PROVIDER="openai"
EOF

# Use same settings for workspaces
cp .env server/.env

cat <<EOF > web/.env
DATABASE_URL="$DB_URL"
BETTER_AUTH_SECRET="$AUTH_SECRET"
BETTER_AUTH_URL="http://$PUBLIC_IP"
SERVER_URL="http://$PUBLIC_IP/ws"
PUBLIC_SERVER_WS_URL="ws://$PUBLIC_IP/ws"
ORIGIN="http://$PUBLIC_IP"
EOF

# 5. Install Deps and Build
echo -e "${BLUE}5. Installing Node Modules and Building Frontend...${NC}"
bun install
bun run db:push

# Clear old build artifacts
rm -rf web/.svelte-kit
# Pass secrets to build explicitly
BETTER_AUTH_SECRET="$AUTH_SECRET" BETTER_AUTH_URL="http://$PUBLIC_IP" ORIGIN="http://$PUBLIC_IP" bun run build

# 6. Setup PM2
echo -e "${BLUE}6. Configuring PM2 Process Manager...${NC}"
bun add -g pm2
export PATH="$HOME/.bun/install/global/node_modules/pm2/bin:$PATH"

pm2 delete all 2>/dev/null || true
pm2 start "bun run dev:server" --name autoflow-server
pm2 start "bun run start" --name autoflow-web
pm2 save

# 7. Setup Nginx
echo -e "${BLUE}7. Configuring Nginx Reverse Proxy...${NC}"
sudo rm -f /etc/nginx/sites-enabled/default

sudo tee /etc/nginx/sites-available/autoflow > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /ws/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/autoflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}AutoFlow FINAL STABLE Finish!${NC}"
echo -e "${BLUE}Dashboard URL: http://$PUBLIC_IP${NC}"
echo -e "${BLUE}Database Password: $DB_PASSWORD${NC}"
echo -e "${BLUE}Check logs with: pm2 logs${NC}"
echo -e "${GREEN}====================================================${NC}"
