# Phase 2 Implementation - Database & Authentication

## Overview
Phase 2 enhances the AI Travel Planner with MongoDB database integration, user authentication, travel history storage, and intelligent companion-based recommendations.

## New Features & Components

### 1. **User Authentication System**
- **Registration & Login**: Users can create accounts and securely log in
- **Password Security**: Passwords are hashed using bcryptjs (async, 12-round salt)
- **JWT Authentication**: 7-day token expiration for secure API access
- **Profile Management**: Users can update their travel preferences and companion type

### 2. **Travel History Storage**
- Save generated itineraries for future reference
- Organize plans with titles, descriptions, and tags
- Track multiple trips per user
- Manage trip status (draft, saved, completed, archived)

### 3. **Intelligent Companion-Based Recommendations**
The planner now provides tailored suggestions based on who you're traveling with:
- **Solo Travelers**: Flexibility, budget-conscious activities, hostel lifestyle
- **Couples**: Romantic experiences, peaceful settings, intimate activities
- **Friends Groups**: Adventure activities, nightlife, group sports, party vibes
- **Families**: Kid-friendly attractions, educational experiences, safe environments
- **Large Groups**: Cost negotiations for bulk activities, team coordination tips

### 4. **Smart Recommendations Include**
- **Best Time to Visit**: Season recommendations based on companion type
- **Activity Suggestions**: Activities suited for your group composition
- **Budget Tips**: Cost-saving strategies specific to your travel situation
- **Safety Tips**: Tailored safety advice for your companion type

---

## API Endpoints

### **Authentication Routes** (`/api/auth`)

#### Register New User
```
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "travelPreferences": {
    "companionType": "couple",  // solo, couple, friends, family, large-group
    "preferredActivities": "hiking,cultural,food",
    "budgetLevel": "low"
  }
}

Response (201):
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}

Response (200):
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### Get User Profile
```
GET /api/auth/profile
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "travelPreferences": {
      "companionType": "couple",
      "preferredActivities": "hiking,cultural,food",
      "budgetLevel": "low"
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Update Profile
```
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "travelPreferences": {
    "companionType": "family",
    "preferredActivities": "nature,family-friendly",
    "budgetLevel": "medium"
  }
}

Response (200):
{
  "success": true,
  "message": "Profile updated successfully",
  "user": { ... }
}
```

#### Logout
```
POST /api/auth/logout
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### **Itinerary Routes** (`/api/itinerary`)

#### Generate Itinerary with Recommendations
```
POST /api/itinerary/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "destination": "Paris",
  "startLocation": "New York",
  "budget": 2000,
  "dates": {
    "startDate": "2024-06-01",
    "endDate": "2024-06-10"
  },
  "accommodation": "budgetHotel",
  "transport": "flight",
  "activities": "cultural,food",
  "travelCompanionType": "couple",
  "numberOfTravelers": 2
}

Response (200):
{
  "success": true,
  "itinerary": {
    "summary": { ... },
    "details": { ... },
    "dayPlans": [...],
    "recommendations": {
      "companionSuggestions": [
        "🌙 Book romantic sunset tours...",
        "💑 Visit couples-friendly spas..."
      ],
      "bestTime": {
        "season": "Shoulder season (May-June, September-October)",
        "reason": "Perfect weather with fewer tourists",
        "priceLevel": "medium"
      },
      "groupActivities": [
        "Romantic dinner tours",
        "Couples spa treatments",
        "Scenic walks..."
      ],
      "budgetTips": [
        "Share accommodation to reduce costs",
        "Look for couples discounts..."
      ],
      "safetyTips": [...]
    },
    "estimatedCosts": { ... },
    "moneyTips": [...]
  }
}
```

#### Save Itinerary to History
```
POST /api/itinerary/save
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Summer Paris Trip with Partner",
  "description": "10-day romantic getaway to Paris",
  "itineraryData": { ... },
  "plannedTravelDate": "2024-06-01",
  "tags": ["romantic", "paris", "budget"]
}

Response (201):
{
  "success": true,
  "message": "Itinerary saved to history",
  "itinerary": {
    "id": "507f1f77bcf86cd799439012",
    "title": "Summer Paris Trip with Partner",
    "destination": "Paris",
    "totalDays": 10,
    "estimatedCost": 1950,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### **History Routes** (`/api/history`)

#### List All Saved Itineraries
```
GET /api/history?status=saved&destination=Paris&sort=newest
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "count": 3,
  "itineraries": [
    {
      "id": "507f1f77bcf86cd799439012",
      "title": "Summer Paris Trip with Partner",
      "destination": "Paris",
      "startDate": "2024-06-01",
      "endDate": "2024-06-10",
      "totalDays": 10,
      "budget": 2000,
      "estimatedCost": 1950,
      "travelCompanionType": "couple",
      "numberOfTravelers": 2,
      "status": "saved",
      "tags": ["romantic", "paris", "budget"],
      "createdAt": "2024-01-15T10:30:00Z"
    },
    ...
  ]
}
```

Query Parameters:
- `status`: Filter by status (draft, saved, completed, archived)
- `destination`: Filter by destination (case-insensitive)
- `sort`: Sort by date (newest/oldest, default: newest)

#### Get Specific Itinerary
```
GET /api/history/:id
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "itinerary": {
    "id": "507f1f77bcf86cd799439012",
    "title": "Summer Paris Trip with Partner",
    "destination": "Paris",
    "dayPlans": [...],
    "recommendations": {...},
    "moneyTips": [...],
    ...
  }
}
```

#### Update Itinerary Metadata
```
PUT /api/history/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "completed",
  "tags": ["romantic", "paris", "completed"],
  "plannedTravelDate": "2024-06-01"
}

Response (200):
{
  "success": true,
  "message": "Itinerary updated successfully",
  "itinerary": { ... }
}
```

#### Delete Itinerary
```
DELETE /api/history/:id
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "message": "Itinerary deleted successfully"
}
```

#### Duplicate Itinerary
```
POST /api/history/duplicate/:id
Authorization: Bearer <token>

Response (201):
{
  "success": true,
  "message": "Itinerary duplicated successfully",
  "itinerary": {
    "id": "507f1f77bcf86cd799439013",
    "title": "Summer Paris Trip with Partner (Copy)",
    "destination": "Paris"
  }
}
```

---

## Database Schemas

### User Schema (`models/User.js`)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (hashed with bcryptjs),
  travelPreferences: {
    companionType: String (solo|couple|friends|family|large-group),
    preferredActivities: String,
    budgetLevel: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Itinerary Schema (`models/Itinerary.js`)
```javascript
{
  userId: ObjectId (reference to User),
  title: String,
  description: String,
  destination: String,
  startLocation: String,
  startDate: Date,
  endDate: Date,
  totalDays: Number,
  budget: Number,
  estimatedCost: Number,
  withoutBudget: Boolean,
  activities: [String],
  accommodation: String,
  transport: String,
  travelCompanionType: String,
  numberOfTravelers: Number,
  estimatedCosts: {
    mainTransport: Number,
    accommodation: Number,
    food: Number,
    activities: Number,
    miscellaneous: Number,
    total: Number
  },
  dayPlans: Array,
  moneyTips: [String],
  recommendations: {
    companionSuggestions: [String],
    bestTime: { season, reason, priceLevel },
    groupActivities: [String],
    budgetTips: [String],
    safetyTips: [String]
  },
  status: String (draft|saved|completed|archived),
  tags: [String],
  plannedTravelDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Files Created/Modified in Phase 2

### New Files Created:
1. **`backend/src/models/User.js`** - User schema with password hashing
2. **`backend/src/models/Itinerary.js`** - Itinerary schema with recommendations
3. **`backend/src/middleware/authenticate.js`** - JWT middleware for protected routes
4. **`backend/src/routes/auth.js`** - Authentication endpoints (register, login, profile, logout)
5. **`backend/src/routes/history.js`** - History management endpoints (save, list, get, update, delete, duplicate)
6. **`backend/.env.example`** - Environment configuration template

### Modified Files:
1. **`backend/package.json`** - Added dependencies: mongoose, bcryptjs, jsonwebtoken, express-validator
2. **`backend/src/index.js`** - Added MongoDB connection, imported new routes
3. **`backend/src/routes/itinerary.js`** - Added /generate endpoint with recommendations, /save endpoint
4. **`backend/src/services/planner.js`** - Added generateRecommendations() function with companion-based logic

---

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the backend directory:
```
MONGODB_URI=mongodb://localhost:27017/ai-travel-planner
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
PORT=5000
```

### 3. Start MongoDB
```bash
# Using MongoDB locally
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

### 4. Start the Backend Server
```bash
npm start
# or for development with auto-reload
npm run dev
```

### 5. Test the Endpoints
Use Postman or curl to test the endpoints. Example:
```bash
# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Generate itinerary with recommendations
curl -X POST http://localhost:5000/api/itinerary/generate \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Paris",
    "startLocation": "New York",
    "budget": 2000,
    "dates": {"startDate": "2024-06-01", "endDate": "2024-06-10"},
    "accommodation": "budgetHotel",
    "transport": "flight",
    "activities": "cultural,food",
    "travelCompanionType": "couple",
    "numberOfTravelers": 2
  }'
```

---

## Companion-Based Recommendations Details

### Solo Travelers
- **Best Time**: Any season (full flexibility)
- **Key Tips**: Hostel social events, meet other travelers, budget airlines, free walking tours
- **Activities**: Solo hiking, cultural experiences, adventure sports
- **Budget**: Lowest - shared accommodation, solo discounts

### Couples
- **Best Time**: Shoulder season (May-June, Sept-Oct) for romance and fewer crowds
- **Key Tips**: Romantic experiences, peaceful settings, sunset tours, couples spas
- **Activities**: Dinner tours, scenic walks, intimate settings
- **Budget**: Medium - shared costs, couples discounts, romantic dinners

### Friend Groups
- **Best Time**: Peak season (Dec-Jan, Jul-Aug) when activities are bustling
- **Key Tips**: Adventure activities, nightlife, group sports, party vibes
- **Activities**: Hiking, bar crawls, escape rooms, cooking classes, team games
- **Budget**: Medium-High - split costs among friends, look for group discounts

### Families
- **Best Time**: School holidays (summer, winter breaks)
- **Key Tips**: Kid-friendly attractions, educational experiences, safe environments
- **Activities**: Theme parks, zoos, beaches, museums, outdoor camping
- **Budget**: Medium-High - family packages, free attractions, market food

### Large Groups (6+ people)
- **Best Time**: Off-season (May-June, Sept-Oct) for better rates and availability
- **Key Tips**: Negotiate bulk discounts, group coordination, shared accommodation
- **Activities**: Group camping, team sports, large dinners, sightseeing tours
- **Budget**: Low-Medium - negotiated group rates, shared transportation

---

## Security Features

### Password Security
- Passwords hashed using bcryptjs (Blowfish algorithm, 12-round salt)
- Passwords NEVER stored in plain text or returned in API responses
- Async hashing prevents blocking operations

### JWT Token Security
- 7-day expiration for security and convenience
- Tokens include user ID for authorization checks
- Token required for all protected endpoints
- Invalid tokens return 401 Unauthorized

### Data Access Control
- Users can only access/modify their own itineraries
- Ownership verification on all protected endpoints
- Proper 403 Forbidden responses for unauthorized access

### Middleware Protection
- `authenticate.js` middleware validates JWT tokens
- Extracts user information for authorization checks
- Graceful error handling for invalid/expired tokens

---

## Future Enhancements

1. **Frontend Authentication UI**
   - Login/registration forms
   - JWT token storage in localStorage
   - Protected route handling

2. **Advanced Recommendations**
   - Machine learning for personalized suggestions
   - User rating system for activities
   - Community recommendations

3. **Collaborative Planning**
   - Share itineraries with group members
   - Real-time collaboration
   - Comments and notes on plans

4. **Payment Integration**
   - Book activities directly
   - Hotel reservations
   - Flight bookings

5. **Mobile App**
   - React Native mobile application
   - Offline itinerary access
   - GPS-based activity finder

---

## Troubleshooting

### MongoDB Connection Failed
- Ensure MongoDB is running on `localhost:27017`
- Check `MONGODB_URI` in `.env` file
- Verify MongoDB is installed: `mongod --version`

### JWT Token Errors
- Ensure `JWT_SECRET` is set in `.env`
- Check token is being passed in Authorization header
- Tokens expire after 7 days - user needs to login again

### CORS Errors
- Verify `FRONTEND_URL` in `.env` matches your frontend URL
- Check frontend is running on the correct port
- Clear browser cache and cookies

### Port Already in Use
- Change `PORT` in `.env` file
- Or kill existing process: `lsof -i :5000` (Mac/Linux) or `netstat -ano | findstr :5000` (Windows)

---

## Support & Development

For issues or feature requests, refer to the main README.md or the GETTING_STARTED.md guide.
