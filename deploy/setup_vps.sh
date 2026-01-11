#!/bin/bash

# Ultra-simple setup script for Medix AI Dashboard on Hostinger VPS
# Run this on your VPS terminal (PuTTY or Hostinger Browser Terminal)

echo "🚀 Starting Medix VPS Setup..."

# 1. Update System
echo "📦 Updating packages..."
apt-get update -y
apt-get install nginx unzip -y

# 2. Setup Firewall (UFW)
echo "🛡️ Configuring Firewall..."
ufw allow 'Nginx Full'
ufw allow OpenSSH
echo "y" | ufw enable

# 3. Create Web Directory
echo "xor Creating web folder..."
mkdir -p /var/www/html
chown -R $USER:$USER /var/www/html
chmod -R 755 /var/www/html

# 4. Configure Nginx for React (SPA)
echo "⚙️ Configuring Nginx..."
cat > /etc/nginx/sites-available/default <<EOF
server {
    listen 80;
    server_name _;

    root /var/www/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# 5. Restart Nginx
systemctl restart nginx

echo "✅ Web Server Installed!"
echo "👉 You can now upload your 'dist' files to /var/www/html using FileZilla."
