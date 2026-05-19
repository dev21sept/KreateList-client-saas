# Update & Maintenance Guide (EC2)

Use this guide whenever you make changes to your code or need to manage your server.

---

## 1. Manual Update Process (The "Quick Fix")

Run these commands in order to update your live server manually:

```bash
# 1. Go to project root
cd ~/KreateList-client-saas

# 2. Pull latest code from GitHub
git pull origin main

# 3. Update Backend
cd backend
npm install  # agar koi new library install krni ho toh
pm2 restart kreatelist-backend

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
cd ~/KreateList-client-saas/backend

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
`pm2 restart kreatelist-backend`
`pm2 log kreatelist-backend`
`sudo systemctl restart nginx`

---

## 3. Viewing Logs (Troubleshooting)

Use these commands to check the status of your server and find errors:

```bash
# View real-time application logs (Check for crashes or database errors)
pm2 logs kreatelist-backend

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


Nginx config file open karein:

bash
`sudo nano /etc/nginx/sites-available/default`
Pura file content delete karke, ye complete secure block paste karein: (Isme humne SSL, Redirect aur client_max_body_size 500M; dono set kar diye hain):

nginx
server {
    server_name apikreatelist.ajxlubricant.co.in;
    # Request size limit badhane ke liye (413 Payload Too Large error fix)
    client_max_body_size 500M;
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    # SSL settings (Certbot ke certificates)
    listen [::]:443 ssl ipv6only=on;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/apikreatelist.ajxlubricant.co.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/apikreatelist.ajxlubricant.co.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
# HTTP to HTTPS automatic redirection
server {
    if ($host = apikreatelist.ajxlubricant.co.in) {
        return 301 https://$host$request_uri;
    }
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name apikreatelist.ajxlubricant.co.in;
    return 404;
}
Save and Close:

Press Ctrl + O then Enter to save.
Press Ctrl + X to exit.
Nginx config test aur restart karein:

bash
`sudo nginx -t`
`sudo systemctl restart nginx`
💡 Tip: Agar sudo nginx -t me SSL certificate error dikhaye:
Agar aapke certificates ka path alag hai, to aap bas niche di gayi command run kar dein. Certbot khud saari SSL lines configuration file me automatic inject kar dega:

bash
`sudo certbot --nginx -d apikreatelist.ajxlubricant.co.in --reinstall`
Is command ko run karne ke baad aapka HTTPS redirect aur SSL setup perfectly restore ho jayega!