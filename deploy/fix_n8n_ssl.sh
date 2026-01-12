#!/bin/bash

# Fix Script for n8n SSL Issue
# Run this on the Hostinger VPS as root (or use sudo)

set -e

DOMAIN="n8n.medixai.shop"
EMAIL="vivek@medixai.shop" # Defaulting to likely email, change if needed

echo "🚀 Starting SSL Fix for $DOMAIN..."

# 1. Ensure Certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
else
    echo "✅ Certbot is already installed."
fi

# 2. Check Nginx Config
if [ ! -f /etc/nginx/sites-enabled/n8n ]; then
    echo "⚠️  Warning: n8n Nginx config not found in sites-enabled. Attempting to link..."
    if [ -f /etc/nginx/sites-available/n8n ]; then
        ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
        echo "🔗 Linked n8n config."
    else
        echo "❌ Error: /etc/nginx/sites-available/n8n does not exist. Please deploy the n8n.conf file first."
        exit 1
    fi
fi

# 3. Request Certificate
echo "🔒 Requesting SSL certificate..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

# 4. Reload Nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo "✅ Success! Access n8n at https://$DOMAIN"
