# Google Maps Integration Guide

## Overview

The AI Travel Planner now supports real distance calculations using the **Google Maps Distance Matrix API**. This replaces random distance generation with accurate, real-world distances between locations.

## How It Works

### Distance Prediction Hierarchy

The system uses a three-tier approach:

1. **Google Maps API** (Primary) - Uses real coordinates and routing
   - Most accurate for any location pair globally
   - Requires API key configuration
   
2. **Route Database** (Secondary) - Pre-defined routes
   - Fast and reliable for common routes
   - Used as fallback if API unavailable
   - Includes: Delhi-Mumbai, Mumbai-Bangalore, Delhi-Kolkata, Chennai-Bangalore

3. **Fallback Random** (Tertiary) - Last resort
   - Generates random distance 500-1500 km
   - Used only if route not in database and API unavailable

### Benefits

✅ **Accurate Distances** - Real routing data instead of estimates  
✅ **Automatic Duration** - Gets actual travel time estimates  
✅ **Global Coverage** - Works for any location pair worldwide  
✅ **Cost Optimization** - More accurate transportation cost calculations  
✅ **Graceful Fallback** - Works without API key (uses database)

## Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable billing

### Step 2: Enable Required APIs

1. In Cloud Console, go to "APIs & Services" → "Library"
2. Search for and enable:
   - **Distance Matrix API**
   - **Maps JavaScript API** (if using frontend maps)
3. Optionally enable:
   - **Directions API** (for turn-by-turn directions)
   - **Geocoding API** (for address to coordinates)

### Step 3: Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the generated API key
4. (Recommended) Restrict key to:
   - Application restrictions: "HTTP referrers"
   - Add your server URL: `your-server-url/*`
   - API restrictions: Select only Distance Matrix API

### Step 4: Configure Environment Variables

Update your `.env` file:

```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

Example `.env`:
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
GOOGLE_MAPS_API_KEY=AIzaSyD...
FRONTEND_URL=http://localhost:3000
```

### Step 5: Restart Backend

```bash
npm run dev
# or
npm start
```

## API Response Examples

### With Google Maps API Configured

```json
{
  "primaryRoute": {
    "from": "Hyderabad",
    "to": "Kerala",
    "distance": 587,
    "estimatedDuration": "11 hours 23 mins",
    "transportMode": "bus",
    "distanceSource": "google_maps"
  },
  "totalDistance": 637
}
```

### Without Google Maps API (Fallback)

```json
{
  "primaryRoute": {
    "from": "Hyderabad",
    "to": "Kerala",
    "distance": 892,
    "estimatedDuration": "12-24 hours",
    "transportMode": "bus",
    "distanceSource": "fallback_random"
  },
  "totalDistance": 942
}
```

## Logging

The system logs distance calculation sources:

```
[INFO] Attempting to fetch distance from Google Maps for Hyderabad to Kerala
[INFO] Successfully fetched distance from Google Maps: 587 km
```

If API fails or is not configured:

```
[WARN] Google Maps API warning: Google Maps API key not configured
[INFO] Using database fallback for distance calculation
```

## Cost Considerations

### Google Maps Pricing

- **Distance Matrix API**: $5 per 1000 requests (after 25,000 monthly free requests)
- **Estimate**: ~1.5 million monthly API calls = $7,500/month
- Recommended for high-traffic applications

### Optimization Strategies

1. **Cache Results** - Store calculated distances locally
2. **Batch Processing** - Use batch distance requests for multiple locations
3. **Database Enhancement** - Gradually add popular routes to database
4. **Request Limiting** - Implement rate limiting to reduce API calls

## Monitoring

Check logs for:

```bash
# View distance source distribution
grep "distanceSource" app.log

# Monitor API errors
grep "Google Maps API error" app.log

# Track fallback usage
grep "fallback_random" app.log
```

## Troubleshooting

### API Key Not Working

```
Error: 401 INVALID_REQUEST
```

Solutions:
- Verify API key is correct in `.env`
- Check APIs are enabled in Cloud Console
- Verify API key restrictions don't block your server

### Over Quota

```
Error: 403 OVER_QUERY_LIMIT
```

Solutions:
- Check daily usage in Cloud Console
- Implement caching layer
- Reduce number of API calls using database info

### Location Not Found

```
Error: ZERO_RESULTS
```

Solutions:
- Verify location names are valid
- Use more specific addresses (with city/country)
- Check location spelling

## Future Enhancements

- [ ] Cache distance results in MongoDB
- [ ] Batch process multiple routes
- [ ] Support for public transport (transit mode)
- [ ] Waypoints for detailed routing
- [ ] Elevation data integration
- [ ] Traffic-aware duration estimates

## Support

For Google Maps API issues:
- [Google Maps API Documentation](https://developers.google.com/maps/documentation/distance-matrix)
- [Google Cloud Support](https://cloud.google.com/support)

For application issues:
- Check backend logs: `npm run dev`
- Verify `.env` configuration
- Test API key with curl:

```bash
curl "https://maps.googleapis.com/maps/api/distancematrix/json?origins=Delhi&destinations=Mumbai&mode=driving&key=YOUR_API_KEY"
```
