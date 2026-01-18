#!/bin/bash
# GitHub Repository Setup Script

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         GitHub Repository Setup                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found. Installing..."
    brew install gh
fi

echo "Step 1: Login to GitHub"
echo "A browser window will open for authentication..."
echo ""
gh auth login

echo ""
echo "Step 2: Create GitHub repository"
echo ""
gh repo create neuro-monitor \
    --public \
    --source=. \
    --description="Dual-mode neuro change monitor with pupil tracking and voice assessment" \
    --push

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              Repository Created! 🎉                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Your repository is now live at:"
gh repo view --web
echo ""
echo "Next steps:"
echo "  1. Run ./deploy.sh to deploy to Railway"
echo "  2. Or deploy via Railway dashboard using your GitHub repo"
echo ""
