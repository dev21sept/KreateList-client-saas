#!/bin/bash
# ==============================================================================
#                 ELISTER.AI - NGINX & SSL PRODUCTION SETUP SCRIPT
# ==============================================================================
# This script configures Nginx for Elister.ai, creates the express-app virtual
# host config, sets up correct web permissions, installs Certbot, and deploys
# SSL certificates for elister.ai, www.elister.ai, app.elister.ai, and api.elister.ai.
# ==============================================================================

set -e

echo "=== STEP 1: Installing Nginx, Certbot & Utilities ==="
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

echo "=== STEP 2: Writing /etc/nginx/sites-available/express-app ==="
sudo tee /etc/nginx/sites-available/express-app > /dev/null <<'EOF'
# 1. FRONTEND CONFIGURATION (elister.ai, www.elister.ai, app.elister.ai)
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

# 2. BACKEND API REVERSE PROXY (api.elister.ai -> Port 5000)
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
}
EOF

echo "=== STEP 3: Enabling express-app & Disabling default site ==="
sudo ln -sf /etc/nginx/sites-available/express-app /etc/nginx/sites-enabled/express-app
sudo rm -f /etc/nginx/sites-enabled/default

echo "=== STEP 4: Setting correct web permissions for /var/www/html ==="
sudo mkdir -p /var/www/html
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 775 /var/www/html

echo "=== STEP 5: Testing & Starting Nginx ==="
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "=== STEP 6: Requesting & Deploying Let's Encrypt SSL Certificates ==="
sudo certbot --nginx \
  -d elister.ai \
  -d www.elister.ai \
  -d app.elister.ai \
  -d api.elister.ai \
  --non-interactive \
  --agree-tos \
  --email support@elister.ai \
  --redirect

echo "=== STEP 7: Reloading Nginx with HTTPS ==="
sudo nginx -t
sudo systemctl reload nginx

echo "============================================================"
echo " NGINX & HTTPS SSL SETUP COMPLETED SUCCESSFULLY! "
echo "============================================================"
echo "Frontend:   https://app.elister.ai"
echo "API Server: https://api.elister.ai"
echo "============================================================"
