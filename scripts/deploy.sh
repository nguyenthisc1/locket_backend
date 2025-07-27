#!/bin/bash

# Locket Backend Deployment Script for Render
# This script helps prepare and verify deployment

set -e

echo "🚀 Locket Backend Deployment Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if render.yaml exists
if [ ! -f "render.yaml" ]; then
    echo "❌ Error: render.yaml not found. Please create the Render configuration first."
    exit 1
fi

echo "✅ Project structure verified"

# Check for required environment variables
echo ""
echo "📋 Environment Variables Check:"
echo "==============================="

required_vars=(
    "MONGODB_URI"
    "JWT_SECRET"
    "CLOUDINARY_CLOUD_NAME"
    "CLOUDINARY_API_KEY"
    "CLOUDINARY_API_SECRET"
    "CORS_ORIGIN"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
        echo "❌ $var - NOT SET"
    else
        echo "✅ $var - SET"
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo ""
    echo "⚠️  Warning: The following environment variables are not set:"
    printf '   - %s\n' "${missing_vars[@]}"
    echo ""
    echo "Please set these in your Render dashboard before deployment."
    echo ""
fi

# Check package.json scripts
echo ""
echo "📦 Package.json Scripts Check:"
echo "=============================="

if grep -q '"start"' package.json; then
    echo "✅ start script found"
else
    echo "❌ start script missing"
fi

if grep -q '"build"' package.json; then
    echo "✅ build script found"
else
    echo "⚠️  build script not found (not required for Node.js apps)"
fi

# Check for main entry point
if [ -f "src/index.js" ]; then
    echo "✅ Main entry point (src/index.js) found"
else
    echo "❌ Main entry point (src/index.js) not found"
fi

# Check for health endpoint
if grep -q "/api/health" src/index.js; then
    echo "✅ Health check endpoint (/api/health) found"
else
    echo "❌ Health check endpoint (/api/health) not found"
fi

echo ""
echo "🎯 Deployment Checklist:"
echo "========================"
echo "1. ✅ Push code to GitHub repository"
echo "2. ✅ Create Render account"
echo "3. ✅ Connect GitHub repository to Render"
echo "4. ⚠️  Set environment variables in Render dashboard"
echo "5. ⚠️  Configure MongoDB database"
echo "6. ⚠️  Update CORS_ORIGIN to your frontend domain"
echo "7. ⚠️  Test deployment"

echo ""
echo "📚 Next Steps:"
echo "=============="
echo "1. Go to https://dashboard.render.com"
echo "2. Click 'New' → 'Blueprint'"
echo "3. Connect your GitHub repository"
echo "4. Set environment variables"
echo "5. Deploy!"

echo ""
echo "🔗 Useful Links:"
echo "================"
echo "• Render Dashboard: https://dashboard.render.com"
echo "• MongoDB Atlas: https://www.mongodb.com/atlas"
echo "• Cloudinary: https://cloudinary.com"
echo "• Deployment Guide: DEPLOYMENT.md"

echo ""
echo "✨ Deployment script completed!" 