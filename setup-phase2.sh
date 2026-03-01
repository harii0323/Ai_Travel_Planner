#!/bin/bash
# Phase 2 Setup Script
# Automated setup for AI Travel Planner Phase 2

set -e

echo "🚀 AI Travel Planner - Phase 2 Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v14+ first."
    exit 1
fi

echo -e "${BLUE}✓ Node.js detected: $(node -v)${NC}"
echo ""

# Backend Setup
echo -e "${BLUE}Setting up Backend...${NC}"
cd backend

if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
else
    echo "✓ Backend dependencies already installed"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️  Creating backend .env file..."
    cat > .env << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ai-travel-planner
JWT_SECRET=your_secure_secret_key_here_change_in_production
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
EOF
    echo "✓ Created .env file"
    echo "⚠️  Remember to update JWT_SECRET for production!"
else
    echo "✓ .env file already exists"
fi

cd ..
echo ""

# Frontend Setup
echo -e "${BLUE}Setting up Frontend...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
else
    echo "✓ Frontend dependencies already installed"
fi

cd ..
echo ""

# MongoDB Check
echo -e "${BLUE}Checking MongoDB...${NC}"
if command -v mongod &> /dev/null; then
    echo "✓ MongoDB CLI detected"
    echo "  Start MongoDB with: mongod"
else
    echo "⚠️  MongoDB not found in PATH"
    echo "  You can:"
    echo "  1. Install MongoDB (https://docs.mongodb.com/manual/installation/)"
    echo "  2. Use MongoDB Atlas (https://www.mongodb.com/cloud/atlas)"
    echo ""
fi

echo ""
echo -e "${GREEN}✨ Setup Complete!${NC}"
echo ""
echo "📖 Next Steps:"
echo "=============="
echo ""
echo "1. Start MongoDB (if using local):"
echo "   ${YELLOW}mongod${NC}"
echo ""
echo "2. In Terminal 1 - Start Backend:"
echo "   ${YELLOW}cd backend && npm run dev${NC}"
echo ""
echo "3. In Terminal 2 - Start Frontend:"
echo "   ${YELLOW}cd frontend && npm start${NC}"
echo ""
echo "4. Open browser:"
echo "   ${YELLOW}http://localhost:3000${NC}"
echo ""
echo "5. Register & explore Phase 2 features!"
echo ""
echo "📚 Documentation:"
echo "  - Quick Start: ${YELLOW}PHASE_2_QUICKSTART.md${NC}"
echo "  - Full Guide: ${YELLOW}PHASE_2_GUIDE.md${NC}"
echo "  - File Structure: ${YELLOW}PHASE_2_FILE_STRUCTURE.md${NC}"
echo ""
echo "🎉 Happy Planning! ✈️"
echo ""
