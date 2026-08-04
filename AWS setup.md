# ==============================================================================
#                      MASTER AWS EC2 SETUP & DEPLOYMENT GUIDE
#                                  Elister.ai
# ==============================================================================
# This guide contains the exact steps and commands to set up the new 16GB/4GB
# server (t3.medium in N. Virginia) from scratch, explain what each command does,
# deploy both frontend/backend, configure Nginx, and install SSL.
# ==============================================================================

# ------------------------------------------------------------------------------
# STEP 1: CONNECT TO YOUR SERVER
# ------------------------------------------------------------------------------
# Run this command in your local command prompt or terminal to log in to the server.
# "ec2-elistersaas" is the SSH alias configured in your Windows ~/.ssh/config file.
# It resolves to IP: 54.175.32.246 and uses the key: elistersaas.pem.
ssh ec2-elistersaas


# ------------------------------------------------------------------------------
# STEP 2: INITIAL SERVER PREPARATION & SYSTEM UPDATES
# ------------------------------------------------------------------------------
# 1. Update the local package index.
sudo apt update

# 2. Upgrade all installed packages to their latest versions.
sudo apt upgrade -y

# 3. Install necessary native extraction utilities (required for Puppeteer browser setup)
sudo apt install -y gnupg curl ca-certificates unzip git

# 4. Install Node Version Manager (NVM) to manage Node.js versions easily.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 5. Load NVM into the current shell session so we can use the "nvm" command immediately.
source ~/.bashrc

# 6. Install Node.js version 20 (matching development and production requirements).
nvm install 20
nvm use 20

# 7. Verify Node and NPM installation.
node -v
npm -v

# 8. Install PM2 globally to manage backend processes in the background.
npm install -g pm2


# ------------------------------------------------------------------------------
# STEP 3: MONGODB 8.0 DATABASE INSTALLATION (RUNS ON UBUNTU 24.04 NOBLE)
# ------------------------------------------------------------------------------
# 1. Import the official MongoDB 8.0 security GPG key.
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

# 2. Add the MongoDB 8.0 repository list file for Ubuntu 24.04 (noble).
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# 3. Update package database.
sudo apt-get update

# 4. Install MongoDB Community Edition.
sudo apt-get install -y mongodb-org

# 5. Start the MongoDB database daemon.
sudo systemctl start mongod

# 6. Enable MongoDB to start automatically at system boot.
sudo systemctl enable mongod

# 7. Check if MongoDB is running successfully (should say "active (running)").
sudo systemctl status mongod


# ------------------------------------------------------------------------------
# STEP 4: CLONE REPOSITORY & DEPLOY BACKEND
# ------------------------------------------------------------------------------
# 1. Clone your project repository into the home directory (named "elister").
git clone https://github.com/dev21sept/KreateList-client-saas.git ~/elister

# 2. Enter the backend directory.
cd ~/elister/backend

# 3. Install production and package dependencies.
npm install

# 4. Create the environment variables configuration file (.env).
nano .env

# ==========================================
# PASTE THESE KEYS INSIDE THE .env FILE:
# ==========================================
# PORT=5000
# MONGO_URI=mongodb://localhost:27017/elister
# JWT_SECRET=your_jwt_secret_here
# JWT_EXPIRE=30d
#
# # eBay API Config
# EBAY_CLIENT_ID=your_ebay_app_client_id
# EBAY_CLIENT_SECRET=your_ebay_app_client_secret
# EBAY_REDIRECT_URI=https://elister.ai/ebay-callback
# ... (see active keys in backup guide or vault)
# ==========================================

# 5. Start the backend app using PM2 and the ecosystem configuration.
pm2 start ecosystem.config.js --env production

# 6. Save the PM2 process list to auto-resume on server reboot.
pm2 save

# 7. Verify status.
pm2 status


# ------------------------------------------------------------------------------
# STEP 5: DEPLOY FRONTEND
# ------------------------------------------------------------------------------
# 1. Navigate to the frontend directory.
cd ~/elister/frontend

# 2. Install all frontend dependencies.
npm install

# 3. Create the production build (compiles code into "dist/" directory).
npm run build

# 4. Copy the compiled static files to the Nginx web root directory.
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/


# ------------------------------------------------------------------------------
# STEP 6: NGINX WEB SERVER & REVERSE PROXY SETUP
# ------------------------------------------------------------------------------
# 1. Install Nginx web server.
sudo apt install nginx -y

# 2. Edit the default Nginx configuration file.
sudo nano /etc/nginx/sites-available/default

# ==============================================================================
# COPY AND PASTE THIS ENTIRE CONFIGURATION INTO THE FILE (Replace everything):
# ==============================================================================
# server {
#     listen 80;
#     listen [::]:80;
#     server_name elister.ai www.elister.ai app.elister.ai;
#
#     root /var/www/html;
#     index index.html index.htm;
#
#     location / {
#         try_files $uri $uri/ /index.html;
#     }
# }
#
# server {
#     listen 80;
#     listen [::]:80;
#     server_name api.elister.ai;
#
#     client_max_body_size 1024M;
#
#     location / {
#         proxy_pass http://localhost:5000;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_cache_bypass $http_upgrade;
#     }
# }
# ==============================================================================

# 3. Test Nginx configuration.
sudo nginx -t

# 4. Restart Nginx.
sudo systemctl restart nginx


# ------------------------------------------------------------------------------
# STEP 7: INSTALL SSL CERTIFICATE (HTTPS)
# ------------------------------------------------------------------------------
# 1. Install Certbot and the Nginx plugin.
sudo apt install certbot python3-certbot-nginx -y

# 2. Request and automatically deploy SSL certificates.
sudo certbot --nginx -d elister.ai -d www.elister.ai -d app.elister.ai -d api.elister.ai

# 3. Test and restart.
sudo nginx -t
sudo systemctl restart nginx
