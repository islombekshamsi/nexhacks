#!/bin/bash
# Railway Deployment Script for Neuro Monitor

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Neuro Monitor - Railway Deployment                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
else
    echo "✅ Railway CLI is installed (version: $(railway --version))"
fi

echo ""
echo "Step 1: Login to Railway"
echo "A browser window will open for authentication..."
echo ""
railway login

echo ""
echo "Step 2: Initialize Railway project"
echo ""
railway init

echo ""
echo "Step 3: Setting environment variables..."
echo ""
railway variables set ELEVENLABS_API_KEY=sk_2790eec6ab329a261b2790c4c7fb107fec1d01080a257161
railway variables set OVERSHOOT_API_KEY=ovs_93df94a8870c6d170f1f0827916d77ce
railway variables set PORT=3000
railway variables set PHOENIX_ENDPOINT=http://localhost:6006

echo ""
echo "✅ Environment variables configured"
echo ""
echo "Step 4: Deploying to Railway..."
echo ""
railway up

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              Deployment Complete! 🎉                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Your app is now live! To open it in browser:"
echo "  railway open"
echo ""
echo "To view logs:"
echo "  railway logs"
echo ""
echo "To view deployment info:"
echo "  railway status"
echo ""
