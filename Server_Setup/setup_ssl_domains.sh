#!/bin/bash
# ==============================================================================
#                      DOMAINS & HTTPS SSL SETUP SCRIPT
# ==============================================================================

set -e

echo "=== 1. Configuring Nginx Domain Virtual Hosts (/etc/nginx/sites-available/express-app) ==="
sudo tee /etc/nginx/sites-available/express-app > /dev/null <<'EOF'
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
}
EOF

echo "=== 2. Enabling express-app & disabling default site ==="
sudo ln -sf /etc/nginx/sites-available/express-app /etc/nginx/sites-enabled/express-app
sudo rm -f /etc/nginx/sites-enabled/default

echo "=== 3. Setting web permissions ==="
sudo mkdir -p /var/www/html
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 775 /var/www/html

echo "=== 4. Restarting Nginx to apply changes ==="
sudo nginx -t
sudo systemctl restart nginx

echo "=== 5. Installing Certbot and Requesting SSL Certificates (HTTPS) ==="
sudo apt install -y certbot python3-certbot-nginx

# Request SSL and auto-configure Nginx with HTTP-to-HTTPS redirect
sudo certbot --nginx -d elister.ai -d www.elister.ai -d app.elister.ai -d api.elister.ai --non-interactive --agree-tos --email support@elister.ai --redirect

echo "=== 6. Restarting Nginx Web Server ==="
sudo systemctl restart nginx

echo "============================================================"
echo " DOMAINS & HTTPS SETUP COMPLETE! "
echo "============================================================"
echo "Frontend:   https://app.elister.ai"
echo "API Server: https://api.elister.ai"
echo "============================================================"
