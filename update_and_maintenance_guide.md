# ==============================================================================
#                     ELISTER.AI UPDATE & MAINTENANCE GUIDE
# ==============================================================================
# Use this guide to manage your live server, deploy new updates, change API keys,
# and check errors.
# ==============================================================================

---

## 1. Local Folder Renaming (Windows Machine)
To change your local folder name from `Kreatelist Client` to `elister`:
1. **Close VS Code** and any terminal windows using this folder. (Windows locks directories currently in use, which prevents renaming).
2. Open Windows File Explorer and navigate to `D:\Project`.
3. Rename the directory `Kreatelist Client` to `elister` (or `elister-client`).
4. Re-open the folder in VS Code.
5. *(Optional)* If you rename your repository on GitHub.com (via Settings -> Rename), update your local git repository URL by running this command inside the renamed folder:
   ```bash
   git remote set-url origin https://github.com/dev21sept/YOUR_NEW_REPO_NAME.git
   ```

---

## 2. Server Folder Architecture
The project directory on your EC2 server has been successfully renamed to:
`~/elister`

The PM2 process has been updated and registered as:
`elister-backend` (pointing to `~/elister/backend/server.js`)

---

## 3. How to Deploy Frontend Updates (React App)
Whenever you make frontend changes locally and want to show them on the live website:

### Step 1: Push changes to GitHub from your local machine
```bash
git add .
git commit -m "update: frontend changes"
git push origin main
```

### Step 2: Pull & build on your EC2 Server
```bash
# 1. Login to your server using the new SSH alias
ssh ec2-elister

# 2. Go to the project directory
cd ~/elister

# 3. Pull the latest commits from GitHub
git pull origin main

# 4. Go to the frontend directory and build the files
cd frontend
npm install              # Run this only if you added new packages
npm run build            # Compiles React code into the "dist" folder

# 5. Copy the compiled files to the Nginx web root folder
sudo cp -r dist/* /var/www/html/
```

---

## 4. How to Deploy Backend Updates (Node.js API)
Whenever you make backend code updates (controllers, routes, db configs, etc.):

### Step 1: Push changes to GitHub from your local machine
```bash
git add .
git commit -m "update: backend API fix"
git push origin main
```

### Step 2: Pull & restart backend on your EC2 Server
```bash
# 1. Login to your server
ssh ec2-elister

# 2. Go to the project directory and pull the code
cd ~/elister
git pull origin main

# 3. Go to the backend folder
cd backend
npm install              # Run this only if you added new npm libraries

# 4. Restart the PM2 process to apply changes
pm2 restart elister-backend
```

---

## 5. Managing Backend Environment Variables (.env)
If you need to change database links, JWT secrets, or eBay developer client keys:

### Step 1: Edit the .env file on the server
```bash
ssh ec2-elister
cd ~/elister/backend
nano .env
```
- **Edit**: Move cursor using arrow keys and make edits.
- **Save**: Press `Ctrl + O` and then press `Enter`.
- **Exit**: Press `Ctrl + X`.

### Step 2: Apply the changes
You must restart the backend process for Node.js to load the new environment values:
```bash
pm2 restart elister-backend
```

---

## 6. How to View Logs & Troubleshoot Errors
If the server is acting up, use these commands to locate the issue:

```bash
# 1. Check if backend is running (look for status "online")
pm2 status

# 2. View real-time Node.js application logs (database connection, eBay APIs, console logs)
pm2 logs elister-backend

# 3. View Nginx server logs (shows if web traffic is hitting Nginx successfully)
sudo tail -f /var/log/nginx/access.log

# 4. View Nginx error logs (SSL certificate errors or configuration problems)
sudo tail -f /var/log/nginx/error.log

# 5. Check status of system database and web services
sudo systemctl status mongod
sudo systemctl status nginx
```
