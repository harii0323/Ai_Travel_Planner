# AI Travel Planner Backend

Express.js API server for the AI Travel Planner application. Handles travel itinerary generation with budget optimization, cost breakdown, and personalized recommendations.

## Project Structure

```
backend/
├── src/
│   ├── index.js              # Express server setup
│   ├── routes/
│   │   └── itinerary.js      # API route handlers
│   ├── services/
│   │   └── planner.js        # Core AI planning logic
│   └── utils/
│       └── helpers.js        # Utility functions
├── package.json
└── README.md
```

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start server:**
   ```bash
   # Development (with auto-reload)
   npm run dev

   # Production
   npm start
   ```

Server runs on `http://localhost:5000` by default.

## API Endpoints

### POST /api/itinerary
Generate a personalized travel itinerary.

**Request Body:**
```json
{
  "budget": 1500,
  "travelDates": "2024-06-15 to 2024-06-22",
  "startLocation": "New York",
  "destination": "Barcelona",
  "activities": "cultural, nature, food",
  "accommodation": "hostel",
  "transport": "flight"
}
```

**Parameters:**
- `budget` (required): Total budget in USD (number)
- `travelDates` (required): "YYYY-MM-DD to YYYY-MM-DD" format (string)
- `startLocation` (required): Starting location (string)
- `destination` (required): Trip destination (string)
- `activities` (optional): Comma-separated - adventure, cultural, food, nature
- `accommodation` (optional): hostel, budgetHotel, homestay, airbnb, guesthouse
- `transport` (optional): flight, train, bus, localTransport

**Response:** Complete itinerary with costs, daily plans, tips, and alternatives

## Core Features

### Budget Allocation
```
- Transport:       25%
- Accommodation:   35%
- Food:            25%
- Activities:      10%
- Miscellaneous:   5%
```

### Activity Categories
- **Adventure**: Hiking, Kayaking, Rock climbing, Mountain biking
- **Cultural**: Museums, Temples, Street art, Local markets
- **Food**: Street food tours, Cooking classes, Food markets
- **Nature**: Beaches, Parks, Wildlife, Waterfalls

### Accommodation Pricing
- Hostel: $15-25/night
- Budget Hotel: $35-60/night
- Homestay: $20-40/night
- Airbnb: $30-50/night
- Guest House: $25-45/night

### Transportation & Discounts
- Flight: 15% student discount
- Train: 25% student discount
- Bus: 20% student discount
- Local: 25% student discount

## Files Overview

### index.js
- Express server setup
- CORS configuration
- Route initialization
- Error handling

### routes/itinerary.js
- POST /api/itinerary endpoint
- Request validation
- Response handling
- Error responses

### services/planner.js
- Budget allocation algorithm
- Activity recommendation engine
- Cost estimation
- Day-wise itinerary generation
- Alternative plan creation
- Money-saving tips generator

### utils/helpers.js
- Distance calculations
- Date validation
- Season adjustments
- Input validation
- Currency formatting

## NPM Scripts

- `npm start` - Production mode
- `npm run dev` - Development with auto-reload

## Dependencies

- **express**: Web framework
- **cors**: Cross-origin requests
- **dotenv**: Environment variables
- **axios**: HTTP client

## Development Dependencies

- **nodemon**: Auto-restart during development

## Example Usage

```bash
curl -X POST http://localhost:5000/api/itinerary \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 1500,
    "travelDates": "2024-06-15 to 2024-06-22",
    "startLocation": "New York",
    "destination": "Barcelona",
    "activities": "cultural, nature",
    "accommodation": "hostel",
    "transport": "flight"
  }'
```

## Customization

### Add Activities
Edit `activityDb` in planner.js

### Adjust Budget Allocation
Modify percentages in `allocateBudget()`

### Update Costs
Modify accommodation, transport, and food cost databases

## Response Format

Success:
```json
{
  "success": true,
  "summary": { ... },
  "estimatedCosts": { ... },
  "dayPlans": [ ... ],
  "moneyTips": [ ... ],
  "alternatives": [ ... ]
}
```

Over Budget:
```json
{
  "success": true,
  "warnings": [ "Estimate exceeds budget..." ],
  "alternatives": [ ... ]
}
```

Error:
```json
{
  "success": false,
  "error": "Description",
  "message": "Failed to generate itinerary"
}
```

## Future Enhancements

- [ ] Google Maps API integration
- [ ] Skyscanner flight pricing
- [ ] Booking.com availability
- [ ] Machine Learning predictions
- [ ] User authentication
- [ ] Database integration
- [ ] Rate limiting & caching

---

**Made with 💚 for Budget-Conscious Students**
