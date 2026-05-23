# ==============================================================================
#                      MASTER AWS EC2 SETUP & DEPLOYMENT GUIDE
#                                  Elister.ai
# ==============================================================================
# This guide contains the exact steps and commands to set up the server from
# scratch, explain what each command does, how to deploy both frontend/backend,
# manage environment variables, configure Nginx, and install SSL.
# ==============================================================================

# ------------------------------------------------------------------------------
# STEP 1: CONNECT TO YOUR SERVER
# ------------------------------------------------------------------------------
# Run this command in your local command prompt or terminal to log in to the server.
# "ec2-elister" is the SSH alias configured in your Windows ~/.ssh/config file.
ssh ec2-elister


# ------------------------------------------------------------------------------
# STEP 2: INITIAL SERVER PREPARATION & SYSTEM UPDATES
# ------------------------------------------------------------------------------
# 1. Update the local package index to get the latest list of available updates.
sudo apt update

# 2. Upgrade all installed packages to their latest versions.
# The "-y" flag automatically answers "yes" to all prompts.
sudo apt upgrade -y

# 3. Install Node Version Manager (NVM) to manage Node.js versions easily.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 4. Load NVM into the current shell session so we can use the "nvm" command immediately.
source ~/.bashrc

# 5. Install Node.js version 20 (the current stable LTS version).
nvm install 20

# 6. Verify that Node.js and NPM are installed correctly.
node -v
npm -v

# 7. Install Git (code version control) and PM2 (Process Manager to run backend in background).
sudo apt install git -y
npm install -g pm2


# ------------------------------------------------------------------------------
# STEP 3: MONGODB DATABASE INSTALLATION (RUNS LOCALLY ON EC2)
# ------------------------------------------------------------------------------
# 1. Install gnupg and curl which are needed to download and import secure keys.
sudo apt-get install gnupg curl -y

# 2. Download and import the official MongoDB security key (GPG key) for package verification.
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# 3. Add the MongoDB 7.0 repository address to the server's package source list.
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 4. Update the package index again so the system recognizes the newly added MongoDB repository.
sudo apt-get update

# 5. Install the MongoDB database packages.
sudo apt-get install -y mongodb-org

# 6. Start the MongoDB service.
sudo systemctl start mongod

# 7. Enable MongoDB to start automatically whenever the EC2 server boots up.
sudo systemctl enable mongod

# 8. Check if MongoDB is running successfully (should say "active (running)").
sudo systemctl status mongod


# ------------------------------------------------------------------------------
# STEP 4: CLONE REPOSITORY & DEPLOY BACKEND
# ------------------------------------------------------------------------------
# 1. Clone your project repository from GitHub into the home directory (named "elister").
git clone https://github.com/dev21sept/KreateList-client-saas.git ~/elister

# 2. Enter the backend folder where the Node.js API resides.
cd ~/elister/backend

# 3. Install all npm packages/dependencies defined in "package.json".
npm install

# 4. Create the environment variables configuration file (.env).
# Use "nano" (text editor) to write your secret keys.
nano .env

# ==========================================
# PASTE THESE KEYS INSIDE THE .env FILE:
# ==========================================
# PORT=5000
# NODE_ENV=production
# MONGODB_URI=mongodb://127.0.0.1:27017/elister
# JWT_SECRET=your_jwt_secret_key_here
#
# # eBay Developer Portal Credentials
# EBAY_CLIENT_ID=your_ebay_app_client_id
# EBAY_CLIENT_SECRET=your_ebay_app_client_secret
# EBAY_REDIRECT_URI=https://elister.ai/ebay-callback
# ==========================================
# To save in nano: Press Ctrl + O, then Enter.
# To exit nano: Press Ctrl + X.

# 5. Start the backend app in production mode using PM2 and the ecosystem configuration.
pm2 start ecosystem.config.js --env production

# 6. Save the PM2 list so that the backend automatically restarts if the server reboots.
pm2 save

# 7. Verify the backend status (status column should say "online").
pm2 status


# ------------------------------------------------------------------------------
# STEP 5: DEPLOY FRONTEND
# ------------------------------------------------------------------------------
# 1. Navigate to the frontend directory.
cd ~/elister/frontend

# 2. Install all frontend dependencies.
npm install

# 3. Create the production build (compiles react code into high-performance static files in "dist/" directory).
npm run build

# 4. Copy the compiled static files from "dist/" to the default Nginx web root directory.
# "/var/www/html" is where Nginx serves website files from.
sudo cp -r dist/* /var/www/html/


# ------------------------------------------------------------------------------
# STEP 6: NGINX WEB SERVER & REVERSE PROXY SETUP
# ------------------------------------------------------------------------------
# Nginx sits in front of the application. It handles incoming web traffic:
# - Routes domain requests (elister.ai, www.elister.ai) to the static frontend files.
# - Routes backend API requests (api.elister.ai) to our Node.js server running on port 5000.

# 1. Install Nginx web server.
sudo apt install nginx -y

# 2. Edit the default Nginx configuration file.
sudo nano /etc/nginx/sites-available/default

# ==============================================================================
# COPY AND PASTE THIS ENTIRE CONFIGURATION INTO THE FILE (Replace everything):
# ==============================================================================
# # Server block for Frontend (elister.ai and www.elister.ai)
# server {
#     server_name elister.ai www.elister.ai;   <-- [WHERE SERVER_NAME GOES] Tells Nginx which domains this block is for.
#
#     root /var/www/html;                      <-- Directory where frontend dist files are copied.
#     index index.html index.htm;
#
#     location / {
#         try_files $uri $uri/ /index.html;    <-- Crucial for React Router routing to work without 404s.
#     }
# }
#
# # Server block for Backend API (api.elister.ai)
# server {
#     server_name api.elister.ai;              <-- [WHERE SERVER_NAME GOES] Tells Nginx this routes api.elister.ai traffic.
#
#     client_max_body_size 500M;               <-- Fixes "413 Payload Too Large" error when uploading large images.
#
#     location / {
#         proxy_pass http://localhost:5000;    <-- Forwards all requests to Node.js backend running on Port 5000.
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_cache_bypass $http_upgrade;
#     }
# }
# ==============================================================================

# 3. Test if the Nginx configuration has any syntax errors. (Must say "syntax is ok" & "test is successful").
sudo nginx -t

# 4. Restart Nginx to apply the configuration.
sudo systemctl restart nginx


# ------------------------------------------------------------------------------
# STEP 7: INSTALL SSL CERTIFICATE (HTTPS)
# ------------------------------------------------------------------------------
# LetsEncrypt Certbot will generate free SSL certificates and automatically 
# update your Nginx configuration with secure HTTPS redirects.

# 1. Install Certbot and the Nginx plugin.
sudo apt install certbot python3-certbot-nginx -y

# 2. Request and install SSL certificates for all three domains.
# Nginx plugin will automatically inject the certificate configurations for you.
sudo certbot --nginx -d elister.ai -d www.elister.ai -d api.elister.ai

# 3. Test the Nginx configuration again to ensure everything is perfect.
sudo nginx -t

# 4. Restart Nginx to load the SSL certificates.
sudo systemctl restart nginx
