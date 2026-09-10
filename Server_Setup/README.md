# Elister.ai - Complete Server Setup & Deployment Toolkit

This directory contains all documentation, automated shell scripts, Nginx configurations, and deployment tools for setting up and managing the production EC2 cloud server for **Elister.ai**.

---

## Directory Overview

| File / Folder | Purpose |
| :--- | :--- |
| **`setup_nginx_ssl.sh`** | **Primary Nginx & SSL Script**: Configures `/etc/nginx/sites-available/express-app`, creates symlinks, configures web permissions, and requests Let's Encrypt SSL certificates for all domains (`elister.ai`, `app.elister.ai`, `api.elister.ai`). |
| **`AWS_Setup_Guide.md`** | **Master Step-by-Step AWS EC2 Manual**: Full instructions for Node.js 20, MongoDB 8.0, PM2, Git, Nginx, and GitHub Actions CI/CD setup. |
| **`nginx/express-app`** | **Production Nginx Config**: The exact 4-block virtual host configuration running on the live server. |
| **`setup_ssl_domains.sh`** | Helper script to configure virtual hosts and run Certbot SSL. |
| **`setup_gui_chrome.sh`** | Installs lightweight GUI desktop, Xvfb virtual frame buffer, and Google Chrome for Mercari/Poshmark automation workers. |
| **`setup_rdp.sh`** | Configures XRDP remote desktop server for GUI access on port 3389. |
| **`deploy_elister.sh`** | Shell script for building and deploying the full stack on the server. |
| **`deploy_frontend.sh`** | Shell script for compiling frontend to `/var/www/html/`. |
| **`update_and_maintenance_guide.md`** | Routine server maintenance, log monitoring, and backup procedures. |

---

## Quick Execution Guide

### 1. New Server Setup (Nginx + SSL)
```bash
chmod +x setup_nginx_ssl.sh
./setup_nginx_ssl.sh
```

### 2. Automated CI/CD (GitHub Actions)
Whenever code is pushed to the `main` branch, the workflow located at `.github/workflows/deploy.yml` automatically triggers, builds the frontend, and reloads the PM2 backend process on EC2.
