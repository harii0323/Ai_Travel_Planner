# Render Deployment Quickstart

**Estimated Time**: 20–30 minutes | **Cost**: free tier available | **Status**: Ready to Deploy

This guide walks through hosting both the backend API and frontend static site on [Render](https://render.com), a simple PaaS.

## 🎯 Prerequisites

- GitHub, GitLab, or Bitbucket account with the project repository pushed
- Render account (free tier is sufficient for initial testing)
- MongoDB Atlas cluster or another accessible MongoDB instance
- Optional: custom domain name if you want to serve from your own domain

---

## 🧱 Backend Service

1. Log in to Render and click **New → Web Service**.
2. Connect your Git provider and choose the repository containing this project.
3. Select the branch you wish to deploy (e.g. `main`).
4. Configure the service:
   - **Name**: `ai-travel-planner-backend` (or your own)
   - **Environment**: Node.js
   - **Region**: choose closest to your users
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `node src/index.js` or `npm run start`
   - **Instance Type**: `Starter` (or larger depending on load)
5. Add environment variables under **Environment**:
   ```
   MONGODB_URI=your_mongo_connection_string
   JWT_SECRET=<strong-secret>
   FRONTEND_URL=https://your-render-domain-or-custom-domain
   API_BASE_URL=https://your-render-domain
   NODE_ENV=production
   # add any other keys from .env.production.example as needed
   ```
6. Click **Create Web Service**. Render will queue a deploy; once it completes you will have a URL such as `https://ai-travel-planner-backend.onrender.com`.
7. (Optional) Add a custom domain via the **Settings → Custom Domains** tab and follow the DNS instructions.


## 🖥️ Frontend Static Site

1. From the Render dashboard choose **New → Static Site**.
2. Select the same repository and branch.
3. Configure the static site:
   - **Name**: `ai-travel-planner-frontend`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/build`
   - **Environment Variables** (optional but useful):
     ```
     REACT_APP_API_URL=https://ai-travel-planner-backend.onrender.com
     REACT_APP_ENV=production
     REACT_APP_VERSION=1.0.0
     ```
4. Click **Create Static Site**; after build, your app will be live at a Render-generated URL.
5. (Optional) Add a custom domain from the site settings.


## 🗄️ Database Setup

Use MongoDB Atlas (or your own hosted cluster) just as described in the [Production Deployment Guide](PRODUCTION_DEPLOY.md#database-setup). Ensure the `MONGODB_URI` variable you supply to Render is correct and includes the username/password.


## 🔁 Backups & Cron Jobs

Render supports scheduled crons. You can create a Cron Job service that runs the `backup-database.sh` script periodically and pushes the archive to whichever storage provider you prefer (AWS S3, Google Cloud Storage, etc.).

## 📦 Deploy Updates

Every push to the selected branch triggers a new deployment for both services. Logs and build output are visible in the Render dashboard. Use `Webhook` notifications or the Render API to integrate with monitoring.


## ✅ Verification

- Visit the frontend URL and confirm the login page loads.
- Use `curl` or browser to hit `https://…/api/health` and expect a JSON status response.
- Log in, create an itinerary, and check it persists (MongoDB data).


---

Render simplifies the operational burden and replaces traditional VM-centric instructions (e.g. EC2). If you decide to move to a different provider later, consult the **Production Deployment Guide** for generic steps.