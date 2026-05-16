# Update & Maintenance Guide (EC2)

Use this guide whenever you make changes to your code or need to manage your server.

---

## 1. Manual Update Process (The "Quick Fix")

Run these commands in order to update your live server manually:

```bash
# 1. Go to project root
cd ~/E-commerce-product

# 2. Pull latest code from GitHub
git pull origin main

# 3. Update Backend
cd backend
npm install  # agar koi new library install krni ho toh
pm2 restart valisting-backend

# 4. Update Frontend (If hosted on this server)
cd ../frontend
npm install
npm run build
```

---

## 2. Managing Environment Variables (.env)

If you need to change API Keys or Database URLs on the server, edit the `.env` file:

```bash
# 1. Navigate to the backend folder
cd ~/E-commerce-product/backend

# 2. Open the .env file in the Nano editor
sudo nano .env
```

### **To just View/Check the data (Read-only):**
```bash
cat .env
```

### **How to Use the Nano Editor:**
*   **To Edit:** Use arrow keys to move and start typing.
*   **To Save Changes:** Press `Ctrl + O`, then press `Enter`.
*   **To Exit Editor:** Press `Ctrl + X`.

*Note: You must restart the backend after changing the .env file for changes to take effect:*
`pm2 restart valisting-backend`
`pm2 log valisting-backend`
`sudo systemctl restart nginx`

---

## 3. Viewing Logs (Troubleshooting)

Use these commands to check the status of your server and find errors:

```bash
# View real-time application logs (Check for crashes or database errors)
pm2 logs valisting-backend

# View Nginx traffic logs (Check if requests are reaching the server)
sudo tail -f /var/log/nginx/access.log

# View Nginx error logs (Check for configuration or SSL issues)
sudo tail -f /var/log/nginx/error.log
```

---

## 4. PM2 Command Reference (Process Management)

Common PM2 commands for managing your application:

```bash
pm2 list                    # List all running applications and their status
pm2 restart all             # Restart all applications
pm2 stop <app_name>         # Stop a specific application
pm2 start ecosystem.config.js --env production  # Start with production environment
pm2 delete <app_name>       # Remove an application from the list
pm2 monit                   # Real-time dashboard for CPU and RAM usage
```

---

## 5. System Services Status

If you think the Database or Web Server has stopped, check these:

```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Check if Nginx is running
sudo systemctl status nginx
```
