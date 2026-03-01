# ✈️ AI Travel Planner for Students

An intelligent, budget-optimized travel itinerary generator designed specifically for students with limited budgets. This full-stack application creates personalized, cost-effective travel plans based on user preferences, locations, and financial constraints.

**Current Version**: Phase 2 ✅ (User Authentication, Multi-User Support, Travel History)

## 🎯 Key Features

### Phase 1: Smart Budget Planning ✅
- **Budget Allocation** - Intelligently allocates budget across travel, accommodation, food, and activities
- **Cost Breakdown** - Detailed expense breakdown with per-category estimates
- **Budget Monitoring** - Real-time budget tracking with warnings when estimates exceed limits
- **Alternative Plans** - Automatically generates alternative itineraries if budget is exceeded

### Phase 1: Personalized Itineraries ✅
- **Day-by-Day Plans** - Customized daily itineraries with activities and schedules
- **Activity Recommendations** - Curated activity suggestions across multiple categories:
  - 🏔️ Adventure (Hiking, Kayaking, Rock climbing)
  - 🏛️ Cultural (Museums, Temples, Street art)
  - 🍽️ Food (Street food tours, Cooking classes, Local markets)
  - 🌿 Nature (Beaches, Parks, Waterfalls)
- **Route Optimization** - Activities distributed efficiently across days

### Phase 1: Cost-Saving Recommendations ✅
- **Student Discounts** - Applies 15-25% student discounts on transportation and attractions
- **Budget Accommodations** - Curated list of affordable stay options
- **Money-Saving Tips** - 15+ actionable tips for reducing travel costs
- **Transportation Options** - Student-friendly modes with discounts

### Phase 2: User Authentication & Multi-User Support ✅
- **Secure User Registration** - Create accounts with profile information
- **JWT Authentication** - Token-based authentication with 7-day expiration
- **Secure Login** - Password hashing with bcryptjs
- **Profile Management** - Edit personal information and travel preferences
- **Protected Routes** - All data endpoints protected with authentication

### Phase 2: Travel History & Data Persistence ✅
- **Save Itineraries** - Store unlimited travel plans to MongoDB
- **History Management** - View, edit, delete, and duplicate saved plans
- **Plan Status Tracking** - Track plans as draft, saved, completed, or archived
- **Flexible Filtering** - Sort and filter by destination, status, date, or budget
- **Plan Tagging** - Organize plans with custom tags

### Phase 2: Companion-Based Recommendations ✨ **NEW**
- **Solo Traveler Suggestions** - Activities for independent exploration
- **Couple Recommendations** - Romantic activities and experiences
- **Friends Group Tips** - Adventure and social activities
- **Family Planning** - All-age attractions and kid-friendly options
- **Best Time to Visit** - Seasonal recommendations with pricing data
- **Group-Specific Activities** - Tailored activities based on travel companion type
- **Budget Tips by Group** - Customized money-saving strategies

### Phase 2: Dashboard & User Experience ✅
- **Personal Dashboard** - Quick statistics and recent plans overview
- **Responsive Navigation** - Multi-page navigation with authentication
- **Intuitive UI** - Clean, modern interface with smooth transitions
- **Real-time Updates** - Instant feedback on user actions

## 🏗️ Architecture

### Backend (Node.js/Express)
**Database**: MongoDB with Mongoose ODM
**Authentication**: JWT tokens with bcryptjs password hashing
**Key Services:**
- `planner.js` - Itinerary generation and recommendations
- `auth.js` - User registration, login, profile management
- `history.js` - Save, retrieve, update travel history
- `itinerary.js` - Generate itineraries with recommendations

### Frontend (React)
**Key Components:**
- **Login/Register** - Authentication pages
- **Dashboard** - User dashboard with statistics
- **History** - Manage saved itineraries
- **Profile** - Edit preferences and travel interests
- **Planner** - Create new itineraries
- **ItineraryDisplay** - View results with recommendations tab

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Backend Setup:**
   ```bash
   cd backend
   npm install
   
   # Create .env file
   cat > .env << EOF
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/ai-travel-planner
   JWT_SECRET=your_secure_secret_key_here
   FRONTEND_URL=http://localhost:3000
   NODE_ENV=development
   EOF
   
   npm run dev
   ```

2. **Frontend Setup (in new terminal):**
   ```bash
   cd frontend
   npm install
   npm start
   ```

## 📖 Documentation

- **[Phase 2 Quick Start](PHASE_2_QUICKSTART.md)** - Get running in 5 minutes
- **[Phase 2 Complete Guide](PHASE_2_GUIDE.md)** - Full feature documentation
- **[Getting Started](GETTING_STARTED.md)** - Original setup guide
- **[Architecture](ARCHITECTURE.md)** - System design details

## 💰 Budget Allocation Strategy

The system uses an intelligent allocation algorithm:
- **Transport**: 25% of budget
- **Accommodation**: 35% of budget
- **Food**: 25% of budget  
- **Activities**: 10% of budget
- **Miscellaneous**: 5% of budget (emergency buffer)

## 🎓 Student Benefits

- **Student Discounts**: 15-25% applied automatically with student ID
- **Budget-Friendly Focus**: All recommendations prioritized for cost-effectiveness
- **Group Travel Tips**: Suggestions for cost-sharing with friends
- **Flexible Options**: Easy-to-modify plans with alternatives
- **Customized Recommendations**: Activities tailored to your group type

## 📈 Future Enhancements (Phase 3+)

- [ ] Social features (share itineraries, collaborative planning)
- [ ] Real-time pricing API integration (flights, hotels)
- [ ] Machine learning for personalized suggestions
- [ ] Mobile app (React Native)
- [ ] Export to PDF functionality
- [ ] Interactive maps with Google Maps API
- [ ] Weather integration
- [ ] User forums and community features
- [ ] Advanced analytics and trip insights
- [ ] Multi-city & multi-country trip planning

## 🛠️ Customization

- Add more activities by editing `activityDb` in `backend/src/services/planner.js`
- Modify budget allocation in `allocateBudget()` function
- Update companion-type recommendations in `generateRecommendations()`
- Customize email templates and styling in respective files
- Add destination-specific data (seasons, prices, attractions)

## 📝 License

This project is open source and available for educational purposes.

---

**Happy Planning! 🌍 Travel Smart, Travel Far with AI Travel Planner for Students**

Phase 2 Status: ✅ Complete | Next: Phase 3 (Social Features & Advanced AI)
