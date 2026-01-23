# Deployment Guide

This guide outlines the steps to deploy the MedixAI Dashboard and its associated components (N8n, Supabase) using Docker and a VPS.

## Prerequisites

- A Virtual Private Server (VPS) (e.g., Hostinger, DigitalOcean, AWS)
- Ubuntu 20.04 or later recommended
- Domain name pointing to your VPS IP
- Git installed
- Docker & Docker Compose installed

## 1. Quick VPS Setup (Hostinger/Ubuntu)

We provide a script to quickly set up your VPS with Nginx and a firewall.

1.  **SSH into your VPS**.
2.  **Upload the setup script**:
    Copy `deploy/setup_vps.sh` to your server.
3.  **Run the script**:
    ```bash
    chmod +x setup_vps.sh
    ./setup_vps.sh
    ```
    This script will:
    - Update system packages.
    - Install Nginx and unzip.
    - Configure UFW firewall.
    - Create the web directory at `/var/www/html`.
    - Configure Nginx for a React SPA.

## 2. Deploying the Dashboard (Frontend)

1.  **Build the project locally**:
    ```bash
    npm run build
    ```
    This creates a `dist` folder.

2.  **Upload `dist` files**:
    Use SCP or FileZilla to upload the *contents* of the `dist` folder to `/var/www/html` on your VPS.

3.  **Verify**:
    Visit your domain or IP address in a browser. The app should load.

## 3. Deploying N8n (Workflow Automation)

We use Docker Compose to run n8n on your server.

1.  **Navigate to the deploy directory**:
    The `deploy/docker-compose.yml` file contains the configuration.

2.  **Configuration**:
    Edit `deploy/docker-compose.yml` to set your specific environment variables if needed (e.g., Domain names, Timezone).

    ```yaml
    environment:
      - N8N_HOST=n8n.your-domain.com
      - WEBHOOK_URL=https://n8n.your-domain.com/
      # ... other variables
    ```

3.  **Start N8n**:
    Transfer `docker-compose.yml` to a folder on your VPS (e.g., `/opt/medix-n8n`).
    Run:
    ```bash
    docker-compose up -d
    ```

4.  **Access N8n**:
    Open `https://n8n.your-domain.com` (or `http://<your-ip>:5678` if not using a reverse proxy yet) to finish the setup.

## 4. Environment Variables

Ensure your `.env` file in the frontend project is correctly configured for production before building.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
# ... other keys
```
