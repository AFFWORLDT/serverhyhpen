#!/bin/bash

# Script to create GitHub repository and deploy to Vercel
echo "🚀 Setting up hyphenbackend repository and Vercel deployment"

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found. Please install it first:"
    echo "   brew install gh"
    echo "   or visit: https://cli.github.com/"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "✅ Prerequisites check passed"

# Create GitHub repository
echo "📦 Creating GitHub repository 'hyphenbackend'..."
gh repo create hyphenbackend --public --source=. --remote=origin --push

if [ $? -eq 0 ]; then
    echo "✅ GitHub repository created successfully!"
    echo "🔗 Repository URL: https://github.com/AFFWORLDT/hyphenbackend"
else
    echo "❌ Failed to create GitHub repository"
    exit 1
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo "🌐 Your backend will be available at the Vercel URL provided above"
