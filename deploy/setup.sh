#!/bin/bash

# Update and Install Dependencies
echo "Update system..."
apt update && apt upgrade -y
apt install -y curl git ufw unzip nginx

# Firewall Setup
echo "Setting up Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "y" | ufw enable

# Docker Setup
echo "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# Setup n8n
echo "Setting up n8n..."
mkdir -p /opt/n8n
cp docker-compose.yml /opt/n8n/
cd /opt/n8n
docker compose up -d

# Setup Nginx
echo "Setting up Nginx..."
cp /tmp/deploy/n8n.conf /etc/nginx/sites-available/n8n
cp /tmp/deploy/dashboard.conf /etc/nginx/sites-available/dashboard

# Enable Sites
ln -sf /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Restart Nginx
nginx -t && systemctl restart nginx

# SSL Setup (Interactive - User must do this manually or auto-accept defaults if we add flags)
echo "Installing Certbot..."
apt install -y certbot python3-certbot-nginx

echo "Server Setup Complete! Run 'certbot --nginx' to enable HTTPS manually."
