#!/bin/bash
# ==============================================================================
#                      ELISTER FRONTEND DEPLOYMENT SCRIPT
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== 1. Installing Nginx ==="
sudo apt update
sudo apt install -y nginx

echo "=== 2. Setting up Frontend Environment File (.env) ==="
# Fetch public IP automatically to configure VITE_API_URL dynamically
PUBLIC_IP=$(curl -s https://api.ipify.org || echo "34.171.102.244")
echo "VITE_API_URL=http://$PUBLIC_IP" > ~/elister/frontend/.env
echo "Created frontend/.env with VITE_API_URL=http://$PUBLIC_IP"

echo "=== 3. Loading NVM and Node ==="
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

echo "=== 4. Installing Frontend Dependencies ==="
cd ~/elister/frontend
npm install

echo "=== 5. Compiling/Building Frontend ==="
npm run build

echo "=== 6. Copying Static Files to Web Root ==="
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/

echo "=== 7. Creating Nginx Reverse Proxy Configuration ==="
sudo tee /etc/nginx/sites-available/default > /dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /uploads {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

echo "=== 8. Restarting Nginx Web Server ==="
sudo systemctl restart nginx

echo "============================================================"
echo " FRONTEND & REVERSE PROXY DEPLOYMENT COMPLETE! "
echo " You can access your application at: http://$PUBLIC_IP "
echo "============================================================"
