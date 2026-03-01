# Phase 2 Quick Start Guide

Get the AI Travel Planner up and running in 5 minutes!

## Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas URI)
- npm or yarn

## Quick Setup

### 1. Backend Setup (Terminal 1)

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ai-travel-planner
JWT_SECRET=your_secure_secret_key_here_change_in_production
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
EOF

# Start backend
npm run dev
```

**Expected Output:**
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
```

### 2. Frontend Setup (Terminal 2)

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start frontend
npm start
```

**Expected Output:**
```
Compiled successfully!
You can now view ai-travel-planner in the browser.
Local: http://localhost:3000
```

### 3. First Login

Open browser to `http://localhost:3000`

**Test Account:**
1. Click "Register"
2. Fill in form:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `password123`
   - Age: `22`
   - Companion Type: `Solo` (or your preference)
3. Click "Register"
4. You're automatically logged in! 🎉

## What to Try First

### Create Your First Itinerary
1. Click **"Plan Trip"** in the navigation
2. Fill in the form:
   - Budget: `$1500`
   - Dates: `2024-03-15 to 2024-03-22`
   - Destination: `Barcelona`
   - Companion Type: `Solo` (try different types!)
   - Number of Travelers: `1`
   - Choose activities (adventure, cultural, food, nature)
3. Click **"Generate My Itinerary"**
4. Explore the tabs:
   - 📊 Overview: Cost summary
   - 💰 Cost Breakdown: Detailed expenses
   - 📅 Day-by-Day: Daily schedule
   - 💡 Money Tips: Budget hacks
   - ✨ Recommendations: **NEW** - Companion-based suggestions!

### Save to History
- Click **"Save to History"** in the itinerary results
- Enter a title and tags
- Switch to **"History"** tab to see all your saved plans

### Explore Different Companion Types
1. Go back to **"Plan Trip"**
2. Create another itinerary with:
   - Companion Type: `Couple` (or `Friends Group` / `Family`)
   - Number of Travelers: `2` (or more)
3. Check the **Recommendations tab** to see different suggestions!

### Manage Your Profile
1. Click **"Profile"** in navigation
2. Click **"Edit Profile"**
3. Update your:
   - Travel preferences
   - Budget level
   - Interests
4. Click **"Save Changes"**

## Key Features to Explore

### ✅ Authentication
- Registration with travel preferences
- Secure login/logout
- Profile management

### ✅ Smart Recommendations
- **Best Time to Visit**: Seasonal data for destinations
- **Companion-Based Activities**: Customized for solo/couple/friends/family
- **Budget Tips**: Group-specific money-saving strategies

### ✅ Travel History
- Save unlimited itineraries
- Filter by status (draft, saved, completed, archived)
- Sort by date, destination, or budget
- Duplicate plans to modify easily

### ✅ Personalization
- Weather-based recommendations
- Group-size considerations
- Student discount integration

## Command Reference

### Backend Commands
```bash
npm start      # Production mode
npm run dev    # Development with auto-reload
npm test       # Run tests (if available)
```

### Frontend Commands
```bash
npm start      # Development mode (port 3000)
npm run build  # Create production build
npm test       # Run tests
npm run eject  # Advanced (not recommended)
```

## Environment Variables

### Backend (.env)
```
PORT=5000                                    # Server port
MONGODB_URI=mongodb://localhost:27017/db     # MongoDB connection
JWT_SECRET=your_secret_key                  # JWT signing key
FRONTEND_URL=http://localhost:3000          # CORS whitelist
NODE_ENV=development                        # Environment
```

### Frontend (.env) - Optional
```
REACT_APP_API_URL=http://localhost:5000    # Backend API address
REACT_APP_ENV=development                  # Environment
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000 (backend)
lsof -ti:5000 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### MongoDB Connection Error
```bash
# Start MongoDB (macOS with Homebrew)
brew services start mongodb-community

# Start MongoDB (Linux)
sudo systemctl start mongod

# Or use MongoDB Atlas (cloud)
# Update MONGODB_URI in .env with your Atlas connection string
```

### Clear Browser Cache
```bash
# Chrome DevTools: Ctrl+Shift+Delete
# Or clear localStorage manually:
localStorage.clear()
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Default Test Destinations

Itineraries work best with these destinations:
- Barcelona
- Denver
- Bangkok
- Paris
- Tokyo
- Amsterdam
- Bali
- New York

## API Testing (Optional)

### Test with cURL
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Copy the token from response, then:

# Generate Itinerary
curl -X POST http://localhost:5000/api/itinerary/generate \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "budget":1500,
    "travelDates":"2024-03-15 to 2024-03-22",
    "destination":"Barcelona",
    "travelCompanionType":"solo",
    "numberOfTravelers":1,
    "accommodation":"hostel",
    "transport":"bus"
  }'
```

## Next Steps

1. **Test All Features**: Try different companion types and destinations
2. **Review Recommendations**: Check how suggestions change by group type
3. **Save Plans**: Build your travel history
4. **Share Feedback**: Let us know what you'd like to see next!

## Useful Resources

- [MongoDB Local Setup](https://docs.mongodb.com/manual/installation/)
- [MongoDB Atlas (Cloud)](https://www.mongodb.com/cloud/atlas)
- [React Documentation](https://react.dev)
- [Express.js Guide](https://expressjs.com/)
- [JWT Tutorial](https://jwt.io/introduction)

## Support

Having issues? Check:
1. Browser console for errors (F12)
2. Backend terminal for error messages
3. MongoDB connection status
4. .env file configuration
5. Port availability

---

**Ready to explore?** Start the servers and visit `http://localhost:3000`! ✈️

For detailed information, see [PHASE_2_GUIDE.md](PHASE_2_GUIDE.md)
