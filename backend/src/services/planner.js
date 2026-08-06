// AI Travel Planner Service - Comprehensive Route Planning with Cost Estimation

// Import Google Maps API utility
const {
  getDistanceFromGoogleMaps,
  getDirectionsFromGoogleMaps,
  getRouteFromGoogleRoutesAPI,
  findPlacesNearby,
  searchPlacesByText,
  hasGoogleMapsAPI
} = require('../utils/googleMapsAPI');

// Database of budget-friendly accommodations by destination type (all prices in INR)
const accommodationDb = {
  hostel: { avgPrice: 300, maxPrice: 600, description: 'Youth hostels with shared or private rooms' },
  budgetHotel: { avgPrice: 500, maxPrice: 1000, description: 'Budget hotels with basic amenities' },
  homestay: { avgPrice: 600, maxPrice: 1500, description: 'Local homestays for cultural experience' },
  airbnb: { avgPrice: 800, maxPrice: 2000, description: 'Budget Airbnb listings' },
  guesthouse: { avgPrice: 2500, maxPrice: 4500, description: 'Local guest houses' }
};

// Activity database with costs and categories (all costs in INR)
const activityDb = {
  adventure: [
    { name: 'Hiking', cost: 0, category: 'adventure', days: 8 },
    { name: 'Rock climbing', cost: 30, category: 'adventure', days: 4 },
    { name: 'Paragliding', cost: 2000, category: 'adventure', days: 2 },
    { name: 'Kayaking', cost: 35, category: 'adventure', days: 3 },
    { name: 'Mountain biking', cost: 400, category: 'adventure', days: 5 }
  ],
  cultural: [
    { name: 'Museum visits', cost: 50, category: 'cultural', days: 7 },
    { name: 'Temple tours', cost: 0, category: 'cultural', days: 8 },
    { name: 'Historical site visits', cost: 50, category: 'cultural', days: 6 },
    { name: 'Local market exploration', cost: 0, category: 'cultural', days: 7 },
    { name: 'Street art tours', cost: 0, category: 'cultural', days: 5 }
  ],
  food: [
    { name: 'Street food tour', cost: 5, category: 'food', days: 7 },
    { name: 'Cooking class', cost: 25, category: 'food', days: 3 },
    { name: 'Food market visit', cost: 0, category: 'food', days: 7 },
    { name: 'Local restaurant dinner', cost: 150, category: 'food', days: 6 }
  ],
  nature: [
    { name: 'Beach time', cost: 0, category: 'nature', days: 8 },
    { name: 'National park visits', cost: 50, category: 'nature', days: 5 },
    { name: 'Wildlife watching', cost: 100, category: 'nature', days: 2 },
    { name: 'Forest walks', cost: 20, category: 'nature', days: 7 },
    { name: 'Waterfall visits', cost: 100, category: 'nature', days: 4 }
  ]
};

// Transportation costs (estimated per trip, in INR)
const transportCosts = {
  flight: { base: 4000, perKm: 0.1 },
  train: { base: 400, perKm: 0.08 },
  bus: { base: 100, perKm: 0.05 },
  localTransport: { daily: 5, monthly: 30 }
};

// Fuel prices by type (INR per litre)
const fuelPrices = {
  petrol: 105,
  diesel: 95,
  electric: 8 // per kWh
};

// Vehicle efficiency database
const vehicleEfficiency = {
  car: {
    petrol: { avgMileage: 15, tollMultiplier: 1 },
    diesel: { avgMileage: 18, tollMultiplier: 1 },
    electric: { avgMileage: 5, tollMultiplier: 1 } // km per kWh
  },
  bike: {
    petrol: { avgMileage: 40, tollMultiplier: 0 }, // No toll for bikes
    diesel: { avgMileage: 35, tollMultiplier: 0 },
    electric: { avgMileage: 50, tollMultiplier: 0 }
  }
};

// Daily meal costs per person (all prices in INR)
const foodCosts = {
  budget: { breakfast: 80, lunch: 150, dinner: 200 },
  moderate: { breakfast: 100, lunch: 200, dinner: 250 },
  splurge: { breakfast: 150, lunch: 300, dinner: 400 }
};

// Route database with intermediate stops (simplified for major routes)
const routeDatabase = {
  'Delhi-Mumbai': {
    distance: 1400,
    duration: '24-28 hours',
    intermediateStops: [
      { name: 'Jaipur', distance: 280, category: 'cultural', visitTime: 4, rating: 4.5 },
      { name: 'Udaipur', distance: 660, category: 'cultural', visitTime: 6, rating: 4.7 },
      { name: 'Ahmedabad', distance: 950, category: 'cultural', visitTime: 4, rating: 4.3 }
    ]
  },
  'Mumbai-Bangalore': {
    distance: 980,
    duration: '18-22 hours',
    intermediateStops: [
      { name: 'Pune', distance: 150, category: 'cultural', visitTime: 3, rating: 4.2 },
      { name: 'Goa', distance: 580, category: 'nature', visitTime: 8, rating: 4.8 },
      { name: 'Mangalore', distance: 850, category: 'food', visitTime: 2, rating: 4.1 }
    ]
  },
  'Delhi-Kolkata': {
    distance: 1500,
    duration: '28-32 hours',
    intermediateStops: [
      { name: 'Varanasi', distance: 780, category: 'cultural', visitTime: 6, rating: 4.6 },
      { name: 'Patna', distance: 1000, category: 'cultural', visitTime: 3, rating: 3.8 },
      { name: 'Bhubaneswar', distance: 1300, category: 'cultural', visitTime: 4, rating: 4.4 }
    ]
  },
  'Chennai-Bangalore': {
    distance: 350,
    duration: '6-8 hours',
    intermediateStops: [
      { name: 'Vellore', distance: 140, category: 'cultural', visitTime: 2, rating: 4.0 },
      { name: 'Tiruvannamalai', distance: 200, category: 'cultural', visitTime: 3, rating: 4.2 }
    ]
  }
};

// Toll charges database (simplified, in INR)
const tollCharges = {
  'Delhi-Mumbai': 2500,
  'Mumbai-Bangalore': 1800,
  'Delhi-Kolkata': 2200,
  'Chennai-Bangalore': 400,
  'default': 1500
};

// Calculate number of days from date range
function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
}

function parseTravelDateRange(travelDates) {
  const [startDateText, endDateText] = String(travelDates || '').split(' to ');
  const startDate = new Date(startDateText);
  const endDate = new Date(endDateText || startDateText);

  return { startDate, endDate };
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getDailyTravelLimitKm(transportMode, vehicleType) {
  const mode = String(transportMode || '').toLowerCase();

  if (mode === 'owntransport' && vehicleType === 'bike') return 220;
  if (mode === 'owntransport') return 350;
  if (mode === 'bus') return 320;
  if (mode === 'train') return 500;
  if (mode === 'flight') return 700;

  return 350;
}

function getPreferredArrivalDay(data, tripStartDate, totalDays) {
  const rawDay = data.destinationArrivalDay || data.targetArrivalDay || data.preferredArrivalDay;
  const rawDate = data.destinationArrivalDate || data.targetArrivalDate || data.preferredArrivalDate;

  if (rawDay && Number(rawDay) > 1) {
    return Math.min(totalDays - 1, Math.max(2, Number.parseInt(rawDay, 10)));
  }

  if (rawDate) {
    const arrivalDate = new Date(rawDate);
    if (!Number.isNaN(arrivalDate.getTime())) {
      const day = calculateDays(formatDate(tripStartDate), formatDate(arrivalDate));
      return Math.min(totalDays - 1, Math.max(2, day));
    }
  }

  return null;
}

function parseDestinationStayDays(data) {
  const rawStay =
    data.destinationStayDays ||
    data.stayDays ||
    data.stayDuration ||
    data.destinationStayDuration;

  if (!rawStay) return null;

  const normalized = String(rawStay).trim().toLowerCase();
  const customStay = data.customStayDays || data.customDestinationStayDays;
  const parsed = normalized === 'custom'
    ? Number.parseInt(customStay, 10)
    : Number.parseInt(normalized, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function buildTripPhases(totalDays, preferredArrivalDay, routeDistanceKm, transportMode, vehicleType, preferredStayDays = null) {
  const dailyLimitKm = getDailyTravelLimitKm(transportMode, vehicleType);
  const naturalTravelDays = Math.max(1, Math.ceil((routeDistanceKm || dailyLimitKm) / dailyLimitKm));
  const returnDays = Math.min(Math.max(1, naturalTravelDays), Math.max(1, Math.floor(totalDays / 2)));

  if (preferredStayDays !== null && totalDays >= 2) {
    const destinationStayDays = Math.min(
      Math.max(0, preferredStayDays),
      Math.max(0, totalDays - 2)
    );
    const remainingTravelDays = Math.max(2, totalDays - destinationStayDays);
    const adjustedReturnDays = Math.min(returnDays, remainingTravelDays - 1);
    const onwardDays = Math.max(1, remainingTravelDays - adjustedReturnDays);

    return {
      onwardDays,
      destinationStayDays,
      returnDays: adjustedReturnDays,
      arrivalDay: onwardDays,
      dailyTravelLimitKm: dailyLimitKm
    };
  }

  const defaultArrivalDay = Math.min(totalDays - returnDays, Math.max(2, naturalTravelDays));
  const arrivalDay = Math.min(totalDays - returnDays, preferredArrivalDay || defaultArrivalDay);
  const onwardDays = Math.max(1, arrivalDay);
  const destinationStayDays = Math.max(0, totalDays - onwardDays - returnDays);

  return {
    onwardDays,
    destinationStayDays,
    returnDays,
    arrivalDay: onwardDays,
    dailyTravelLimitKm: dailyLimitKm
  };
}

function buildRouteServices(phase, from, to, days, accommodationType, transportMode) {
  return Array.from({ length: days }, (_, index) => ({
    dayOffset: index + 1,
    restaurantPlan: index === days - 1
      ? `Try a well-rated local restaurant near ${to}`
      : `Lunch halt at a highly rated highway restaurant between ${from} and ${to}`,
    accommodationPlan: index === days - 1
      ? `Check into ${accommodationType} at ${to}`
      : `Overnight halt in a safe, well-connected town on the ${phase.toLowerCase()} route`,
    fuelStopPlan: transportMode === 'ownTransport'
      ? 'Refuel or recharge before the next long driving stretch'
      : 'Use the nearest major transit hub for the next leg'
  }));
}

// Generate route with intermediate stops from local DB only
function generateRouteWithStops(startLocation, destination, transportMode, numDays) {
  const routeKey = `${startLocation}-${destination}`;
  const reverseRouteKey = `${destination}-${startLocation}`;

  const routeData = routeDatabase[routeKey] || routeDatabase[reverseRouteKey];

  if (!routeData) {
    throw new Error(`Route not found in database for ${startLocation} -> ${destination}`);
  }

  routeData.source = 'database';
  const routeInfo = routeData;

  const maxStops = Math.min(3, Math.floor(numDays / 2));
  const selectedStops = (routeInfo.intermediateStops || [])
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, maxStops);

  return {
    primaryRoute: {
      from: startLocation,
      to: destination,
      distance: routeInfo.distance,
      estimatedDuration: routeInfo.duration,
      transportMode: transportMode,
      distanceSource: source
    },
    intermediateStops: selectedStops,
    totalDistance: routeInfo.distance + selectedStops.reduce((sum, stop) => sum + (stop.distance || 50), 0)
  };
}

// Get the best route plan (Google Maps first, then local fallback)
async function getBestRoutePlan(startLocation, destination, transportMode, numDays) {
  console.log(`\n🚀 getBestRoutePlan called: ${startLocation} → ${destination} (${transportMode}, ${numDays} days)`);
  
  // First, check if we have a local database route
  const routeKey = `${startLocation}-${destination}`;
  const reverseRouteKey = `${destination}-${startLocation}`;
  const routeData = routeDatabase[routeKey] || routeDatabase[reverseRouteKey];

  // Try Google Maps first if API is available
  console.log(`📍 hasGoogleMapsAPI check: ${hasGoogleMapsAPI()}`);
  
  if (hasGoogleMapsAPI()) {
    console.log(`🗺️ Attempting Google Maps API call...`);
    const googleResult = await getDistanceFromGoogleMaps(startLocation, destination);
    console.log(`🗺️ Google Maps result:`, googleResult);
    
    if (!googleResult.error && typeof googleResult.distance === 'number') {
      console.log(`✅ Using Google Maps distance: ${googleResult.distance} km`);
      // Use Google Maps distance with local DB intermediate stops if available
      const maxStops = Math.min(3, Math.floor(numDays / 2));
      const selectedStops = (routeData?.intermediateStops || [])
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, maxStops);

      return {
        primaryRoute: {
          from: startLocation,
          to: destination,
          distance: googleResult.distance,
          estimatedDuration: googleResult.duration,
          transportMode: transportMode,
          distanceSource: 'google_maps'
        },
        intermediateStops: selectedStops,
        totalDistance: googleResult.distance + selectedStops.reduce((sum, stop) => sum + (stop.distance || 50), 0)
      };
    }
  }

  // Google Maps not available or failed: use local database route if available
  console.log(`📚 Checking local database route...`);
  if (routeData) {
    console.log(`✅ Found in database with ${routeData.distance} km distance`);
    const maxStops = Math.min(3, Math.floor(numDays / 2));
    const selectedStops = routeData.intermediateStops
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, maxStops);

    return {
      primaryRoute: {
        from: startLocation,
        to: destination,
        distance: routeData.distance,
        estimatedDuration: routeData.duration,
        transportMode: transportMode,
        distanceSource: 'database'
      },
      intermediateStops: selectedStops,
      totalDistance: routeData.distance + selectedStops.reduce((sum, stop) => sum + (stop.distance || 50), 0)
    };
  }

  // No Google Maps and no local route: provide basic fallback
  console.log(`⚠️ Using fallback_basic distance (no API, no database)`);
  const fallbackDistance = Math.floor(Math.random() * 1000) + 500; // 500-1500 km
  return {
    primaryRoute: {
      from: startLocation,
      to: destination,
      distance: fallbackDistance,
      estimatedDuration: '12-24 hours',
      transportMode: transportMode,
      distanceSource: 'fallback_basic'
    },
    intermediateStops: [],
    totalDistance: fallbackDistance
  };
}

// Enhance route data with Google Maps distance (if API key configured)
async function enhanceRouteWithGoogleMaps(routePlan, startLocation, destination) {
  try {
    // Only attempt if Google Maps API is configured
    if (!hasGoogleMapsAPI()) {
      return routePlan; // Return original route plan if API not configured
    }

    console.log(`Attempting to fetch distance from Google Maps for ${startLocation} to ${destination}`);
    
    const result = await getDistanceFromGoogleMaps(startLocation, destination);
    
    if (result.error) {
      console.warn(`Google Maps API warning: ${result.error}`);
      return routePlan; // Return original route plan on error
    }

    // Update route plan with Google Maps data
    const enhancedRoutePlan = { ...routePlan };
    enhancedRoutePlan.primaryRoute = {
      ...routePlan.primaryRoute,
      distance: result.distance,
      estimatedDuration: result.duration,
      distanceSource: 'google_maps'
    };
    
    // Recalculate total distance
    enhancedRoutePlan.totalDistance = 
      result.distance + 
      routePlan.intermediateStops.reduce((sum, stop) => sum + (stop.distance || 50), 0);

    console.log(`Successfully fetched distance from Google Maps: ${result.distance} km`);
    return enhancedRoutePlan;
  } catch (error) {
    console.error('Error enhancing route with Google Maps:', error.message);
    return routePlan; // Return original route plan on error
  }
}

// Estimate route distance based on intermediate stops
async function estimateRouteDistance(startLocation, destination, intermediateStops) {
  try {
    if (!hasGoogleMapsAPI() || !intermediateStops || intermediateStops.length === 0) {
      return null;
    }

    console.log(`Fetching distances for ${intermediateStops.length} intermediate stops`);
    const locations = intermediateStops.map(stop => stop.name);
    
    // This would require using getDistancesToMultipleLocations
    // For now, we'll calculate cumulative distance
    return null;
  } catch (error) {
    console.error('Error estimating route distance:', error.message);
    return null;
  }
}
function estimateTransportCost(mode, distance, isStudent = false) {
  const config = transportCosts[mode] || transportCosts.bus;
  const baseCost = config.base + (distance * (config.perKm || 0));

  // Apply student discount (20% for flights and trains)
  const studentDiscount = isStudent && (mode === 'flight' || mode === 'train') ? 0.2 : 0;
  const discountedCost = baseCost * (1 - studentDiscount);

  return {
    mode: mode,
    baseCost: Math.round(baseCost * 100) / 100,
    discountedCost: Math.round(discountedCost * 100) / 100,
    studentDiscount: studentDiscount > 0 ? Math.round(studentDiscount * 100) + '%' : 'N/A',
    distance: distance,
    isStudent: isStudent
  };
}

// Calculate transportation cost for public transport
function calculatePublicTransportCost(transportMode, distance, numTravelers) {
  const config = transportCosts[transportMode] || transportCosts.bus;
  const baseCost = config.base + (distance * config.perKm || 0);
  const totalCost = baseCost * numTravelers; // Multiply by number of travelers

  return {
    mode: transportMode,
    baseCostPerPerson: Math.round(baseCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    numTravelers: numTravelers,
    distance: distance
  };
}

// Calculate transportation cost for own vehicle
function calculateOwnVehicleCost(vehicleType, fuelType, mileage, totalDistance, numTravelers) {
  const efficiency = vehicleEfficiency[vehicleType]?.[fuelType];
  if (!efficiency) {
    throw new Error(`Invalid vehicle type or fuel type: ${vehicleType}, ${fuelType}`);
  }

  const actualMileage = mileage || efficiency.avgMileage;
  const fuelRequired = totalDistance / actualMileage;
  const fuelPrice = fuelPrices[fuelType];
  const fuelCost = fuelRequired * fuelPrice;

  // Toll charges (only for cars)
  const tollCost = vehicleType === 'car' ? getTollCharges(totalDistance) : 0;

  const totalTransportCost = fuelCost + tollCost;

  return {
    vehicleType,
    fuelType,
    mileage: actualMileage,
    fuelRequired: Math.round(fuelRequired * 100) / 100,
    fuelCost: Math.round(fuelCost * 100) / 100,
    tollCost: Math.round(tollCost * 100) / 100,
    totalCost: Math.round(totalTransportCost * 100) / 100,
    numTravelers: numTravelers,
    distance: totalDistance
  };
}

// Get toll charges based on route
function getTollCharges(distance) {
  // Simplified toll calculation based on distance
  const tollPerKm = 1.5; // Average toll per km for cars
  return Math.round(distance * tollPerKm * 100) / 100;
}

// Calculate food cost
function calculateFoodCost(numTravelers, numDays, budgetCategory = 'moderate') {
  const dailyCosts = foodCosts[budgetCategory] || foodCosts.moderate;
  const dailyTotal = dailyCosts.breakfast + dailyCosts.lunch + dailyCosts.dinner;
  const tripTotal = dailyTotal * numTravelers * numDays;

  return {
    perPersonPerDay: dailyTotal,
    totalCost: Math.round(tripTotal * 100) / 100,
    numTravelers: numTravelers,
    numDays: numDays,
    breakdown: dailyCosts
  };
}

// Calculate accommodation cost
function calculateAccommodationCost(destination, accommodationType, numNights, numTravelers) {
  const accommodation = accommodationDb[accommodationType] || accommodationDb.hostel;
  const costPerNight = accommodation.avgPrice;
  const totalCost = costPerNight * numNights;

  return {
    type: accommodationType,
    costPerNight: costPerNight,
    numNights: numNights,
    totalCost: Math.round(totalCost * 100) / 100,
    description: accommodation.description,
    numTravelers: numTravelers
  };
}

// Calculate activity and entry costs
function calculateActivityCosts(activities, numTravelers) {
  let totalCost = 0;
  const activityBreakdown = [];

  for (const activity of activities) {
    const costPerPerson = activity.cost || 0;
    const totalActivityCost = costPerPerson * numTravelers;
    totalCost += totalActivityCost;

    activityBreakdown.push({
      name: activity.name,
      category: activity.category,
      costPerPerson: costPerPerson,
      totalCost: Math.round(totalActivityCost * 100) / 100,
      numTravelers: numTravelers
    });
  }

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown: activityBreakdown,
    numTravelers: numTravelers
  };
}

// Main itinerary generation function

// Get recommended activities based on preferences
function getRecommendedActivities(preferences, budget, numDays) {
  const activities = [];
  const preferredCategories = preferences.split(',').map(p => p.trim().toLowerCase()).filter(p => p);
  
  let remainingBudget = budget;
  const activitiesPerDay = {};

  for (let day = 1; day <= numDays; day++) {
    activitiesPerDay[day] = [];
  }

  // Select activities within budget
  let currentDay = 1;
  
  for (const category of preferredCategories) {
    if (activityDb[category]) {
      for (const activity of activityDb[category]) {
        if (activity.cost <= remainingBudget && currentDay <= numDays) {
          activities.push({
            ...activity,
            estimatedDay: currentDay,
            applicable: true
          });
          activitiesPerDay[currentDay].push(activity);
          remainingBudget -= activity.cost;
          currentDay = (currentDay % numDays) + 1;
        }
      }
    }
  }

  // If no preferences, add some free/cheap activities
  if (activities.length === 0) {
    const freeActivities = [
      { name: 'Local market exploration', cost: 0, category: 'cultural' },
      { name: 'Beach time', cost: 0, category: 'nature' },
      { name: 'Hiking', cost: 0, category: 'adventure' },
      { name: 'Street food tour', cost: 200, category: 'food' }
    ];

    for (const activity of freeActivities) {
      if (currentDay <= numDays) {
        activities.push({
          ...activity,
          estimatedDay: currentDay,
          applicable: true
        });
        activitiesPerDay[currentDay].push(activity);
        currentDay = (currentDay % numDays) + 1;
      }
    }
  }

  return { activities, activitiesPerDay };
}

// Get accommodation recommendations
function getAccommodationRecommendations(type, numDays, budget, numTravelers = 1) {
  const accommodation = accommodationDb[type] || accommodationDb.hostel;
  const costPerNight = Math.min(accommodation.avgPrice, budget / numDays / numTravelers);
  const totalAccommodationCost = costPerNight * numDays * numTravelers;

  return {
    type,
    description: accommodation.description,
    costPerNight: Math.round(costPerNight * 100) / 100,
    totalCost: Math.round(totalAccommodationCost * 100) / 100,
    suggestions: [
      `Book 3-7 days in advance for better rates`,
      `Join hostel loyalty programs for discounts`,
      `Check student hostel networks for additional discounts`,
      `Consider homestays for cultural experience and savings`,
      `Use apps like Booking.com, Hostelworld for student deals`
    ]
  };
}

// Generate day-wise itinerary with intermediate stops
function generateDayWiseItineraryWithStops(numDays, routePlan, activities, accommodation) {
  const dayPlans = [];
  const activityIndex = {};

  // Initialize activity counter
  for (const activity of activities) {
    if (!activityIndex[activity.estimatedDay]) {
      activityIndex[activity.estimatedDay] = [];
    }
    activityIndex[activity.estimatedDay].push(activity);
  }

  // Distribute intermediate stops across days
  const stopsPerDay = Math.ceil(routePlan.intermediateStops.length / numDays);
  let stopIndex = 0;

  for (let day = 1; day <= numDays; day++) {
    let plan = `**Day ${day}**\n\n`;

    // Add intermediate stops for this day
    const dayStops = routePlan.intermediateStops.slice(stopIndex, stopIndex + stopsPerDay);
    stopIndex += stopsPerDay;

    if (day === 1) {
      plan += `**Morning:** Departure from ${routePlan.primaryRoute.from}\n`;
      plan += `**Travel:** ${routePlan.primaryRoute.estimatedDuration} journey to ${routePlan.primaryRoute.to}\n\n`;

      if (dayStops.length > 0) {
        plan += `**Intermediate Stops:**\n`;
        for (const stop of dayStops) {
          plan += `- **${stop.name}** (${stop.category}) - ${stop.visitTime} hours\n`;
          plan += `  * Distance from route: ${stop.distance}km\n`;
          plan += `  * Rating: ${stop.rating}/5\n\n`;
        }
      }

      plan += `**Evening:** Arrival at ${routePlan.primaryRoute.to}\n`;
      plan += `**Accommodation:** Check into ${accommodation.type}\n`;
      plan += `**Dinner:** Local restaurant or street food\n`;
      plan += `**Rest:** Acclimatize and rest\n`;

    } else if (day === numDays) {
      plan += `**Morning:** Final breakfast at accommodation\n`;
      plan += `**Activities:** Last-minute shopping and souvenir hunting\n`;

      if (activityIndex[day] && activityIndex[day].length > 0) {
        plan += `\n**Activities:**\n`;
        for (const activity of activityIndex[day]) {
          plan += `- ${activity.name} (₹${activity.cost} per person)\n`;
        }
      }

      plan += `\n**Afternoon:** Last meal and departure preparations\n`;
      plan += `**Evening:** Departure from ${routePlan.primaryRoute.to}\n`;

    } else {
      plan += `**Morning:** Breakfast and local exploration\n`;

      if (dayStops.length > 0) {
        plan += `\n**Day Trip/Activities:**\n`;
        for (const stop of dayStops) {
          plan += `- Visit **${stop.name}** (${stop.category})\n`;
          plan += `  * ${stop.visitTime} hours exploration\n`;
          plan += `  * ${stop.distance}km from main destination\n\n`;
        }
      }

      if (activityIndex[day] && activityIndex[day].length > 0) {
        plan += `**Activities:**\n`;
        for (const activity of activityIndex[day]) {
          plan += `- ${activity.name} (₹${activity.cost} per person)\n`;
        }
        plan += `\n`;
      }

      plan += `**Afternoon:** Lunch and continued exploration\n`;
      plan += `**Evening:** Dinner at local restaurant\n`;
      plan += `**Night:** Rest at ${accommodation.type}\n`;
    }

    dayPlans.push({
      day,
      plan,
      activities: activityIndex[day] || [],
      stops: dayStops
    });
  }

  return dayPlans;
}

// Generate day-wise itinerary for a single destination trip
function generateDayWiseItinerary(numDays, destination, activities, accommodation) {
  const dayPlans = [];
  const activityIndex = {};

  // Group activities by their planned day
  for (const activity of activities) {
    const day = activity.estimatedDay || 1;
    if (!activityIndex[day]) {
      activityIndex[day] = [];
    }
    activityIndex[day].push(activity);
  }

  for (let day = 1; day <= numDays; day++) {
    let plan = `**Day ${day}**\n\n`;

    if (day === 1) {
      plan += `**Morning:** Arrive in ${destination} and check into ${accommodation.type}\n`;
      plan += `**Afternoon:** Explore the local area and get oriented\n`;
      plan += `**Evening:** Dinner at a local spot\n`;
    } else if (day === numDays) {
      plan += `**Morning:** Last breakfast and check-out from ${accommodation.type}\n`;
      plan += `**Afternoon:** Final sightseeing or souvenir shopping\n`;
      plan += `**Evening:** Departure from ${destination}\n`;
    } else {
      plan += `**Morning:** Breakfast and local exploration\n`;
      plan += `**Afternoon:** Free time to explore or relax\n`;
      plan += `**Evening:** Dinner and leisure time\n`;
    }

    if (activityIndex[day] && activityIndex[day].length > 0) {
      plan += `\n**Planned Activities:**\n`;
      for (const activity of activityIndex[day]) {
        plan += `- ${activity.name} (${activity.category}, ₹${activity.cost})\n`;
      }
      plan += `\n`;
    }

    plan += `**Night:** Stay at ${accommodation.type}\n`;

    dayPlans.push({
      day,
      plan,
      activities: activityIndex[day] || []
    });
  }

  return dayPlans;
}

// Calculate estimated daily food costs
function estimateFoodCosts(numDays, budget, numTravelers = 1) {
  const dailyFoodBudget = Math.round(budget / numDays);
  const meals = {
    breakfast: 80,
    lunch: 150,
    dinner: 200
  };

  const perPersonBreakfast = meals.breakfast;
  const perPersonLunch = dailyFoodBudget <= 10 ? meals.lunch : meals.lunch + 2;
  const perPersonDinner = dailyFoodBudget <= 10 ? meals.dinner : meals.dinner + 2;
  const perPersonDailyTotal = Math.round((perPersonBreakfast + perPersonLunch + perPersonDinner) * 100) / 100;
  const tripTotalPerPerson = Math.round(perPersonDailyTotal * numDays * 100) / 100;

  return {
    breakfast: perPersonBreakfast,
    lunch: perPersonLunch,
    dinner: perPersonDinner,
    dailyTotal: perPersonDailyTotal,
    tripTotal: Math.round(tripTotalPerPerson * numTravelers * 100) / 100,
    perPersonTripTotal: tripTotalPerPerson,
    groupDailyTotal: Math.round(perPersonDailyTotal * numTravelers * 100) / 100,
    recommendations: [
      'Eat breakfast near your accommodation',
      'Lunch at local food stalls and markets',
      'Cook some meals if accommodation allows',
      'Join food group tours for discounted meals',
      'Avoid eating near tourist attractions'
    ]
  };
}

// Generate money-saving tips
function generateMoneyTips(destination, numDays, transportMode, accommodation) {
  return [
    '✓ Book accommodation in advance for 10-20% discounts',
    '✓ Use student ID for museum and attraction discounts (10-30%)',
    '✓ Travel during low season to save 15-40%',
    '✓ Use public transport instead of taxis (save 50-70%)',
    '✓ Eat where locals eat, not tourist restaurants',
    '✓ Free attractions: parks, beaches, temples, market walks',
    '✓ Book flights to nearby cities and take buses',
    '✓ Join free walking tours led by locals',
    '✓ Use transport passes for unlimited daily travel',
    `✓ Research student discounts for ${destination} attractions`,
    '✓ Travel with friends to share accommodation costs',
    '✓ Book activities online in advance for better rates',
    '✓ Use budget apps to track daily spending',
    '✓ Avoid peak tourist season for best prices',
    '✓ Use public WiFi for communication instead of international plans'
  ];
}

// Generate alternative plans if budget is exceeded
function generateAlternativePlan(originalBudget, estimatedCost, details, numDays) {
  const alternatives = [];

  // Alternative 1: Reduce trip duration
  if (numDays > 3) {
    const reducedDays = Math.max(3, Math.floor(numDays * 0.75));
    const reducedBudget = Math.round(originalBudget * (reducedDays / numDays));
    alternatives.push({
      name: 'Shorter Trip',
      description: `Reduce trip from ${numDays} to ${reducedDays} days`,
      days: reducedDays,
      estimatedCost: reducedBudget,
      savings: estimatedCost - reducedBudget,
      pros: 'Saves more money, can fit better into schedule',
      cons: 'Less time to explore'
    });
  }

  // Alternative 2: Budget accommodation only
  alternatives.push({
    name: 'Budget Accommodation Focus',
    description: 'Skip paid activities, focus on free attractions',
    estimatedCost: Math.round(
      originalBudget * 0.25 + // accommodation (hostels only)
      originalBudget * 0.35 + // transport
      originalBudget * 0.30   // food (budget meals)
    ),
    savings: estimatedCost - (originalBudget * 0.90),
    pros: 'Maximum savings, authentic local experience',
    cons: 'Miss out on paid activities and attractions'
  });

  // Alternative 3: Nearby destination
  alternatives.push({
    name: 'Nearby Alternative Destination',
    description: 'Visit a closer destination with lower costs',
    estimatedCost: Math.round(originalBudget * 0.95),
    savings: Math.round(originalBudget * 0.05),
    pros: 'Lower transport costs, same experience quality',
    cons: 'Different destination'
  });

  return alternatives;
}

/**
 * Generate alternative destinations when budget is insufficient
 */
function generateAlternativeDestinations(budget, originalDestination, numDays, interests) {
  // Simplified alternative destinations with lower costs
  const alternatives = [
    {
      destination: 'Goa',
      estimatedCost: Math.round(budget * 0.8),
      reason: 'Beach destination with lower accommodation costs',
      experience: 'Beach, adventure, food',
      distance: 'Closer to major cities'
    },
    {
      destination: 'Rishikesh',
      estimatedCost: Math.round(budget * 0.7),
      reason: 'Adventure and spiritual destination with budget options',
      experience: 'Adventure, nature, cultural',
      distance: 'Accessible from Delhi/NCR'
    },
    {
      destination: 'Mysore',
      estimatedCost: Math.round(budget * 0.75),
      reason: 'Cultural heritage with affordable local experiences',
      experience: 'Cultural, food, historical',
      distance: 'Well connected by train/bus'
    },
    {
      destination: 'Coorg',
      estimatedCost: Math.round(budget * 0.85),
      reason: 'Nature and coffee plantations with budget stays',
      experience: 'Nature, adventure, food',
      distance: 'Scenic drive from Bangalore'
    }
  ];

  return alternatives.filter(alt => alt.estimatedCost <= budget);
}

/**
 * Generate budget adjustment options for slightly over-budget trips
 */
function generateBudgetAdjustmentOptions(budget, estimatedCosts, routePlan, numDays) {
  const options = [];
  const excess = estimatedCosts.total - budget;

  // Option 1: Skip some intermediate stops
  if (routePlan.intermediateStops && routePlan.intermediateStops.length > 0) {
    const stopsToSkip = Math.min(2, routePlan.intermediateStops.length);
    const savingsPerStop = Math.round(excess / stopsToSkip);
    options.push({
      type: 'skip_stops',
      description: `Skip ${stopsToSkip} intermediate stop(s) to save ₹${savingsPerStop * stopsToSkip}`,
      savings: savingsPerStop * stopsToSkip,
      impact: 'Reduced travel time and fewer activities'
    });
  }

  // Option 2: Cheaper accommodation
  const accommodationSavings = Math.round(Math.min(excess * 0.3, estimatedCosts.accommodation * 0.2));
  if (accommodationSavings > 0) {
    options.push({
      type: 'cheaper_accommodation',
      description: 'Switch to budget hostels or guesthouses',
      savings: accommodationSavings,
      impact: 'More basic accommodation facilities'
    });
  }

  // Option 3: Reduce food budget
  const foodSavings = Math.round(Math.min(excess * 0.2, estimatedCosts.food * 0.15));
  if (foodSavings > 0) {
    options.push({
      type: 'budget_food',
      description: 'Eat at local stalls and cook some meals',
      savings: foodSavings,
      impact: 'More local, authentic food experiences'
    });
  }

  // Option 4: Skip paid activities
  const activitySavings = Math.round(Math.min(excess * 0.3, estimatedCosts.activities));
  if (activitySavings > 0) {
    options.push({
      type: 'free_activities',
      description: 'Focus on free attractions and local exploration',
      savings: activitySavings,
      impact: 'More time for spontaneous discoveries'
    });
  }

  return options;
}

// Allocate budget across different categories
function allocateBudget(totalBudget, numDays) {
  // Allocate budget percentages (excluding transport which is estimated separately)
  // Accommodation: 35%, Food: 25%, Activities: 25%, Miscellaneous: 15%
  const accommodationPercent = 0.35;
  const foodPercent = 0.25;
  const activitiesPercent = 0.25;
  const miscellaneousPercent = 0.15;

  return {
    accommodation: Math.round(totalBudget * accommodationPercent),
    food: Math.round(totalBudget * foodPercent),
    activities: Math.round(totalBudget * activitiesPercent),
    miscellaneous: Math.round(totalBudget * miscellaneousPercent)
  };
}

function calculateStraightLineDistanceKm(pointA, pointB) {
  if (!pointA || !pointB) {
    return null;
  }

  const toRadians = degrees => degrees * (Math.PI / 180);
  const earthRadiusKm = 6371;
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getRouteSearchAnchors(route, sampleEveryKm = 50) {
  const steps = route?.routes?.[0]?.steps || [];
  const anchors = [];
  let distanceSinceLastSample = 0;
  let distanceAlongRoute = 0;

  for (const [index, step] of steps.entries()) {
    const stepDistanceKm = (step.distanceValue || 0) / 1000;
    distanceSinceLastSample += stepDistanceKm;
    distanceAlongRoute += stepDistanceKm;

    const location = step.endLocation || step.startLocation;
    const isInteriorRoutePoint = index > 0 && index < steps.length - 1;
    if (isInteriorRoutePoint && location && distanceSinceLastSample >= sampleEveryKm) {
      anchors.push({
        location,
        query: `${location.lat},${location.lng}`,
        distanceAlongRoute: Math.round(distanceAlongRoute)
      });
      distanceSinceLastSample = 0;
    }
  }

  return anchors;
}

function getPlaceCategory(place) {
  const name = (place.name || '').toLowerCase();
  const types = new Set(place.types || []);

  if (name.includes('waterfall') || name.includes('falls')) return 'Waterfall';
  if (name.includes('beach')) return 'Beach';
  if (name.includes('fort')) return 'Fort';
  if (name.includes('palace')) return 'Palace';
  if (name.includes('temple') || types.has('hindu_temple')) return 'Famous Temple';
  if (name.includes('sanctuary') || name.includes('wildlife')) return 'Wildlife Sanctuary';
  if (name.includes('national park') || name.includes('reserve')) return 'National Park';
  if (name.includes('viewpoint') || name.includes('point') || name.includes('peak')) return 'Scenic Viewpoint';
  if (name.includes('lake')) return 'Famous Lake';
  if (name.includes('dam')) return 'Famous Dam';
  if (types.has('amusement_park')) return 'Adventure Park';
  if (types.has('museum')) return 'Museum';
  if (types.has('art_gallery')) return 'Cultural Attraction';
  if (types.has('park')) return 'Natural Attraction';

  return 'Popular Tourist Attraction';
}

function getIconicPlaceSignals(place) {
  const name = (place.name || '').toLowerCase();
  const types = new Set(place.types || []);
  const iconicKeywords = [
    'national park', 'wildlife', 'sanctuary', 'waterfall', 'falls', 'viewpoint',
    'peak', 'hill', 'fort', 'palace', 'heritage', 'unesco', 'temple', 'beach',
    'lake', 'dam', 'cave', 'reserve', 'backwater', 'zoo', 'adventure'
  ];
  const ordinaryKeywords = [
    'playground', 'colony park', 'municipal park', 'children park', 'local park',
    'garden', 'picnic spot', 'mini park'
  ];

  return {
    hasIconicName: iconicKeywords.some(keyword => name.includes(keyword)),
    hasOrdinaryName: ordinaryKeywords.some(keyword => name.includes(keyword)),
    hasIconicType: ['tourist_attraction', 'hindu_temple', 'amusement_park', 'zoo', 'aquarium', 'park'].some(type => types.has(type)),
    hasSmallLocalType: types.has('museum') || types.has('art_gallery')
  };
}

function isWorthRouteDetour(place) {
  const rating = place.rating || 0;
  const reviews = place.userRatingsTotal || 0;
  const signals = getIconicPlaceSignals(place);

  if (signals.hasOrdinaryName || rating < 4.3 || reviews < 500) {
    return false;
  }

  if (signals.hasSmallLocalType && !signals.hasIconicName && reviews < 2000) {
    return false;
  }

  return signals.hasIconicName || signals.hasIconicType || reviews >= 3000;
}

function getPreferenceMatchScore(place, companionType = 'solo', numberOfTravelers = 1) {
  const category = getPlaceCategory(place);
  const name = (place.name || '').toLowerCase();
  const types = new Set(place.types || []);
  const normalizedCompanion = String(companionType || '').toLowerCase();
  const isGroup = Number(numberOfTravelers) >= 3 || normalizedCompanion.includes('friend') || normalizedCompanion.includes('family');
  const isCouple = normalizedCompanion.includes('couple') || normalizedCompanion.includes('partner');
  const isFamily = normalizedCompanion.includes('family');

  if (isFamily && ['National Park', 'Wildlife Sanctuary', 'Famous Temple', 'Famous Lake', 'Adventure Park'].includes(category)) return 18;
  if (isCouple && ['Scenic Viewpoint', 'Waterfall', 'Beach', 'Palace', 'Famous Lake'].includes(category)) return 18;
  if (isGroup && ['Adventure Park', 'Waterfall', 'Beach', 'Fort', 'Scenic Viewpoint'].includes(category)) return 16;
  if (types.has('tourist_attraction') || name.includes('heritage')) return 10;

  return 4;
}

function scoreRoutePlace(place, companionType, numberOfTravelers) {
  const rating = place.rating || 0;
  const reviews = place.userRatingsTotal || 0;
  const signals = getIconicPlaceSignals(place);
  const popularityScore = Math.min(80, Math.log10(reviews + 1) * 20);
  const ratingScore = rating * 18;
  const reviewCountScore = Math.min(50, reviews / 120);
  const significanceScore = (signals.hasIconicName ? 35 : 0) + (signals.hasIconicType ? 18 : 0);
  const preferenceScore = getPreferenceMatchScore(place, companionType, numberOfTravelers);
  const detourScore = Math.max(0, 20 - Math.abs((place.distanceFromRouteKm || 30) - 30));

  return popularityScore + ratingScore + reviewCountScore + significanceScore + detourScore + preferenceScore;
}

function getTouristPopularityScore(place) {
  const reviews = place.userRatingsTotal || 0;
  const signals = getIconicPlaceSignals(place);

  return Math.min(100, Math.log10(reviews + 1) * 25) +
    (signals.hasIconicName ? 30 : 0) +
    (signals.hasIconicType ? 15 : 0);
}

function getBestTimeToVisit(place) {
  const category = getPlaceCategory(place);

  if (['Waterfall', 'National Park', 'Wildlife Sanctuary'].includes(category)) {
    return 'Morning, especially after monsoon or in cooler months';
  }
  if (['Beach', 'Scenic Viewpoint', 'Famous Lake', 'Famous Dam'].includes(category)) {
    return 'Early morning or sunset';
  }
  if (category === 'Famous Temple') {
    return 'Early morning or evening aarti time';
  }
  if (['Fort', 'Palace', 'Museum', 'Cultural Attraction'].includes(category)) {
    return 'Morning or late afternoon';
  }

  return 'Morning or late afternoon';
}

function getSuggestedVisitDuration(place) {
  const category = getPlaceCategory(place);

  if (['National Park', 'Wildlife Sanctuary', 'Adventure Park'].includes(category)) return '3-5 hours';
  if (['Waterfall', 'Beach', 'Fort', 'Palace'].includes(category)) return '2-3 hours';
  if (['Famous Temple', 'Scenic Viewpoint', 'Famous Lake', 'Famous Dam'].includes(category)) return '1-2 hours';
  return '1.5-2.5 hours';
}

function getRoutePlaceReason(place, companionType, numberOfTravelers) {
  const category = getPlaceCategory(place).toLowerCase();
  const reviews = place.userRatingsTotal ? `${place.userRatingsTotal} reviews` : 'strong visitor interest';
  const preferenceScore = getPreferenceMatchScore(place, companionType, numberOfTravelers);
  const preferenceText = preferenceScore >= 16 ? ' and fits your traveler group' : '';

  return `Worth a short detour as a famous ${category} with ${place.rating}/5 rating, ${reviews}, strong visual appeal${preferenceText}.`;
}

const ROAD_TRIP_CONFIG = {
  checkpointDistanceKm: 50,
  checkpointMinKm: 40,
  checkpointMaxKm: 60,
  searchRadiusMeters: 25000,
  maxDistanceFromRouteKm: 25,
  minRating: 4.2,
  maxAttractionsPerDay: 3,
  apiParallelism: 4,
  maxCategoriesPerCheckpoint: 5,
  categories: [
    { label: 'Tourist Attraction', query: 'tourist attraction', priority: 80, interests: ['history', 'photography'] },
    { label: 'Temple', query: 'famous temple', priority: 82, interests: ['temple', 'history'] },
    { label: 'Historical Monument', query: 'historical monument', priority: 84, interests: ['history', 'photography'] },
    { label: 'Waterfall', query: 'waterfall', priority: 92, interests: ['nature', 'adventure', 'photography'] },
    { label: 'Hill Station', query: 'hill station viewpoint', priority: 88, interests: ['nature', 'photography'] },
    { label: 'Beach', query: 'beach', priority: 84, interests: ['beaches', 'nature', 'photography'] },
    { label: 'Lake', query: 'lake tourist spot', priority: 74, interests: ['nature', 'photography'] },
    { label: 'National Park', query: 'national park', priority: 95, interests: ['wildlife', 'nature'] },
    { label: 'Museum', query: 'museum', priority: 60, interests: ['history'] },
    { label: 'Adventure', query: 'adventure place', priority: 78, interests: ['adventure', 'friends'] },
    { label: 'Wildlife Sanctuary', query: 'wildlife sanctuary', priority: 93, interests: ['wildlife', 'nature'] },
    { label: 'Scenic Viewpoint', query: 'scenic viewpoint', priority: 90, interests: ['photography', 'nature'] },
    { label: 'Fort', query: 'fort', priority: 86, interests: ['history', 'photography'] },
    { label: 'Palace', query: 'palace', priority: 84, interests: ['history', 'photography'] },
    { label: 'Nature', query: 'nature attraction', priority: 78, interests: ['nature'] },
    { label: 'Food Destination', query: 'famous food destination', priority: 68, interests: ['food'] }
  ]
};

const corridorRouteCache = new Map();
const corridorPlacesCache = new Map();

function getCacheValue(cache, key, maxAgeMs = 1000 * 60 * 60) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > maxAgeMs) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function setCacheValue(cache, key, value) {
  cache.set(key, {
    createdAt: Date.now(),
    value
  });
  return value;
}

function decodeRoutePolyline(encoded) {
  if (!encoded) return [];

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5
    });
  }

  return coordinates;
}

function enrichRoutePoints(routePoints) {
  let distanceAlongRoute = 0;

  return routePoints.map((point, index) => {
    if (index > 0) {
      distanceAlongRoute += calculateStraightLineDistanceKm(routePoints[index - 1], point) || 0;
    }

    return {
      ...point,
      routeIndex: index,
      distanceAlongRoute
    };
  });
}

function buildRouteCheckpoints(routePoints, checkpointDistanceKm = ROAD_TRIP_CONFIG.checkpointDistanceKm) {
  if (!routePoints.length) return [];

  const checkpoints = [];
  let nextCheckpointKm = checkpointDistanceKm;

  for (const point of routePoints) {
    const isInteriorPoint =
      point.routeIndex > 0 &&
      point.routeIndex < routePoints.length - 1;

    if (isInteriorPoint && point.distanceAlongRoute >= nextCheckpointKm) {
      checkpoints.push({
        lat: point.lat,
        lng: point.lng,
        routeIndex: point.routeIndex,
        distanceAlongRoute: Math.round(point.distanceAlongRoute)
      });
      nextCheckpointKm += checkpointDistanceKm;
    }
  }

  return checkpoints;
}

function getInterestList(interests) {
  if (Array.isArray(interests)) {
    return interests.map(item => String(item).trim().toLowerCase()).filter(Boolean);
  }

  return String(interests || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseRoadTripPreferences({
  interests,
  companionType,
  numberOfTravelers,
  options = {}
}) {
  const maxDetourKm = Number.parseFloat(options.maxDetourKm || options.maximumDetour || options.maxDetour) || ROAD_TRIP_CONFIG.maxDistanceFromRouteKm;
  const minRating = Number.parseFloat(options.minRating || options.minimumRating) || ROAD_TRIP_CONFIG.minRating;
  const maxAttractionsPerDay = Number.parseInt(options.maxAttractionsPerDay || options.maximumAttractionsPerDay, 10) || ROAD_TRIP_CONFIG.maxAttractionsPerDay;
  const avoid = Array.isArray(options.avoid)
    ? options.avoid
    : String(options.avoid || options.avoidance || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

  return {
    interests: getInterestList(interests),
    companionType,
    numberOfTravelers: Number(numberOfTravelers) || 1,
    maxDetourKm: Math.min(30, Math.max(10, maxDetourKm)),
    minRating,
    maxAttractionsPerDay: Math.max(1, maxAttractionsPerDay),
    avoid: avoid.map(item => String(item).toLowerCase())
  };
}

function getConfiguredCategories(preferences) {
  const preferred = new Set(preferences.interests || []);
  const categories = ROAD_TRIP_CONFIG.categories
    .map(category => ({
      ...category,
      preferenceBoost: category.interests.some(interest => preferred.has(interest)) ? 18 : 0
    }))
    .sort((a, b) => (b.preferenceBoost + b.priority) - (a.preferenceBoost + a.priority));

  return categories;
}

function normalizeCandidatePlace(place, category, checkpoint) {
  const location = place.location || place.geometry?.location;
  if (!location?.lat || !location?.lng) return null;

  return {
    placeId: place.placeId || place.place_id || `${place.name}-${location.lat}-${location.lng}`,
    name: place.name,
    location,
    category: category.label,
    categoryPriority: category.priority + (category.preferenceBoost || 0),
    rating: place.rating || 0,
    userRatingsTotal: place.userRatingsTotal || place.user_ratings_total || 0,
    types: place.types || [],
    formattedAddress: place.formattedAddress || place.formatted_address || place.vicinity || '',
    checkpointKm: checkpoint.distanceAlongRoute,
    checkpointRouteIndex: checkpoint.routeIndex
  };
}

function findNearestRoutePoint(placeLocation, routePoints) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const point of routePoints) {
    const distance = calculateStraightLineDistanceKm(placeLocation, point);
    if (distance !== null && distance < nearestDistance) {
      nearestDistance = distance;
      nearest = point;
    }
  }

  return {
    point: nearest,
    distanceKm: nearestDistance
  };
}

function isAheadOfCheckpoint(candidate, nearestRoutePoint) {
  if (!nearestRoutePoint) return false;
  const routeIndexTolerance = 3;
  const distanceToleranceKm = ROAD_TRIP_CONFIG.checkpointDistanceKm;

  return (
    nearestRoutePoint.routeIndex >= candidate.checkpointRouteIndex - routeIndexTolerance &&
    nearestRoutePoint.distanceAlongRoute >= candidate.checkpointKm - distanceToleranceKm
  );
}

function calculateVisitDurationMinutes(place) {
  const durationText = getSuggestedVisitDuration(place);
  const rangeMatch = String(durationText).match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?/);
  const hours = rangeMatch
    ? (Number.parseFloat(rangeMatch[2] || rangeMatch[1]) + Number.parseFloat(rangeMatch[1])) / (rangeMatch[2] ? 2 : 1)
    : 2;

  return Math.round(hours * 60);
}

function scoreCorridorPlace(place, preferences) {
  const ratingScore = Math.min(100, (place.rating / 5) * 100);
  const reviewScore = Math.min(100, Math.log10((place.userRatingsTotal || 0) + 1) * 25);
  const detourScore = Math.max(0, 100 - ((place.distanceFromRouteKm || 0) / preferences.maxDetourKm) * 100);
  const popularityScore = getTouristPopularityScore(place);
  const categoryScore = Math.min(100, place.categoryPriority || 0);
  const preferenceScore = getPreferenceMatchScore(place, preferences.companionType, preferences.numberOfTravelers);

  return Math.round((
    ratingScore * 0.40 +
    reviewScore * 0.25 +
    detourScore * 0.20 +
    popularityScore * 0.10 +
    categoryScore * 0.05 +
    preferenceScore
  ) * 10) / 10;
}

function buildGoogleMapsLink(place) {
  const query = place.placeId
    ? `place_id:${place.placeId}`
    : `${place.name} ${place.location.lat},${place.location.lng}`;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function decorateCorridorCandidate(candidate, routePoints, preferences, phase) {
  const nearest = findNearestRoutePoint(candidate.location, routePoints);

  if (!nearest.point) return null;
  if (!isAheadOfCheckpoint(candidate, nearest.point)) return null;
  if (nearest.distanceKm > preferences.maxDetourKm) return null;
  if ((candidate.rating || 0) < preferences.minRating) return null;

  const detourDistance = Math.round(nearest.distanceKm * 10) / 10;
  const detourTime = Math.max(8, Math.round((detourDistance * 2 / 35) * 60));
  const visitDurationMinutes = calculateVisitDurationMinutes(candidate);

  const enriched = {
    ...candidate,
    phase,
    distanceFromRouteKm: detourDistance,
    detourDistance,
    detourTime,
    drivingTime: `${Math.round((nearest.point.distanceAlongRoute / 55) * 10) / 10} hr from route start`,
    visitDurationMinutes,
    estimatedVisitTime: `${Math.floor(visitDurationMinutes / 60)} hr ${visitDurationMinutes % 60} min`,
    totalExtraTimeMinutes: detourTime + visitDurationMinutes,
    journeyOrder: Math.round(nearest.point.distanceAlongRoute),
    routePointIndex: nearest.point.routeIndex,
    googleMapsLink: buildGoogleMapsLink(candidate),
    imageUrl: null,
    bestTimeToVisit: getBestTimeToVisit(candidate),
    suggestedVisitDuration: getSuggestedVisitDuration(candidate)
  };

  enriched.aiRecommendationScore = scoreCorridorPlace(enriched, preferences);
  enriched.routeScore = enriched.aiRecommendationScore;
  enriched.reason = getRoutePlaceReason(enriched, preferences.companionType, preferences.numberOfTravelers);

  return enriched;
}

function dedupeCorridorPlaces(places) {
  const byPlaceId = new Map();

  for (const place of places) {
    const key = place.placeId || place.name.toLowerCase();
    const existing = byPlaceId.get(key);
    if (!existing || place.aiRecommendationScore > existing.aiRecommendationScore) {
      byPlaceId.set(key, place);
    }
  }

  return [...byPlaceId.values()];
}

function optimizeCorridorStops(places, days, preferences) {
  const maxStops = Math.max(1, days * preferences.maxAttractionsPerDay);
  const ordered = [...places].sort((a, b) =>
    a.journeyOrder - b.journeyOrder ||
    b.aiRecommendationScore - a.aiRecommendationScore
  );

  const selected = [];
  let lastOrder = -Infinity;

  for (const place of ordered) {
    if (selected.length >= maxStops) break;

    const isNearLastStop =
      selected.length > 0 &&
      Math.abs(place.journeyOrder - lastOrder) < 20;

    if (isNearLastStop) {
      const previous = selected[selected.length - 1];
      if (place.aiRecommendationScore > previous.aiRecommendationScore + 8) {
        selected[selected.length - 1] = place;
        lastOrder = place.journeyOrder;
      }
      continue;
    }

    selected.push(place);
    lastOrder = place.journeyOrder;
  }

  return selected.sort((a, b) => a.journeyOrder - b.journeyOrder);
}

async function runLimited(tasks, limit = ROAD_TRIP_CONFIG.apiParallelism) {
  const results = [];

  for (let index = 0; index < tasks.length; index += limit) {
    const batch = tasks.slice(index, index + limit);
    const batchResults = await Promise.all(batch.map(task => task()));
    results.push(...batchResults);
  }

  return results;
}

async function withExponentialBackoff(task, retries = 2, baseDelayMs = 350) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;

      const delay = baseDelayMs * (2 ** attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

async function searchCheckpointCategory(checkpoint, category) {
  const location = { lat: checkpoint.lat, lng: checkpoint.lng };
  const cacheKey = `${category.query}:${checkpoint.lat.toFixed(3)},${checkpoint.lng.toFixed(3)}:${ROAD_TRIP_CONFIG.searchRadiusMeters}`;
  const cached = getCacheValue(corridorPlacesCache, cacheKey);
  if (cached) return cached;

  const query = `${category.query} near ${checkpoint.lat},${checkpoint.lng}`;
  const places = await withExponentialBackoff(() =>
    searchPlacesByText(query, location, ROAD_TRIP_CONFIG.searchRadiusMeters)
  );
  const normalized = places
    .map(place => normalizeCandidatePlace(place, category, checkpoint))
    .filter(Boolean);

  return setCacheValue(corridorPlacesCache, cacheKey, normalized);
}

async function getCachedDirections(origin, destination, transportMode, waypoints = [], options = {}) {
  const cacheKey = JSON.stringify({ origin, destination, transportMode, waypoints, avoid: options.avoid || [] });
  const cached = getCacheValue(corridorRouteCache, cacheKey, 1000 * 60 * 60 * 6);
  if (cached) return cached;

  let result = await getRouteFromGoogleRoutesAPI(origin, destination, waypoints, transportMode, {
    avoid: options.avoid
  });

  if (result.error) {
    result = await getDirectionsFromGoogleMaps(origin, destination, waypoints, transportMode, {
      avoid: options.avoid
    });
  }

  return setCacheValue(corridorRouteCache, cacheKey, result);
}

function getPrimaryPolyline(directionsResult) {
  return directionsResult?.polyline || directionsResult?.routes?.[0]?.polyline || '';
}

async function buildCorridorRoutePlan({
  startLocation,
  destination,
  transportMode,
  numDays,
  interests,
  companionType,
  numberOfTravelers,
  options = {}
}) {
  const phase = options.segmentType === 'return' ? 'Return Journey' : 'Onward Journey';
  const preferences = parseRoadTripPreferences({
    interests,
    companionType,
    numberOfTravelers,
    options
  });

  const directionsResult = await getCachedDirections(startLocation, destination, transportMode, [], preferences);

  if (directionsResult.error) {
    console.log(`Directions API failed: ${directionsResult.error}`);
    return await getBestRoutePlan(startLocation, destination, transportMode, numDays);
  }

  const polyline = getPrimaryPolyline(directionsResult);
  const routePoints = enrichRoutePoints(decodeRoutePolyline(polyline));

  if (routePoints.length < 2) {
    return await getBestRoutePlan(startLocation, destination, transportMode, numDays);
  }

  const checkpoints = buildRouteCheckpoints(routePoints, ROAD_TRIP_CONFIG.checkpointDistanceKm);
  const categories = getConfiguredCategories(preferences).slice(0, ROAD_TRIP_CONFIG.maxCategoriesPerCheckpoint);
  const searchTasks = checkpoints.flatMap(checkpoint =>
    categories.map(category => () => searchCheckpointCategory(checkpoint, category))
  );

  const searchResults = await runLimited(searchTasks, ROAD_TRIP_CONFIG.apiParallelism);
  const rawCandidates = searchResults.flat();
  const excludedPlaceIds = new Set(options.excludePlaceIds || []);
  const excludedPlaceNames = new Set((options.excludePlaceNames || []).map(name => String(name).toLowerCase()));
  const validatedPlaces = rawCandidates
    .filter(place => !excludedPlaceIds.has(place.placeId))
    .filter(place => !excludedPlaceNames.has(String(place.name || '').toLowerCase()))
    .map(place => decorateCorridorCandidate(place, routePoints, preferences, phase))
    .filter(Boolean);

  const dedupedPlaces = dedupeCorridorPlaces(validatedPlaces);
  const optimizedPlaces = optimizeCorridorStops(dedupedPlaces, numDays, preferences)
    .map((place, index) => ({
      ...place,
      journeyOrder: index + 1,
      routeSectionKm: place.journeyOrder
    }));

  const waypoints = optimizedPlaces.map(place => `${place.location.lat},${place.location.lng}`);
  const optimizedDirections = waypoints.length
    ? await getCachedDirections(startLocation, destination, transportMode, waypoints, preferences)
    : null;
  const routeDistance = optimizedDirections?.distance || directionsResult.distance;
  const routeDuration = optimizedDirections?.duration || directionsResult.duration;
  const extraDistance = Math.max(0, (routeDistance || 0) - (directionsResult.distance || 0));
  const extraTime = optimizedPlaces.reduce((sum, place) => sum + place.totalExtraTimeMinutes, 0);

  return {
    primaryRoute: {
      from: startLocation,
      to: destination,
      distance: routeDistance,
      estimatedDuration: routeDuration,
      transportMode,
      distanceSource: 'google_route_corridor',
      mapPolyline: optimizedDirections?.polyline || polyline,
      encodedPolyline: optimizedDirections?.polyline || polyline,
      routes: optimizedDirections?.routes || directionsResult.routes || []
    },
    intermediateStops: optimizedPlaces,
    onwardJourney: phase === 'Onward Journey' ? optimizedPlaces : [],
    returnJourney: phase === 'Return Journey' ? optimizedPlaces : [],
    totalDistance: routeDistance,
    totalDuration: routeDuration,
    extraDistance,
    extraTime,
    recommendedStops: optimizedPlaces,
    mapPolyline: optimizedDirections?.polyline || polyline,
    routeCoordinates: routePoints,
    checkpoints,
    routeSource: 'google_route_corridor',
    segmentType: options.segmentType || 'route',
    recommendationStats: {
      checkpointCount: checkpoints.length,
      candidateCount: rawCandidates.length,
      validatedCount: validatedPlaces.length,
      dedupedCount: dedupedPlaces.length,
      selectedCount: optimizedPlaces.length,
      categories: categories.map(category => category.label),
      maxDetourKm: preferences.maxDetourKm,
      minRating: preferences.minRating
    }
  };
}

/**
 * Generate dynamic route with places using Google Maps APIs
 * @param {string} startLocation - Starting location
 * @param {string} destination - Final destination
 * @param {string} transportMode - Transport mode
 * @param {number} numDays - Number of days
 * @param {string} interests - User interests (comma-separated)
 * @param {number} budget - Total budget
 * @returns {Promise<Object>} Route plan with places and cost estimates
 */
async function generateDynamicRouteWithPlaces(startLocation, destination, transportMode, numDays, interests, budget, companionType = 'solo', numberOfTravelers = 1, options = {}) {
  console.log(`🚀 Generating dynamic route: ${startLocation} → ${destination} (${numDays} days)`);

  try {
    return await buildCorridorRoutePlan({
      startLocation,
      destination,
      transportMode,
      numDays,
      interests,
      companionType,
      numberOfTravelers,
      options
    });

  } catch (error) {
    console.error('Error in dynamic route generation:', error);
    // Fallback to existing route logic
    return await getBestRoutePlan(startLocation, destination, transportMode, numDays);
  }
}

function getStopDetails(stop) {
  return {
    name: stop.name,
    category: stop.category || (stop.types ? stop.types[0] : 'attraction'),
    googleRating: stop.rating,
    numberOfReviews: stop.userRatingsTotal || 0,
    distanceFromRouteKm: stop.distanceFromRouteKm || stop.detourDistance,
    estimatedDetourTime: `${stop.detourTime} minutes`,
    whyRecommended: stop.reason,
    bestTimeToVisit: stop.bestTimeToVisit,
    suggestedVisitDuration: stop.suggestedVisitDuration,
    phase: stop.phase,
    location: stop.location
  };
}

function serializeRoadTripAttraction(stop, fallbackPhase) {
  return {
    placeId: stop.placeId,
    name: stop.name,
    latitude: stop.location?.lat,
    longitude: stop.location?.lng,
    category: stop.category || (stop.types ? stop.types[0] : 'attraction'),
    googleRating: stop.rating,
    totalReviews: stop.userRatingsTotal || 0,
    distanceFromRoute: stop.distanceFromRouteKm || stop.detourDistance || 0,
    drivingTime: stop.drivingTime,
    detourDistance: stop.detourDistance || stop.distanceFromRouteKm || 0,
    detourTime: stop.detourTime || 0,
    estimatedVisitTime: stop.estimatedVisitTime || stop.suggestedVisitDuration,
    imageUrl: stop.imageUrl || null,
    googleMapsLink: stop.googleMapsLink || buildGoogleMapsLink(stop),
    aiRecommendationScore: stop.aiRecommendationScore || stop.routeScore || 0,
    journeyOrder: stop.journeyOrder,
    routeSectionKm: stop.routeSectionKm,
    phase: stop.phase || fallbackPhase,
    reason: stop.reason,
    bestTimeToVisit: stop.bestTimeToVisit
  };
}

function buildDestinationStayPlan(destination, stayDays, activities, accommodationDetails) {
  return Array.from({ length: stayDays }, (_, index) => {
    const dayActivities = activities.filter(activity => (activity.estimatedDay || 1) % Math.max(stayDays, 1) === index % Math.max(stayDays, 1));
    const focus = dayActivities.length > 0
      ? dayActivities.map(activity => activity.name).join(', ')
      : `local sightseeing, food walks, markets, and relaxed exploration in ${destination}`;

    return {
      dayOffset: index + 1,
      title: `Destination stay in ${destination}`,
      focus,
      accommodationPlan: `Stay at ${accommodationDetails.type}`,
      mealPlan: `Breakfast near accommodation, lunch near sightseeing area, dinner at a well-rated local restaurant`
    };
  });
}

function generateRoundTripDayPlans({
  startLocation,
  destination,
  startDate,
  phases,
  onwardRoute,
  returnRoute,
  destinationStayPlan,
  activities,
  accommodationDetails
}) {
  const dayPlans = [];
  let dayNumber = 1;

  const pushJourneyDays = (phaseName, routePlan, from, to, days) => {
    const stops = routePlan.intermediateStops || [];
    const services = routePlan.routeServices || [];
    const stopsPerDay = Math.max(1, Math.ceil(stops.length / Math.max(days, 1)));

    for (let index = 0; index < days; index += 1) {
      const dayStops = stops.slice(index * stopsPerDay, (index + 1) * stopsPerDay);
      const service = services[index] || {};
      const isFinalPhaseDay = index === days - 1;
      let plan = `**${phaseName} - Day ${index + 1}**\n\n`;

      plan += `**Route:** ${from} to ${to}\n`;
      plan += `**Date:** ${formatDate(addDays(startDate, dayNumber - 1))}\n`;
      plan += `**Travel Target:** ${isFinalPhaseDay ? `Reach ${to}` : 'Cover a comfortable route section with planned halts'}\n`;
      plan += `**Daily Travel Limit:** About ${phases.dailyTravelLimitKm} km before major rest\n\n`;

      if (dayStops.length > 0) {
        plan += `**Worthwhile Detours:**\n`;
        for (const stop of dayStops) {
          plan += `- **${stop.name}** (${stop.category})\n`;
          plan += `  * Rating: ${stop.rating}/5 from ${stop.userRatingsTotal || 0} reviews\n`;
          plan += `  * Distance from route: ${stop.distanceFromRouteKm || stop.detourDistance} km\n`;
          plan += `  * Detour time: ${stop.detourTime} minutes\n`;
          plan += `  * Visit duration: ${stop.suggestedVisitDuration}\n`;
          plan += `  * Best time: ${stop.bestTimeToVisit}\n`;
          plan += `  * Why: ${stop.reason}\n\n`;
        }
      } else {
        plan += `**Worthwhile Detours:** Keep this section efficient; no high-confidence iconic detour was selected.\n\n`;
      }

      plan += `**Food:** ${service.restaurantPlan || `Eat at a well-rated restaurant on the ${from}-${to} corridor`}\n`;
      plan += `**Fuel/Transit:** ${service.fuelStopPlan || 'Use a major fuel stop or transit hub before continuing'}\n`;
      plan += `**Accommodation:** ${service.accommodationPlan || `Stay at ${accommodationDetails.type}`}\n`;

      dayPlans.push({
        day: dayNumber,
        date: formatDate(addDays(startDate, dayNumber - 1)),
        phase: phaseName,
        plan,
        activities: [],
        stops: dayStops,
        restaurants: [service.restaurantPlan].filter(Boolean),
        fuelStops: [service.fuelStopPlan].filter(Boolean),
        accommodation: service.accommodationPlan
      });
      dayNumber += 1;
    }
  };

  pushJourneyDays('Onward Journey', onwardRoute, startLocation, destination, phases.onwardDays);

  for (const stayDay of destinationStayPlan) {
    const activityList = activities.slice(0, 3);
    let plan = `**Destination Stay - Day ${stayDay.dayOffset}**\n\n`;
    plan += `**Location:** ${destination}\n`;
    plan += `**Date:** ${formatDate(addDays(startDate, dayNumber - 1))}\n`;
    plan += `**Focus:** ${stayDay.focus}\n`;
    plan += `**Morning:** Start with a top-rated local breakfast and your highest-priority activity\n`;
    plan += `**Afternoon:** Sightseeing, cultural stops, nature time, or rest based on pace\n`;
    plan += `**Evening:** Local food, markets, viewpoint, or relaxed waterfront/city walk\n`;
    plan += `**Meals:** ${stayDay.mealPlan}\n`;
    plan += `**Accommodation:** ${stayDay.accommodationPlan}\n`;

    dayPlans.push({
      day: dayNumber,
      date: formatDate(addDays(startDate, dayNumber - 1)),
      phase: 'Destination Stay',
      plan,
      activities: activityList,
      stops: [],
      restaurants: [stayDay.mealPlan],
      accommodation: stayDay.accommodationPlan
    });
    dayNumber += 1;
  }

  pushJourneyDays('Return Journey', returnRoute, destination, startLocation, phases.returnDays);

  return dayPlans;
}

async function generateRoundTripRoutePlan({
  startLocation,
  destination,
  transportMode,
  numDays,
  interests,
  budget,
  companionType,
  numberOfTravelers,
  preferredArrivalDay,
  preferredStayDays,
  accommodationType,
  vehicleType,
  plannerOptions = {}
}) {
  const estimateRoute = await getDirectionsFromGoogleMaps(startLocation, destination, [], transportMode);
  const estimatedDistance = estimateRoute.distance || 350;
  const phases = buildTripPhases(numDays, preferredArrivalDay, estimatedDistance, transportMode, vehicleType, preferredStayDays);

  const onwardRoute = await generateDynamicRouteWithPlaces(
    startLocation,
    destination,
    transportMode,
    phases.onwardDays,
    interests,
    budget,
    companionType,
    numberOfTravelers,
    { ...plannerOptions, segmentType: 'onward' }
  );
  onwardRoute.segmentType = 'onward';
  onwardRoute.intermediateStops = (onwardRoute.intermediateStops || []).map(stop => ({ ...stop, phase: 'Onward Journey' }));
  onwardRoute.routeServices = buildRouteServices('Onward Journey', startLocation, destination, phases.onwardDays, accommodationType, transportMode);

  const usedPlaceIds = onwardRoute.intermediateStops.map(stop => stop.placeId).filter(Boolean);
  const usedPlaceNames = onwardRoute.intermediateStops.map(stop => stop.name).filter(Boolean);

  const returnRoute = await generateDynamicRouteWithPlaces(
    destination,
    startLocation,
    transportMode,
    phases.returnDays,
    interests,
    budget,
    companionType,
    numberOfTravelers,
    {
      ...plannerOptions,
      segmentType: 'return',
      excludePlaceIds: usedPlaceIds,
      excludePlaceNames: usedPlaceNames
    }
  );
  returnRoute.segmentType = 'return';
  returnRoute.intermediateStops = (returnRoute.intermediateStops || []).map(stop => ({ ...stop, phase: 'Return Journey' }));
  returnRoute.routeServices = buildRouteServices('Return Journey', destination, startLocation, phases.returnDays, accommodationType, transportMode);

  const allStops = [
    ...(onwardRoute.intermediateStops || []),
    ...(returnRoute.intermediateStops || [])
  ];
  const totalDistance = (onwardRoute.totalDistance || 0) + (returnRoute.totalDistance || 0);
  const extraDistance = (onwardRoute.extraDistance || 0) + (returnRoute.extraDistance || 0);
  const extraTime = (onwardRoute.extraTime || 0) + (returnRoute.extraTime || 0);
  const phaseRank = phase => String(phase || '').toLowerCase().includes('return') ? 2 : 1;
  const recommendedStops = [...allStops].sort((a, b) =>
    phaseRank(a.phase) - phaseRank(b.phase) ||
    (a.routeSectionKm || 0) - (b.routeSectionKm || 0)
  );

  return {
    phases,
    onwardRoute,
    returnRoute,
    primaryRoute: {
      from: startLocation,
      to: destination,
      distance: totalDistance,
      estimatedDuration: `${onwardRoute.totalDuration || onwardRoute.primaryRoute?.estimatedDuration || 'TBD'} onward + ${returnRoute.totalDuration || returnRoute.primaryRoute?.estimatedDuration || 'TBD'} return`,
      transportMode,
      distanceSource: 'round_trip_google_directions'
    },
    intermediateStops: allStops,
    totalDistance,
    totalDuration: `${onwardRoute.totalDuration || 'TBD'} onward, ${returnRoute.totalDuration || 'TBD'} return`,
    extraDistance,
    extraTime,
    recommendedStops,
    mapPolyline: onwardRoute.mapPolyline,
    routeSource: 'google_dynamic_round_trip',
    routeSegments: [
      { phase: 'Onward Journey', ...onwardRoute },
      { phase: 'Return Journey', ...returnRoute }
    ]
  };
}

// Main itinerary generation function
async function generateItinerary(data) {
  try {
    const {
      budget,
      travelDates,
      startLocation,
      destination,
      activities: activitiesPreference,
      accommodation,
      transport,
      travelCompanionType = 'solo',
      numberOfTravelers = 1,
      transportType = 'public', // 'public' or 'own'
      vehicleType, // 'car' or 'bike' (for own transport)
      fuelType, // 'petrol', 'diesel', 'electric' (for own transport)
      mileage, // Vehicle mileage (for own transport)
      vehicleMileage,
      maxDetourKm,
      maximumDetour,
      minRating,
      minimumRating,
      maxAttractionsPerDay,
      maximumAttractionsPerDay,
      avoid,
      avoidance
    } = data;

    // Validate inputs
    if (!budget || !travelDates || !destination) {
      throw new Error('Missing required fields');
    }

    const { startDate, endDate } = parseTravelDateRange(travelDates);
    const numDays = calculateDays(formatDate(startDate), formatDate(endDate));
    const parsedBudget = parseFloat(budget);
    const preferredArrivalDay = getPreferredArrivalDay(data, startDate, numDays);
    const preferredStayDays = parseDestinationStayDays(data);
    const plannerOptions = {
      maxDetourKm: maxDetourKm || maximumDetour,
      minRating: minRating || minimumRating,
      maxAttractionsPerDay: maxAttractionsPerDay || maximumAttractionsPerDay,
      avoid: avoid || avoidance
    };

    // Allocate budget
    const budgetAllocation = allocateBudget(parsedBudget, numDays);

    // Generate complete round-trip route with onward, destination-stay, and return phases
    const routePlan = await generateRoundTripRoutePlan({
      startLocation: startLocation || destination,
      destination,
      transportMode: transport || 'bus',
      numDays,
      interests: activitiesPreference,
      budget: parsedBudget,
      companionType: travelCompanionType,
      numberOfTravelers,
      preferredArrivalDay,
      preferredStayDays,
      accommodationType: accommodation || 'hostel',
      vehicleType,
      plannerOptions
    });

    // Calculate transport costs based on type
    let transportCostDetails;
    let transportCost = 0;

    if (transportType === 'own' && vehicleType) {
      // Calculate cost for own vehicle
      transportCostDetails = calculateOwnVehicleCost(
        vehicleType,
        fuelType || 'petrol',
        mileage || vehicleMileage,
        routePlan.totalDistance,
        numberOfTravelers
      );
      transportCost = transportCostDetails.totalCost;
    } else {
      // Calculate cost for public transport
      transportCostDetails = calculatePublicTransportCost(
        transport || 'bus',
        routePlan.totalDistance,
        numberOfTravelers
      );
      transportCost = transportCostDetails.totalCost;
    }

    // Get accommodation recommendations
    const accommodationDetails = getAccommodationRecommendations(
      accommodation || 'hostel',
      numDays,
      budgetAllocation.accommodation,
      numberOfTravelers
    );

    // Get food costs (scaled by number of travelers)
    const foodDetails = estimateFoodCosts(numDays, budgetAllocation.food, numberOfTravelers);

    // Get activities
    const { activities: recommendedActivities, activitiesPerDay } = getRecommendedActivities(
      activitiesPreference || 'cultural,nature,adventure',
      budgetAllocation.activities,
      numDays
    );

    // Calculate total activities cost
    const activitiesTotalCost = recommendedActivities.reduce((sum, activity) => sum + activity.cost, 0);

    // Calculate estimated costs
    const estimatedCosts = {
      mainTransport: transportCost,
      accommodation: accommodationDetails.totalCost,
      food: foodDetails.tripTotal,
      activities: activitiesTotalCost,
      miscellaneous: budgetAllocation.miscellaneous,
      total: Math.round((
        transportCost +
        accommodationDetails.totalCost +
        foodDetails.tripTotal +
        activitiesTotalCost +
        budgetAllocation.miscellaneous
      ) * 100) / 100
    };

    // Check budget status and generate alternatives
    const isOverBudget = estimatedCosts.total > parsedBudget;
    const isSlightlyOver = isOverBudget && estimatedCosts.total <= parsedBudget * 1.2;
    const isSignificantlyOver = estimatedCosts.total > parsedBudget * 1.2;

    let budgetMessage = '';
    let alternatives = [];

    if (isSignificantlyOver) {
      // Suggest alternative destinations
      budgetMessage = `Your current budget may not be sufficient for this trip. Here are better destinations within your budget.`;
      alternatives = generateAlternativeDestinations(parsedBudget, destination, numDays, activitiesPreference);
    } else if (isSlightlyOver) {
      // Suggest reducing some elements
      budgetMessage = `Your budget is slightly lower than required. You can either skip a few places or increase your budget slightly to enjoy the complete experience.`;
      alternatives = generateBudgetAdjustmentOptions(parsedBudget, estimatedCosts, routePlan, numDays);
    }

    const destinationStayPlan = buildDestinationStayPlan(
      destination,
      routePlan.phases.destinationStayDays,
      recommendedActivities,
      accommodationDetails
    );

    // Generate optimized day-wise itinerary with onward, stay, and return phases
    const dayPlans = generateRoundTripDayPlans({
      startLocation: startLocation || destination,
      destination,
      startDate,
      phases: routePlan.phases,
      onwardRoute: routePlan.onwardRoute,
      returnRoute: routePlan.returnRoute,
      destinationStayPlan,
      activities: recommendedActivities,
      accommodationDetails
    });

    // Generate money-saving tips
    const tips = generateMoneyTips(destination, numDays, transport, accommodation);

    // Final itinerary object with structured output
    const itinerary = {
      success: true,

      // 📌 Trip Overview
      tripOverview: {
        startLocation: routePlan.primaryRoute.from,
        destination: routePlan.primaryRoute.to,
        totalDistance: routePlan.totalDistance,
        travelTime: routePlan.primaryRoute.estimatedDuration,
        numDays: numDays,
        numTravelers: numberOfTravelers,
        arrivalDay: routePlan.phases.arrivalDay,
        arrivalDate: formatDate(addDays(startDate, routePlan.phases.arrivalDay - 1))
      },

      summary: {
        startLocation: routePlan.primaryRoute.from,
        destination,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        totalDays: numDays,
        originalBudget: parsedBudget,
        withinBudget: estimatedCosts.total <= parsedBudget,
        arrivalDay: routePlan.phases.arrivalDay,
        arrivalDate: formatDate(addDays(startDate, routePlan.phases.arrivalDay - 1))
      },

      details: {
        startLocation: startLocation || destination,
        preferredActivities: activitiesPreference || '',
        accommodationType: accommodation || 'hostel',
        transportMode: transport || 'bus'
      },

      // 🗺️ Optimized Route
      optimizedRoute: {
        mainRoute: `${routePlan.primaryRoute.from} → ${routePlan.primaryRoute.to}`,
        deviations: routePlan.intermediateStops.length > 0 ? 'Round trip with recommended onward and return stops' : 'Round trip direct route',
        stopsAdded: routePlan.intermediateStops.map(stop => ({
          name: stop.name,
          phase: stop.phase,
          reason: stop.reason,
          detourDistance: stop.detourDistance,
          detourTime: stop.detourTime
        })),
        updatedTotalDistance: routePlan.totalDistance,
        additionalTravelTime: routePlan.primaryRoute.additionalTime || 0
      },

      aiRoadTripPlan: {
        onwardJourney: (routePlan.onwardRoute.intermediateStops || [])
          .map(stop => serializeRoadTripAttraction(stop, 'Onward')),
        destination: {
          name: destination,
          stayDays: routePlan.phases.destinationStayDays,
          arrivalDay: routePlan.phases.arrivalDay,
          arrivalDate: formatDate(addDays(startDate, routePlan.phases.arrivalDay - 1)),
          activities: destinationStayPlan
        },
        returnJourney: (routePlan.returnRoute.intermediateStops || [])
          .map(stop => serializeRoadTripAttraction(stop, 'Return')),
        totalDistance: routePlan.totalDistance,
        totalDuration: routePlan.totalDuration,
        extraDistance: routePlan.extraDistance || 0,
        extraTime: routePlan.extraTime || 0,
        recommendedStops: (routePlan.recommendedStops || routePlan.intermediateStops || [])
          .map(stop => serializeRoadTripAttraction(stop, stop.phase)),
        mapPolyline: routePlan.mapPolyline || routePlan.onwardRoute.mapPolyline,
        routeStats: {
          onward: routePlan.onwardRoute.recommendationStats,
          return: routePlan.returnRoute.recommendationStats
        }
      },

      route: {
        primaryRoute: routePlan.primaryRoute,
        intermediateStops: routePlan.intermediateStops,
        routeSegments: routePlan.routeSegments,
        mapPolyline: routePlan.mapPolyline,
        recommendedStops: routePlan.recommendedStops,
        extraDistance: routePlan.extraDistance,
        extraTime: routePlan.extraTime
      },

      tripPhases: {
        onwardJourney: {
          days: routePlan.phases.onwardDays,
          route: routePlan.onwardRoute.primaryRoute,
          attractions: routePlan.onwardRoute.intermediateStops.map(getStopDetails),
          restaurants: routePlan.onwardRoute.routeServices.map(service => service.restaurantPlan),
          accommodations: routePlan.onwardRoute.routeServices.map(service => service.accommodationPlan),
          fuelStops: routePlan.onwardRoute.routeServices.map(service => service.fuelStopPlan)
        },
        destinationStay: {
          days: routePlan.phases.destinationStayDays,
          arrivalDay: routePlan.phases.arrivalDay,
          arrivalDate: formatDate(addDays(startDate, routePlan.phases.arrivalDay - 1)),
          activities: destinationStayPlan
        },
        returnJourney: {
          days: routePlan.phases.returnDays,
          route: routePlan.returnRoute.primaryRoute,
          attractions: routePlan.returnRoute.intermediateStops.map(getStopDetails),
          restaurants: routePlan.returnRoute.routeServices.map(service => service.restaurantPlan),
          accommodations: routePlan.returnRoute.routeServices.map(service => service.accommodationPlan),
          fuelStops: routePlan.returnRoute.routeServices.map(service => service.fuelStopPlan)
        }
      },

      // 🌄 Recommended Places
      recommendedPlaces: routePlan.intermediateStops.map(stop => ({
        name: stop.name,
        category: stop.category || (stop.types ? stop.types[0] : 'attraction'),
        googleRating: stop.rating,
        numberOfReviews: stop.userRatingsTotal || 0,
        distanceFromRouteKm: stop.distanceFromRouteKm || stop.detourDistance,
        estimatedDetourTime: `${stop.detourTime} minutes`,
        whyRecommended: stop.reason,
        bestTimeToVisit: stop.bestTimeToVisit,
        suggestedVisitDuration: stop.suggestedVisitDuration,
        location: stop.location
      })),

      // 📅 Day-wise Itinerary
      dayWiseItinerary: dayPlans,
      dayPlans,

      // 💵 Budget Breakdown
      budgetBreakdown: {
        transport: {
          type: transportType === 'own' ? `${vehicleType} (${fuelType})` : transport || 'bus',
          cost: transportCost,
          details: transportCostDetails
        },
        food: {
          dailyCost: foodDetails.dailyTotal,
          totalCost: foodDetails.tripTotal,
          breakdown: foodDetails
        },
        accommodation: {
          type: accommodationDetails.type,
          costPerNight: accommodationDetails.costPerNight,
          totalCost: accommodationDetails.totalCost
        },
        activities: {
          totalCost: activitiesTotalCost,
          breakdown: recommendedActivities.slice(0, 5)
        },
        totalEstimatedCost: estimatedCosts.total,
        originalBudget: parsedBudget,
        remainingBudget: Math.max(0, parsedBudget - estimatedCosts.total)
      },

      estimatedCosts,
      costBreakdown: {
        transport: {
          type: transportType === 'own' ? `${vehicleType} (${fuelType})` : transport || 'bus',
          cost: transportCost,
          details: transportCostDetails
        },
        accommodation: accommodationDetails,
        food: foodDetails,
        activities: recommendedActivities.slice(0, 5),
        miscellaneous: { amount: budgetAllocation.miscellaneous }
      },

      // ⚠ Budget Suggestions
      budgetSuggestions: {
        status: isOverBudget ? 'OVER_BUDGET' : 'WITHIN_BUDGET',
        message: budgetMessage,
        alternatives: alternatives,
        adjustments: isSlightlyOver ? generateBudgetAdjustmentOptions(parsedBudget, estimatedCosts, routePlan, numDays) : []
      },

      // Additional metadata
      metadata: {
        routeSource: routePlan.routeSource,
        apiUsed: hasGoogleMapsAPI() ? 'Google Maps APIs' : 'Local Database',
        generatedAt: new Date().toISOString()
      },

      moneyTips: tips,
      accommodationSuggestions: accommodationDetails.suggestions,
      foodRecommendations: foodDetails.recommendations
    };

    return itinerary;
  } catch (err) {
    console.error('Error generating itinerary:', err);
    return {
      success: false,
      error: err.message,
      message: 'Failed to generate itinerary. Please check your inputs.'
    };
  }
}

// Generate companion-based recommendations
function generateRecommendations(destination, companionType = 'solo', numberOfTravelers = 1) {
  const recommendations = {
    companionSuggestions: [],
    bestTime: {},
    groupActivities: [],
    budgetTips: [],
    safetyTips: []
  };

  // Companion-specific suggestions
  switch (companionType) {
    case 'couple':
      recommendations.companionSuggestions = [
        '🌙 Book romantic sunset tours or dinner experiences',
        '💑 Visit couples-friendly spas or wellness centers',
        '🏨 Choose accommodations near scenic spots for intimate moments',
        '🎭 Explore nightlife and entertainment venues together',
        '📸 Visit Instagram-worthy locations for memorable photos',
        '💒 Plan visits during off-season (shoulder seasons) for peace and quiet'
      ];
      recommendations.bestTime = {
        season: 'Shoulder season (May-June, September-October)',
        reason: 'Perfect weather with fewer tourists, romantic ambiance',
        priceLevel: 'medium'
      };
      recommendations.groupActivities = [
        'Romantic dinner tours',
        'Couples spa treatments',
        'Scenic walks or hiking trails',
        'Wine or food tasting experiences',
        'Private beach or lake time'
      ];
      recommendations.budgetTips = [
        'Share accommodation to reduce costs',
        'Look for couples discounts at restaurants',
        'Visit free attractions like parks and beaches',
        'Plan picnic dates instead of expensive restaurants'
      ];
      break;

    case 'friends':
      recommendations.companionSuggestions = [
        '🎉 Book group-friendly accommodation (hostels with group areas)',
        '🏞️ Plan adventure and outdoor activities together',
        '🍽️ Try group dining experiences and food tours',
        '🎮 Find entertainment venues like clubs, bars, escape rooms',
        '📷 Visit popular photo spots and tourist attractions',
        '🇧🇧 Plan activities that work with different schedules'
      ];
      recommendations.bestTime = {
        season: 'Peak season or holidays (December-January, July-August)',
        reason: 'More activities available, festival vibes, easier scheduling',
        priceLevel: 'high'
      };
      recommendations.groupActivities = [
        'Group hiking or trekking',
        'Bar crawls and nightlife tours',
        'Cooking classes with group participation',
        'Adventure sports (rafting, zip-lining)',
        'Beach or pool parties',
        'Escape rooms and team games'
      ];
      recommendations.budgetTips = [
        'Split accommodation costs among friends',
        'Share transportation between members',
        'Look for group discounts on activities',
        'Cook some meals together to save money',
        'Use happy hour specials for dining'
      ];
      break;

    case 'family':
      recommendations.companionSuggestions = [
        '👨‍👩‍👧‍👦 Book family-friendly accommodation with kitchenettes',
        '🎠 Look for attractions suitable for all ages',
        '🏊 Choose destinations with multiple entertainment options',
        '🍕 Find kid-friendly restaurants and cafes',
        '🏖️ Plan relaxing activities mixed with exciting ones',
        '📚 Visit educational attractions (museums, zoos, aquariums)'
      ];
      recommendations.bestTime = {
        season: 'School holidays (summer break, winter break)',
        reason: 'Family friendly atmosphere, school-break discounts',
        priceLevel: 'medium-high'
      };
      recommendations.groupActivities = [
        'Theme parks and amusement parks',
        'Zoo or aquarium visits',
        'Beach excursions',
        'Museum visits',
        'Outdoor camping or nature walks',
        'Boat cruises',
        'Local festivals and cultural events'
      ];
      recommendations.budgetTips = [
        'Look for family packages and discounts',
        'Visit free attractions like parks and public beaches',
        'Accommodate with kitchen to prepare some meals',
        'Buy food from local markets instead of restaurants',
        'Use public transportation instead of taxis'
      ];
      break;

    case 'large-group':
      recommendations.companionSuggestions = [
        '🏘️ Book group accommodations (villas, group hotels)',
        '🚌 Arrange group transportation to save costs',
        '🎊 Plan large group activities and team events',
        '🍴 Find restaurants that can accommodate large groups',
        '🗺️ Coordinate schedules carefully',
        '💰 Negotiate group discounts for attractions'
      ];
      recommendations.bestTime = {
        season: 'Off-season (May-June, September-October)',
        reason: 'Better availability for large groups, negotiable rates',
        priceLevel: 'low-medium'
      };
      recommendations.groupActivities = [
        'Group camping trips',
        'Team sports and outdoor games',
        'Large group dinners with local cuisine',
        'Sightseeing tours',
        'Adventure activities (rafting, zip-lining)',
        'Group photo tours'
      ];
      recommendations.budgetTips = [
        'Negotiate bulk discounts with hotels and attractions',
        'Share transportation costs across group',
        'Cook communal meals in group accommodation',
        'Buy groceries from local markets',
        'Plan group activities to maximize group rates'
      ];
      break;

    default: // solo
      recommendations.companionSuggestions = [
        '🌍 Explore at your own pace without constraints',
        '🤝 Stay in hostels to meet other travelers',
        '🎒 Focus on budget-friendly activities and accommodations',
        '🚗 Use public transportation or walking tours',
        '📱 Join group tours to meet people',
        '💪 Try adventure activities suited for solo travelers'
      ];
      recommendations.bestTime = {
        season: 'Any time (flexibility is your advantage)',
        reason: 'Solo travelers can travel during any season',
        priceLevel: 'low'
      };
      recommendations.groupActivities = [
        'Hostel social events',
        'Walking tours',
        'Solo hiking and nature exploration',
        'Cultural exchange programs',
        'Solo adventure sports',
        'Local cooking classes'
      ];
      recommendations.budgetTips = [
        'Stay in shared dormitory hostels',
        'Use budget airlines and public transportation',
        'Eat at local food stalls and markets',
        'Take advantage of free walking tours',
        'Travel during shoulder season for better rates'
      ];
      break;
  }

  // General safety tips based on companion type
  recommendations.safetyTips = [
    'Keep copies of your travel documents in a separate location',
    'Register with your embassy before traveling',
    'Buy travel insurance',
    'Keep emergency contact numbers handy',
    companionType === 'solo' ? 'Share your itinerary with friends/family' : 'Have a communication plan with your group',
    'Avoid large amounts of cash; use cards when possible',
    'Stay aware of local customs and safety advisories'
  ];

  return recommendations;
}

module.exports = { generateItinerary, generateRecommendations };
