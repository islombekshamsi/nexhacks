# Deploy to Railway - Quick Guide

Your code is ready at: https://github.com/Shanzita/neuro-monitor

## 5-Minute Deployment Steps

### 1. Go to Railway
Open: https://railway.app

### 2. Login with GitHub
- Click "Login with GitHub"
- Authorize Railway to access your GitHub

### 3. Create New Project
- Click "New Project"
- Select "Deploy from GitHub repo"
- Find and select: `Shanzita/neuro-monitor`
- Click to deploy

### 4. Add Environment Variables
Once deployed, click on your project, then:
- Click "Variables" tab
- Click "New Variable" and add these 3:

```
ELEVENLABS_API_KEY
sk_2790eec6ab329a261b2790c4c7fb107fec1d01080a257161

OVERSHOOT_API_KEY
ovs_93df94a8870c6d170f1f0827916d77ce

PORT
3000
```

### 5. Generate Domain
- Go to "Settings" tab
- Click "Generate Domain"
- Your app will be live at: `https://neuro-monitor-production.up.railway.app` (or similar)

### 6. Open Your App
- Click the generated domain URL
- Allow webcam access when prompted
- Done! 🎉

---

## What You'll See

✅ Build logs (2-3 minutes)
✅ Deployment successful
✅ Live URL ready to use

---

## Testing Your Deployed App

1. Click the Railway-generated URL
2. Allow webcam + microphone permissions
3. You should see:
   - Webcam feed
   - Live pupil tracking graphs
   - "Start Interrogation" button
4. Click "Start Interrogation" to test voice questions

---

## Troubleshooting

**Build fails:**
- Check environment variables are set correctly
- View deployment logs in Railway dashboard

**App doesn't load:**
- Wait 30 seconds for cold start
- Check Railway logs for errors

**Webcam doesn't work:**
- Make sure you're using HTTPS (Railway provides this automatically)
- Check browser permissions

---

## Cost

Railway offers:
- $5/month free credit
- This app uses ~$0.50-1/month
- You're well within free tier limits

---

**Ready to deploy? Open https://railway.app now!**
