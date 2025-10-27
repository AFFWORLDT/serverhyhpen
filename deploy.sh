#!/bin/bash

echo "🚀 Deploying HypGym Backend to Multiple Platforms"
echo "=================================================="

# Environment variables
export MONGODB_URI="mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority"
export JWT_SECRET="4c05ff8b3007b64382ccc741bc66f1bb3108210bfe7ad6bc9a78c1d7addf384345037d20e343b20cef5c5ea91f0366518dc36c26a58e94ece54b462bd346dbfd"
export NODE_ENV="production"

echo "✅ Environment variables set"
echo "📦 Pushing to GitHub..."

# Push to GitHub
git add .
git commit -m "Add deployment configs for multiple platforms"
git push origin main

echo "✅ Code pushed to GitHub"
echo ""
echo "🌐 Deployment Options:"
echo "1. Railway: https://railway.app - Connect GitHub repo"
echo "2. Render: https://render.com - Connect GitHub repo" 
echo "3. Heroku: https://heroku.com - Connect GitHub repo"
echo "4. DigitalOcean App Platform: https://cloud.digitalocean.com/apps"
echo ""
echo "📋 Environment Variables to set:"
echo "MONGODB_URI=$MONGODB_URI"
echo "JWT_SECRET=$JWT_SECRET"
echo "NODE_ENV=$NODE_ENV"
echo ""
echo "🎯 Your backend is ready for deployment!"
