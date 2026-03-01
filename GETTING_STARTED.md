# 🚀 Getting Started with AI Travel Planner for Students

Complete guide to setting up, running, and using the AI Travel Planner application.

## 📋 Prerequisites

Before you start, make sure you have:
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, for version control)
- A code editor (VS Code, Sublime, etc.)
- A terminal/command prompt

### Verify Installation
```bash
node --version  # Should show v14.0.0 or higher
npm --version   # Should show a version number
```

## 📁 Project Structure

```
Ai_Travel_Planner/
├── backend/                    # Express API server
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── README.md
├── frontend/                   # React application
│   ├── src/
│   │   ├── App.js
│   │   ├── components/
│   │   ├── styles/
│   │   └── index.js
│   ├── public/
│   ├── package.json
│   └── README.md
├── README.md                   # Main project README
├── EXAMPLES.js                 # API usage examples
├── TEST_CASES.js               # Test cases for validation
└── GETTING_STARTED.md          # This file
```

## 🎯 Step-by-Step Setup

### Step 1: Navigate to Project Directory
```bash
cd c:\Ai_Travel_Planner
```

Or on macOS/Linux:
```bash
cd ~/Ai_Travel_Planner
```

### Step 2: Setup Backend

Open first terminal window:

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Start the server
npm run dev
```

You should see:
```
Server running on port 5000
```

**Note:** Keep this terminal open - the backend needs to run continuously.

### Step 3: Setup Frontend

Open a new terminal window (keep the first one running):

```bash
# Navigate to frontend (from project root)
cd frontend

# Install dependencies
npm install

# Start the application
npm start
```

You should see:
```
Compiled successfully!
You can now view ai-travel-planner-frontend in the browser.

Local:            http://localhost:3000
```

The application will automatically open in your default browser.

## ✅ Verification Checklist

- [ ] Backend terminal shows "Server running on port 5000"
- [ ] Frontend terminal shows "Compiled successfully!"
- [ ] Browser opens to http://localhost:3000
- [ ] You can see the AI Travel Planner interface

If everything is working, you should see:
1. Header with "✈️ AI Travel Planner for Students"
2. Input form for travel details
3. Submit button that's ready to click

## 🧪 Testing the Application

### Test 1: Basic Trip Planning

1. **Fill the form with:**
   - Budget: `1500`
   - Travel Dates: `2024-06-15 to 2024-06-22`
   - Start Location: `New York`
   - Destination: `Barcelona`
   - Activities: Select "Cultural" and "Food"
   - Accommodation: Select "Hostel"
   - Transport: Select "Flight"

2. **Click "✈️ Generate My Itinerary"**

3. **Expected Results:**
   - Should show cost summary within budget
   - Should display 8 days of itinerary
   - Should show money-saving tips
   - Tabs should be clickable

### Test 2: Over Budget Scenario

1. **Fill the form with:**
   - Budget: `500`
   - Travel Dates: `2024-07-01 to 2024-07-15`
   - Start Location: `Los Angeles`
   - Destination: `New York`
   - All other fields as normal

2. **Expected Results:**
   - Should show ⚠️ warning in budget status
   - Should display alternative plans
   - Should suggest cost-saving options

### Test 3: Short Trip

1. **Fill the form with:**
   - Budget: `300`
   - Travel Dates: `2024-03-15 to 2024-03-17`
   - Start Location: `Boston`
   - Destination: `New York`
   - Activities: Select "Cultural"
   - Accommodation: Hostel
   - Transport: Bus

2. **Expected Results:**
   - Should calculate 3-day itinerary
   - Should allocate budget across categories
   - Should show money tips

## 🗂️ File Descriptions

### Key Backend Files

**`backend/src/index.js`**
- Express server setup
- Port configuration
- CORS settings
- Route initialization

**`backend/src/services/planner.js`**
- Core AI planning logic
- Budget allocation algorithm
- Activity recommendation engine
- Cost estimation
- Itinerary generation

**`backend/src/routes/itinerary.js`**
- POST /api/itinerary endpoint
- Request handling
- Response formatting

**`backend/src/utils/helpers.js`**
- Utility functions
- Distance calculations
- Date validation
- Formatting functions

### Key Frontend Files

**`frontend/src/App.js`**
- Main application component
- State management
- API communication
- Loading and error handling

**`frontend/src/components/ItineraryForm.js`**
- User input form
- Form validation
- Activity selection
- Field validation

**`frontend/src/components/ItineraryDisplay.js`**
- Results display
- Tabbed interface
- Cost breakdown visualization
- Expandable sections

**`frontend/src/styles/*.css`**
- Complete styling
- Responsive design
- Color scheme
- Animations

## 🔧 Troubleshooting

### Backend Won't Start

**Error:** `Port 5000 is already in use`
```bash
# Windows: Find and kill the process
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux: Find and kill the process
lsof -i :5000
kill -9 <PID>
```

**Error:** `Cannot find module`
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Frontend Won't Start

**Error:** `Port 3000 is already in use`
```bash
# Port will change to 3001 automatically, or:
# Kill port 3000 and restart
```

**Error:** `Cannot GET http://localhost:5000/api/itinerary`
- Ensure backend is running on port 5000
- Check that you're not behind a corporate proxy
- Try accessing backend directly in browser

### Form Won't Submit

**Symptom:** Button clicks but nothing happens
- Check browser console (F12 > Console)
- Verify backend is running
- Check network tab to see API request
- Ensure all required fields are filled

**Symptom:** "Failed to fetch itinerary" error
- Start backend: `npm run dev` in backend folder
- Wait 5 seconds for it to start
- Try submitting form again

### Wrong Date Format

**Error:** Invalid dates
- Format must be exactly: `YYYY-MM-DD to YYYY-MM-DD`
- Examples:
  - ✓ `2024-06-15 to 2024-06-22`
  - ✗ `06/15/2024 to 06/22/2024`
  - ✗ `June 15, 2024 to June 22, 2024`

## 📱 How to Use the Application

### 1. Input Your Travel Details

Fill in all required fields:
- **Budget**: Your total money (in USD)
- **Travel Dates**: Start and end dates
- **Locations**: Where you're going
- **Activity Preferences**: Choose what interests you
- **Accommodation**: Select your comfort level
- **Transport**: Choose preferred travel method

### 2. Click Generate

Press "✈️ Generate My Itinerary" button

Wait for the AI to process (usually 1-2 seconds)

### 3. Review Results

The application shows 5 tabs:

**📊 Overview Tab**
- Quick cost summary
- Accommodation details
- Daily meal costs
- Money-saving tips

**💰 Cost Breakdown Tab**
- Detailed expense analysis
- Per-category breakdown
- Budget comparison chart

**📅 Day-by-Day Tab**
- Click each day to expand
- See daily activities
- Plan your schedule

**💡 Money Tips Tab**
- 15+ student-focused tips
- Cost-saving strategies
- How to save 30-50%

**🔄 Alternatives Tab** (if budget exceeded)
- Shorter trip option
- Budget-focused option
- Alternative destination

## 💡 Tips for Best Results

1. **Be Realistic with Budget**
   - Minimum recommended: $50/day
   - Comfortable: $75-100/day
   - Comfortable+: $150+/day

2. **Select Multiple Activities**
   - Choose 2-3 categories
   - More variety = better recommendations

3. **Use Standard Cities**
   - Major cities have better cost data
   - Similar names work too

4. **Check the Feedback**
   - ⚠️ means budget is tight
   - ✅ means you're well within budget
   - Look at alternatives if needed

5. **Try Different Combinations**
   - Adjust transport mode
   - Try different accommodation
   - Change activity preferences

## 📊 Understanding Your Itinerary

### Cost Summary
Shows where your money goes:
- 🛫 Transport: Getting there
- 🏨 Accommodation: Where to sleep
- 🍽️ Food: What to eat
- 🎭 Activities: What to do
- 🎒 Miscellaneous: Emergency funds

### Budget Status
- ✅ **Within Budget**: Cost < Your Budget
- ⚠️ **Over Budget**: Cost > Your Budget
  - Consider alternatives
  - Reduce trip length
  - Choose cheaper accommodation

### Daily Plans
- **Day 1**: Arrival day (check-in)
- **Day 2-N**: Suggested activities
- **Last Day**: Departure day

## 🎓 Student Benefits

- **15-25% Automatic Discounts** on all modes of transport
- **Budget-Friendly Recommendations** for everything
- **Group Travel Tips** for sharing costs
- **Free Activity Ideas** for minimal spending

## 🔌 API Reference

### Quick API Test

```bash
# Using curl (Windows PowerShell)
curl -X POST http://localhost:5000/api/itinerary `
  -H "Content-Type: application/json" `
  -d '{"budget":"1500","travelDates":"2024-06-15 to 2024-06-22","startLocation":"New York","destination":"Barcelona","activities":"cultural","accommodation":"hostel","transport":"flight"}'
```

Or using the JavaScript examples in `EXAMPLES.js`

## 📝 Keep Servers Running

For the application to work:
- ✅ Backend (port 5000) - must be running
- ✅ Frontend (port 3000) - must be running

Never close either terminal while using the application.

## 🛠️ Developer Information

### Backend Technology
- Node.js with Express
- REST API architecture
- JSON data format
- No database required

### Frontend Technology
- React 18
- Modern CSS3
- Responsive design
- Axios for API calls

### Development Tools
- Code Editor: VS Code recommended
- Package Manager: npm
- Development Server: Create React App
- Auto-reload: Nodemon (backend)

## 📚 Additional Resources

**Frontend README**: `frontend/README.md`
- Component documentation
- Styling guide
- Customization tips

**Backend README**: `backend/README.md`
- API documentation
- Cost databases
- Algorithm explanation

**Examples**: `EXAMPLES.js`
- Sample trips
- API usage
- Test scenarios

**Test Cases**: `TEST_CASES.js`
- Validation cases
- Expected results
- Test frameworks

## 🎉 You're Ready to Go!

Your AI Travel Planner is now running. Start by:

1. Filling in a sample trip
2. Clicking generate
3. Exploring different tabs
4. Reading the money-saving tips
5. Trying alternative scenarios

## 📞 Support & Troubleshooting

**Still having issues?**

1. Check the troubleshooting section above
2. Review the README files in backend/ and frontend/
3. Look at EXAMPLES.js for working examples
4. Check browser console (F12) for error messages
5. Verify both servers are running

**Tips for debugging:**
- Use browser DevTools (F12)
- Check Network tab for API requests
- Look at Console tab for errors
- Test backend directly with curl

---

**Happy Planning! 🌍 Travel Smart, Travel Far**

For more information, see the main [README.md](README.md)
