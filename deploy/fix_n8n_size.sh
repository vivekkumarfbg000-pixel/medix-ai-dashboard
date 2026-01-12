#!/bin/bash

# Fix Script for Nginx Upload Size
# Run this on the Hostinger VPS as root

echo "🔧 Increasing Upload Size Limit..."

# Add client_max_body_size to n8n config if not present
if ! grep -q "client_max_body_size" /etc/nginx/sites-available/n8n; then
    sed -i '/server_name/a \    client_max_body_size 50M;' /etc/nginx/sites-available/n8n
    echo "✅ Added client_max_body_size 50M"
else
    echo "ℹ️  Limit might already be set, checking..."
    grep "client_max_body_size" /etc/nginx/sites-available/n8n
fi

# Reload Nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo "✅ Fix Applied!"
