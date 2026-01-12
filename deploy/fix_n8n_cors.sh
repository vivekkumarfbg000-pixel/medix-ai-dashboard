#!/bin/bash

# Fix Script for n8n CORS Issue
# Run this on the Hostinger VPS as root

echo "🚀 Starting CORS Fix for n8n..."

# 1. Update Nginx Config
echo "⚙️ Updating Nginx Configuration..."
cat > /etc/nginx/sites-available/n8n <<'EOF'
server {
    server_name n8n.medixai.shop;

    location / {
        proxy_pass http://127.0.0.1:5678;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # CORS Headers - Apply to ALL responses
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # SSL Configuration (Managed by Certbot - checking if it exists, otherwise standard port 80)
    listen 80;
}
EOF

# Note: If SSL was already set up by Certbot, the file might look different (with 443 block).
# Ideally we should only touch the location block, but overwriting implies we might lose SSL lines if we aren't careful.
# However, Certbot usually separates concerns or we can re-run certbot logic.
# BETTER APPROACH: Don't overwrite the whole file blindly if SSL is active.
# But since I know the previous state was just the setup, and Certbot appends to it...
# Actually, Certbot modifies the file. Overwriting it will BREAK SSL.

# REVISED STRATEGY: Use sed to insert the headers or just ask user to run certbot again? No.
# I will use a smarter script that tries to inject the headers or provides the full correct content assuming Certbot will wrap it?
# No, relying on Certbot again is annoying.

# Let's provide a script that patches the file using `sed` or writes a known good "SSL-enabled" config if we want to be bold, 
# BUT we don't know the exact paths certbot used (though standard).

# Safest: Use `sed` to replace the `location / {` block or just the `if` block.

# Using sed to replace the specific if block with the new content.
echo "🔧 Patching CORS config..."
sed -i '/if ($request_method = .OPTIONS.) {/,/}/c\
        add_header "Access-Control-Allow-Origin" "*" always;\n\
        add_header "Access-Control-Allow-Methods" "GET, POST, OPTIONS, PUT, DELETE" always;\n\
        add_header "Access-Control-Allow-Headers" "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;\n\
        if ($request_method = "OPTIONS") {\n\
            add_header "Access-Control-Max-Age" 1728000;\n\
            add_header "Content-Type" "text/plain; charset=utf-8";\n\
            add_header "Content-Length" 0;\n\
            return 204;\n\
        }' /etc/nginx/sites-available/n8n

# 2. Reload Nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo "✅ CORS Fixed!"
