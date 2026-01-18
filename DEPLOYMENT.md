# Deployment Guide

This guide will help you deploy the Neuro Change Monitor to Railway.

## Option 1: Deploy via Railway Dashboard (Easiest)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (recommended) or email
3. Verify your account

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account
4. Push this code to a GitHub repository first:
   ```bash
   # Create a new repo on GitHub, then:
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR-USERNAME/neuro-monitor.git
   git push -u origin main
   ```
5. Select your repository in Railway

### Step 3: Configure Environment Variables
In Railway dashboard, go to your project > Variables tab and add:

```
ELEVENLABS_API_KEY=sk_2790eec6ab329a261b2790c4c7fb107fec1d01080a257161
OVERSHOOT_API_KEY=ovs_93df94a8870c6d170f1f0827916d77ce
PORT=3000
PHOENIX_ENDPOINT=http://localhost:6006
```

### Step 4: Deploy
- Railway will auto-deploy
- Wait 2-3 minutes for build
- Click "Open App" to view your deployed site

---

## Option 2: Deploy via Railway CLI (Advanced)

### Step 1: Install Railway CLI
```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Or with npm
npm install -g @railway/cli
```

### Step 2: Login to Railway
```bash
railway login
```

### Step 3: Initialize Project
```bash
railway init
```

### Step 4: Add Environment Variables
```bash
railway variables set ELEVENLABS_API_KEY=sk_2790eec6ab329a261b2790c4c7fb107fec1d01080a257161
railway variables set OVERSHOOT_API_KEY=ovs_93df94a8870c6d170f1f0827916d77ce
railway variables set PORT=3000
railway variables set PHOENIX_ENDPOINT=http://localhost:6006
```

### Step 5: Deploy
```bash
railway up
```

### Step 6: Open Your App
```bash
railway open
```

---

## Option 3: Deploy to Render (Alternative)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub

### Step 2: Create New Web Service
1. Click "New +" > "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: neuro-monitor
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free

### Step 3: Add Environment Variables
In the "Environment" section, add:
- `ELEVENLABS_API_KEY`
- `OVERSHOOT_API_KEY`
- `PORT` (set to 3000)
- `PHOENIX_ENDPOINT`

### Step 4: Deploy
- Click "Create Web Service"
- Wait for deployment (2-5 minutes)

---

## Important Notes

### 1. HTTPS Required for Webcam
- Most hosting platforms provide HTTPS automatically
- Browsers require HTTPS to access webcam (except localhost)
- Railway and Render both provide free SSL certificates

### 2. WebSocket Support
- Railway: ✅ Full support
- Render: ✅ Full support
- Vercel/Netlify: ❌ Not recommended (limited WebSocket support)

### 3. Environment Variables
- **NEVER** commit `.env` file to git
- Always use platform's environment variable settings
- API keys are already in `.env` for local development

### 4. Custom Domain (Optional)
- Railway: Settings > Domains > Add Custom Domain
- Render: Settings > Custom Domain

### 5. Cost
- **Railway**: Free tier with $5/month credit (enough for this app)
- **Render**: Free tier with 750 hours/month
- **Both**: Upgrade if you need more resources

---

## Post-Deployment Checklist

After deployment, verify:

1. ✅ App loads at the provided URL
2. ✅ Webcam permission prompt appears
3. ✅ Can see video feed
4. ✅ Graphs update in real-time
5. ✅ "Start Interrogation" button works
6. ✅ Voice questions play
7. ✅ Speech recognition captures answers
8. ✅ Alerts appear and can be acknowledged

---

## Troubleshooting

### App crashes on startup
- Check environment variables are set correctly
- View logs: `railway logs` or in Render dashboard

### Webcam doesn't work
- Ensure app is accessed via HTTPS
- Check browser permissions

### WebSocket connection fails
- Verify hosting platform supports WebSockets
- Check firewall settings

### No audio in interrogation mode
- ElevenLabs API key might be invalid
- Check browser audio permissions
- View network tab for API errors

---

## Monitoring

### Railway
- View logs: `railway logs -f`
- View metrics in dashboard

### Render
- Logs available in dashboard
- Set up alerts for crashes

---

## Support

If you encounter issues:
1. Check server logs
2. Check browser console (F12)
3. Verify environment variables
4. Test locally first with `npm start`
