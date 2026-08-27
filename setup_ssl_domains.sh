#!/bin/bash
# ==============================================================================
#                      DOMAINS & HTTPS SSL SETUP SCRIPT
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== 1. Configuring Nginx Domain Virtual Hosts (Port 80) ==="
sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name elister.ai www.elister.ai app.elister.ai;

    root /var/www/html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name api.elister.ai;

    client_max_body_size 1024M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /uploads {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

echo "=== 2. Restarting Nginx to apply changes ==="
sudo nginx -t
sudo systemctl restart nginx

echo "=== 3. Updating Frontend API URL to HTTPS Domain ==="
# Set VITE_API_URL to point to the secure API subdomain
echo "VITE_API_URL=https://api.elister.ai" > ~/elister/frontend/.env
echo "Created frontend/.env with VITE_API_URL=https://api.elister.ai"

echo "=== 4. Rebuilding Frontend from GitHub Source ==="
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
cd ~/elister/frontend
npm run build
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/

echo "=== 5. Installing Certbot and Requesting SSL Certificates (HTTPS) ==="
sudo apt install -y certbot python3-certbot-nginx

# Request SSL and auto-configure Nginx with HTTP-to-HTTPS redirect
sudo certbot --nginx -d elister.ai -d www.elister.ai -d app.elister.ai -d api.elister.ai --non-interactive --agree-tos --email support@elister.ai --redirect

echo "=== 6. Restarting Nginx Web Server ==="
sudo systemctl restart nginx

echo "============================================================"
echo " DOMAINS & HTTPS SETUP COMPLETE! "
echo "============================================================"
echo "You can now access your application securely at:"
echo "👉 Frontend: https://app.elister.ai"
echo "👉 Backend API: https://api.elister.ai"
echo "============================================================"
