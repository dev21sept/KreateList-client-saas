#!/bin/bash
# ==============================================================================
#                      ELISTER DEPLOYMENT AUTOMATION SCRIPT
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Get current username and home directory
CURRENT_USER=$(whoami)
CURRENT_HOME=$HOME

# 1. Load or Install Node & NVM
export NVM_DIR="$CURRENT_HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
    echo "=== 1. Installing NVM ==="
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# Load NVM into shell session
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "=== 2. Installing Node.js 20 ==="
nvm install 20
nvm use 20

echo "=== 3. Installing PM2 ==="
npm install -g pm2

echo "=== 4. Cloning Project Repository ==="
# Remove folder if already exists to ensure fresh deployment
rm -rf "$CURRENT_HOME/elister"
git clone https://github.com/dev21sept/KreateList-client-saas.git "$CURRENT_HOME/elister"

echo "=== 5. Setting up Backend Environment Variables (.env) ==="
mkdir -p "$CURRENT_HOME/elister/backend"
cat << 'EOF' > "$CURRENT_HOME/elister/backend/.env"
PORT=5000
MONGO_URI=mongodb://localhost:27017/elister
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=30d

# eBay API Config
EBAY_CLIENT_ID=YOUR_EBAY_CLIENT_ID
EBAY_CLIENT_SECRET=YOUR_EBAY_CLIENT_SECRET
EBAY_APP_ID=YOUR_EBAY_APP_ID
EBAY_DEV_ID=YOUR_EBAY_DEV_ID
EBAY_CERT_ID=YOUR_EBAY_CERT_ID
EBAY_RU_NAME=YOUR_EBAY_RU_NAME
EBAY_ENVIRONMENT=production
EBAY_VERIFICATION_TOKEN=YOUR_EBAY_VERIFICATION_TOKEN

# Stripe Config
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Frontend URL
FRONTEND_URL=https://elister.ai/
VITE_API_URL=https://api.elister.ai

# OpenAI Config
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
RAZORPAY_KEY_ID=YOUR_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_KEY_SECRET

# Etsy API Config
ETSY_CLIENT_ID=YOUR_ETSY_CLIENT_ID
ETSY_CLIENT_SECRET=YOUR_ETSY_CLIENT_SECRET
EOF

echo "=== 6. Installing Backend Dependencies ==="
cd "$CURRENT_HOME/elister/backend"
npm install

echo "=== 7. Starting Backend using PM2 ==="
# Determine PM2 executable path
PM2_BIN="$CURRENT_HOME/.nvm/versions/node/$(node -v)/bin/pm2"

# Start the backend app
if [ -f ecosystem.config.js ]; then
    "$PM2_BIN" start ecosystem.config.js --env production
else
    "$PM2_BIN" start server.js --name "elister-backend"
fi

# Save PM2 process list
"$PM2_BIN" save

echo "=== 8. Configuring PM2 Startup ==="
# Setup PM2 startup configuration dynamically
NODE_BIN_DIR="$CURRENT_HOME/.nvm/versions/node/$(node -v)/bin"
sudo env PATH=$PATH:"$NODE_BIN_DIR" "$PM2_BIN" startup systemd -u "$CURRENT_USER" --hp "$CURRENT_HOME" || true

echo "============================================================"
echo " DEPLOYMENT COMPLETE! "
echo " Backend is running on port 5000. "
echo "============================================================"
