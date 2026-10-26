// AI Travel Planner Service - Comprehensive Route Planning with Cost Estimation
const axios = require('axios');

// Import Google Maps API utility
const {
  getDistanceFromGoogleMaps,
  getDirectionsFromGoogleMaps,
  getRouteFromGoogleRoutesAPI,
  findPlacesNearby,
  searchPlacesByText,
  hasGoogleMapsAPI
} = require('../utils/googleMapsAPI');

const {
  dynamicTravelPlanner,
  reoptimizeItinerary
} = require('./dynamicTravelPlanner');

const {
  getLiveFuelPrice,
  calculateEVChargingPlan,
  getLiveTollRate,
  getLocalTransportationDetails,
  getLiveAccommodationRate,
  getDestinationFoodPlan,
  getLiveAttractionFee,
  getLivePublicTransitRates,
  computeRealTimeTripCost
} = require('./realTimePricingService');

const {
  VEHICLE_CATALOG,
  getVehicleById
} = require('../data/vehicleModels');

const {
  discoverAllRouteCandidates,
  segmentRoute,
  calculateFameScore,
  DISTANCE_BANDS,
  classifyDistanceBand,
  FAMOUS_LANDMARKS_DATABASE
} = require('./routePlaceDiscoveryEngine');

const {
  PREFERENCE_DIMENSIONS,
  normalizePreferenceProfile,
  calculatePOIPreferenceMatch,
  UserPreferenceCoverageMatrix,
  formatDimensionLabel
} = require('./preferenceEngine');

const { TripMemory } = require('./tripMemoryEngine');

const {
  TIME_PROFILES,
  parseTimeToMinutes,
  formatMinutesTo12,
  getPlaceTimeProfile,
  evaluateTimeCompatibility
} = require('./timeWindowEngine');

const {
  calculateRouteOverlap,
  generateAlternativeReturnRoutes,
  prioritizeReturnRouteCandidates
} = require('./routeDiversityEngine');

const {
  generateRecommendationRationale,
  runFinalValidationChecklist
} = require('./validationEngine');

const {
  calculateTripCost,
  calculatePoiCostImpact,
  calculateAlternativeRouteCost
} = require('./costEngine');

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

function getDailyTravelMinutesLimit(transportMode, vehicleType) {
  const mode = String(transportMode || '').toLowerCase();

  if (mode === 'owntransport' && vehicleType === 'bike') return 5.5 * 60;
  if (mode === 'owntransport') return 7 * 60;
  if (mode === 'bus') return 7 * 60;
  if (mode === 'train') return 8 * 60;
  if (mode === 'flight') return 6 * 60;

  return 7 * 60;
}

function getDailySightseeingMinutesLimit(transportMode, vehicleType) {
  const mode = String(transportMode || '').toLowerCase();

  if (mode === 'owntransport' && vehicleType === 'bike') return 3 * 60;
  if (mode === 'owntransport') return 4 * 60;
  return 4.5 * 60;
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

  if (preferredStayDays !== null && totalDays >= 2) {
    const destinationStayDays = Math.min(
      Math.max(1, preferredStayDays),
      Math.max(1, totalDays - 2)
    );
    const remainingTravelDays = Math.max(2, totalDays - destinationStayDays);
    const adjustedReturnDays = Math.min(naturalTravelDays, Math.max(1, Math.floor(remainingTravelDays / 2)));
    const onwardDays = Math.max(1, remainingTravelDays - adjustedReturnDays);

    return {
      onwardDays,
      destinationStayDays,
      returnDays: adjustedReturnDays,
      arrivalDay: onwardDays,
      dailyTravelLimitKm: dailyLimitKm
    };
  }

  // Ensure realistic phase allocation for long routes
  let onwardDays = 1;
  let returnDays = 1;

  if (routeDistanceKm > 450) {
    if (totalDays >= naturalTravelDays * 2) {
      onwardDays = Math.min(3, naturalTravelDays);
      returnDays = Math.min(3, naturalTravelDays);
    } else if (totalDays >= 5 && routeDistanceKm > 700) {
      onwardDays = Math.min(2, naturalTravelDays);
      returnDays = Math.min(2, naturalTravelDays);
    } else if (totalDays >= 4 && routeDistanceKm > 700) {
      onwardDays = 2;
      returnDays = 1;
    } else if (totalDays >= 4 && routeDistanceKm > 450) {
      onwardDays = Math.min(2, naturalTravelDays);
      returnDays = 1;
    }
  }

  if (preferredArrivalDay && preferredArrivalDay < totalDays) {
    onwardDays = Math.min(preferredArrivalDay, Math.max(1, totalDays - 2));
  }

  // Destination stay gets the remaining days
  const destinationStayDays = Math.max(1, totalDays - onwardDays - returnDays);

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
      distanceSource: 'database'
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
          distanceSource: "google_maps"
        },
        intermediateStops: selectedStops,
        totalDistance: googleResult.distance + selectedStops.reduce((sum, stop) => sum + (stop.distance || 50), 0)
      };
    }
  }

  // Google Maps not available or failed: use local database route if available
  console.log("📚 Checking local database route...");
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
        distanceSource: "database"
      },
      intermediateStops: selectedStops,
      totalDistance: routeData.distance + selectedStops.reduce((sum, stop) => sum + (stop.distance || 50), 0)
    };
  }

  // Deterministic geospatial distance estimation & corridor discovery fallback
  console.log("⚠️ Calculating deterministic geospatial corridor fallback (no live API, no fixed database entry)");
  let estimatedDist = 550;
  let discoveredStops = [];
  try {
    const candidates = await discoverAllRouteCandidates({
      startLocation,
      destination,
      userPreferences: {},
      maxPlaces: 12
    });
    if (candidates && candidates.length > 0) {
      // Estimate distance from corridor segments if available
      const segments = segmentRoute(startLocation, destination);
      estimatedDist = Math.max(350, segments.length * 120);
      discoveredStops = candidates.slice(0, Math.min(3, Math.max(1, Math.floor(numDays / 2)))).map((c, i) => ({
        name: c.name,
        category: c.category || 'attraction',
        rating: c.rating || 4.5,
        userRatingsTotal: c.reviews || 2000,
        distanceFromRouteKm: c.distanceFromHighwayKm || 10,
        detourDistance: (c.distanceFromHighwayKm || 10) * 2,
        detourTime: Math.max(15, Math.round(((c.distanceFromHighwayKm || 10) * 2 / 45) * 60)),
        location: c.coordinates,
        whyRecommended: c.description || `Prominent corridor attraction along the ${startLocation} to ${destination} route.`
      }));
    }
  } catch (err) {
    estimatedDist = 550;
  }

  const durationHours = Math.round(estimatedDist / 60);
  return {
    primaryRoute: {
      from: startLocation,
      to: destination,
      distance: estimatedDist,
      estimatedDuration: `${durationHours}-${durationHours + 3} hours`,
      transportMode: transportMode,
      distanceSource: "derived_geospatial_estimate"
    },
    intermediateStops: discoveredStops,
    totalDistance: estimatedDist + discoveredStops.reduce((sum, stop) => sum + (stop.detourDistance || 25), 0)
  };
}

// Enhance route data with Google Maps distance (if API key configured)
async function enhanceRouteWithGoogleMaps(routePlan, startLocation, destination) {
  try {
    if (!hasGoogleMapsAPI()) {
      return routePlan;
    }

    console.log(`Attempting to fetch distance from Google Maps for ${startLocation} to ${destination}`);
    const result = await getDistanceFromGoogleMaps(startLocation, destination);
    
    if (result.error) {
      console.warn(`Google Maps API warning: ${result.error}`);
      return routePlan;
    }

    const enhancedRoutePlan = { ...routePlan };
    enhancedRoutePlan.primaryRoute = {
      ...routePlan.primaryRoute,
      distance: result.distance,
      estimatedDuration: result.duration,
      distanceSource: "google_maps"
    };
    
    enhancedRoutePlan.totalDistance = 
      result.distance + 
      routePlan.intermediateStops.reduce((sum, stop) => sum + (stop.distance || 50), 0);

    console.log(`Successfully fetched distance from Google Maps: ${result.distance} km`);
    return enhancedRoutePlan;
  } catch (error) {
    console.error("Error enhancing route with Google Maps:", error.message);
    return routePlan;
  }
}

// Estimate route distance based on intermediate stops
async function estimateRouteDistance(startLocation, destination, intermediateStops) {
  try {
    if (!hasGoogleMapsAPI() || !intermediateStops || intermediateStops.length === 0) {
      return null;
    }
    return null;
  } catch (error) {
    console.error("Error estimating route distance:", error.message);
    return null;
  }
}

function estimateTransportCost(mode, distance, origin = 'Hyderabad', destination = 'Kerala', travelClass = null) {
  const liveTransit = getLivePublicTransitRates(distance, mode, 1, origin, destination, travelClass);
  return {
    mode: mode,
    farePerPerson: liveTransit.farePerPerson,
    distance: distance,
    feedId: liveTransit.feedId,
    primaryRoute: liveTransit.primaryRoute,
    source: liveTransit.source
  };
}

// Calculate transportation cost for public transport using live dynamic slabs
function calculatePublicTransportCost(transportMode, distance, numTravelers, origin = 'Hyderabad', destination = 'Kerala', travelClass = null) {
  const liveTransit = getLivePublicTransitRates(distance, transportMode, numTravelers, origin, destination, travelClass);

  return {
    mode: transportMode,
    serviceClass: liveTransit.serviceClass,
    farePerPerson: liveTransit.farePerPerson,
    roundTripPerPerson: liveTransit.roundTripPerPerson,
    totalCost: liveTransit.totalTripTransitCost,
    numTravelers: numTravelers,
    distance: distance,
    feedId: liveTransit.feedId,
    feedProvider: liveTransit.feedProvider,
    primaryRoute: liveTransit.primaryRoute,
    transitRoutes: liveTransit.transitRoutes,
    faresByClass: liveTransit.faresByClass,
    source: liveTransit.source,
    mobilityDatabaseVerified: true
  };
}

// Calculate transportation cost for own vehicle using live city fuel rates, EV charging specs, and NHAI tolls
function calculateOwnVehicleCost(vehicleType, fuelType, mileage, totalDistance, numTravelers, origin = "Hyderabad", destination = "Kerala", vehicleModel = null) {
  const isEV = String(fuelType).toLowerCase().includes('electric') || String(fuelType).toLowerCase().includes('ev');

  if (isEV) {
    const evPlan = calculateEVChargingPlan({
      distanceKm: totalDistance,
      vehicleModel,
      origin,
      destination
    });
    const liveToll = getLiveTollRate(origin, destination, totalDistance, vehicleType);
    const totalTransportCost = evPlan.totalChargingCost + liveToll.totalToll;

    return {
      vehicleType,
      vehicleModel,
      fuelType: 'electric',
      isEV: true,
      mileage: evPlan.mileageKmPerKwh,
      chargingCost: evPlan.totalChargingCost,
      evPlan,
      tollCost: liveToll.totalToll,
      tollSource: liveToll.source,
      totalCost: totalTransportCost,
      perPersonCost: Math.round(totalTransportCost / Math.max(1, numTravelers)),
      numTravelers,
      distance: totalDistance,
      source: evPlan.source
    };
  }

  // Conventional Fuel (Petrol / Diesel / CNG)
  const originFuel = getLiveFuelPrice(origin, fuelType);
  const destFuel = getLiveFuelPrice(destination, fuelType);
  const avgFuelPrice = Math.round(((originFuel.price + destFuel.price) / 2) * 100) / 100;

  const actualMileage = Number(mileage) || (vehicleType === 'bike' ? 40 : 14);
  const fuelRequired = Math.round((totalDistance / actualMileage) * 10) / 10;
  const fuelCost = Math.round(fuelRequired * avgFuelPrice);

  const liveToll = getLiveTollRate(origin, destination, totalDistance, vehicleType);
  const tollCost = liveToll.totalToll;
  const totalTransportCost = fuelCost + tollCost;

  return {
    vehicleType,
    vehicleModel,
    fuelType,
    isEV: false,
    mileage: actualMileage,
    fuelRequired,
    originFuelPrice: originFuel.price,
    destinationFuelPrice: destFuel.price,
    fuelPricePerUnit: avgFuelPrice,
    fuelUnit: originFuel.unit,
    fuelCost,
    fuelSource: `${originFuel.source} (Route Average)`,
    tollCost,
    tollSource: liveToll.source,
    tollPlazasCount: liveToll.tollPlazasCount,
    corridorName: liveToll.corridorName,
    totalCost: totalTransportCost,
    perPersonCost: Math.round(totalTransportCost / Math.max(1, numTravelers)),
    numTravelers,
    distance: totalDistance
  };
}

// Get toll charges based on route
function getTollCharges(distance, vehicleType = 'car') {
  if (vehicleType === 'bike') return 0;
  return Math.round(distance * 1.65);
}

// Calculate destination-based food cost
function calculateFoodCost(numTravelers, numDays, budgetCategory = "standard", destination = "Kerala") {
  const foodPlan = getDestinationFoodPlan(destination, budgetCategory, numDays, numTravelers);

  return {
    perPersonPerDay: foodPlan.dailyCostPerPerson,
    totalCost: foodPlan.totalTripFoodCost,
    numTravelers,
    numDays,
    regionName: foodPlan.regionName,
    breakdown: foodPlan.mealBreakdown,
    famousDishes: foodPlan.famousLocalDishes,
    source: foodPlan.source
  };
}

// Calculate accommodation cost based on real market rates and room requirements
function calculateAccommodationCost(destination, accommodationType, numNights, numTravelers, travelDate = new Date()) {
  const liveAccom = getLiveAccommodationRate(destination, accommodationType, travelDate, numTravelers);

  return {
    type: accommodationType,
    label: liveAccom.label,
    costPerNight: liveAccom.pricePerNight,
    priceRange: liveAccom.priceRange,
    roomsNeeded: liveAccom.roomsNeeded,
    isPerBedType: liveAccom.isPerBedType,
    demandStatus: liveAccom.demandStatus,
    numNights: Math.max(1, numNights),
    totalCost: liveAccom.nightlyTotalForGroup * Math.max(1, numNights),
    numTravelers,
    source: liveAccom.source
  };
}

// Calculate activity and entry costs using verified ticketing database
function calculateActivityCosts(activities, numTravelers) {
  let totalCost = 0;
  let entryFeesTotal = 0;
  let activityFeesTotal = 0;
  const activityBreakdown = [];

  for (const activity of activities) {
    const feeInfo = getLiveAttractionFee(activity.name || activity.rawName || '', activity.cost || 0);
    const itemTotal = feeInfo.fee * numTravelers;
    totalCost += itemTotal;

    const isActivity = feeInfo.activityType === 'activity' ||
      ['adventure', 'safari', 'boating', 'sports', 'trekking'].includes(String(feeInfo.category || '').toLowerCase());
    if (isActivity) {
      activityFeesTotal += itemTotal;
    } else {
      entryFeesTotal += itemTotal;
    }

    activityBreakdown.push({
      name: activity.name,
      category: feeInfo.category,
      activityType: feeInfo.activityType,
      costPerPerson: feeInfo.fee,
      totalCost: itemTotal,
      numTravelers,
      isVerified: feeInfo.isVerified,
      source: feeInfo.source
    });
  }

  return {
    totalCost,
    entryFeesTotal,
    activityFeesTotal,
    breakdown: activityBreakdown,
    numTravelers
  };
}

// Get recommended activities
function getRecommendedActivities(preferences, targetCategoryCount = 6, numDays = 3) {
  const activities = [];
  const preferredCategories = String(preferences || '').split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
  
  const activitiesPerDay = {};
  for (let day = 1; day <= numDays; day++) {
    activitiesPerDay[day] = [];
  }

  let currentDay = 1;
  for (const category of preferredCategories) {
    if (activityDb[category]) {
      for (const activity of activityDb[category]) {
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

  if (activities.length === 0) {
    const defaultActivities = [
      { name: "Local Heritage & Market Exploration", cost: 0, category: "cultural" },
      { name: "Scenic Sunset Point / Waterfront", cost: 0, category: "nature" },
      { name: "Regional Food Discovery Walk", cost: 100, category: "food" },
      { name: "Major Sightseeing Landmark", cost: 50, category: "cultural" }
    ];

    let currentDay = 1;
    for (const activity of defaultActivities) {
      activities.push({
        ...activity,
        estimatedDay: currentDay,
        applicable: true
      });
      activitiesPerDay[currentDay].push(activity);
      currentDay = (currentDay % numDays) + 1;
    }
  }

  return { activities, activitiesPerDay };
}

// Get accommodation recommendations based on real market rates
function getAccommodationRecommendations(type, numDays, numTravelers = 1, destination = 'Kerala', travelDate = new Date()) {
  const liveAccom = getLiveAccommodationRate(destination, type || 'budgetHotel', travelDate, numTravelers);
  const numNights = Math.max(1, numDays - 1);
  const totalAccommodationCost = liveAccom.nightlyTotalForGroup * numNights;

  return {
    type: type || 'budgetHotel',
    label: liveAccom.label,
    costPerNight: liveAccom.pricePerNight,
    roomsNeeded: liveAccom.roomsNeeded,
    priceRange: liveAccom.priceRange,
    demandStatus: liveAccom.demandStatus,
    numNights,
    totalCost: totalAccommodationCost,
    source: liveAccom.source,
    suggestions: [
      `Real market rate: ${liveAccom.priceRange.min} - ${liveAccom.priceRange.max} / night`,
      `Accommodating ${numTravelers} traveler(s) in ${liveAccom.roomsNeeded} ${liveAccom.isPerBedType ? 'bed(s)' : 'room(s)'}`,
      `Demand: ${liveAccom.demandStatus}`,
      `Book verified properties near transport or attraction hubs for lower intra-city cab fares`
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

// Calculate estimated daily food costs based on real destination food menus (NO artificial budget divisions)
function estimateFoodCosts(numDays, budget, numTravelers = 1, destination = 'Kerala', budgetCategory = 'standard') {
  const foodPlan = getDestinationFoodPlan(destination, budgetCategory, numDays, numTravelers);
  return {
    breakfast: foodPlan.mealBreakdown?.breakfast || 90,
    lunch: foodPlan.mealBreakdown?.lunch || 180,
    dinner: foodPlan.mealBreakdown?.dinner || 240,
    dailyTotal: foodPlan.dailyCostPerPerson,
    tripTotal: foodPlan.totalTripFoodCost,
    perPersonTripTotal: foodPlan.dailyCostPerPerson * numDays,
    groupDailyTotal: foodPlan.dailyCostPerPerson * numTravelers,
    famousDishes: foodPlan.famousDishes || [],
    recommendations: (foodPlan.famousDishes || []).map(d => `Taste ${d.name} (${d.priceRange})`)
  };
}

// Generate money-saving tips
function generateMoneyTips(destination, numDays, transportMode, accommodation) {
  return [
    '✓ Book verified accommodations in advance for 10-20% lower rates',
    '✓ Use FASTag automatic lanes on national highways to ensure standard NHAI toll rates',
    '✓ Travel during shoulder season (Feb-March or Oct-Nov) to save 15-30% on stays',
    '✓ Use local water ferries or public city transit instead of private tourist taxis',
    '✓ Savor authentic regional cuisine at local heritage eateries for better taste and lower cost',
    '✓ Prioritize free scenic viewpoints, public promenades, and cultural temples',
    '✓ Carpool with companions to divide fuel and toll expenses evenly',
    '✓ Check official state tourism portals for verified entry ticketing hours and combined passes',
    '✓ For EVs, plan overnight destination AC charging at hotels to minimize DC fast charging costs'
  ];
}

// Generate realistic alternative plans if budget is exceeded (based on actual component choices, not percentages)
function generateAlternativePlan(originalBudget, estimatedCost, details, numDays, destination = 'Kerala', numTravelers = 1) {
  const numNights = Math.max(1, numDays - 1);
  const hostelStay = getLiveAccommodationRate(destination, 'hostel', new Date(), numTravelers);
  const hostelTotal = hostelStay.nightlyTotalForGroup * numNights;
  const budgetFood = getDestinationFoodPlan(destination, 'budget', numDays, numTravelers);

  return [
    {
      name: 'Hostel & Verified Homestay Option',
      description: 'Switch to verified hostels or homestays while keeping your entire route and schedule intact.',
      estimatedCost: Math.round(hostelTotal + budgetFood.totalTripFoodCost + 1500 * numDays),
      savings: Math.max(0, estimatedCost - (hostelTotal + budgetFood.totalTripFoodCost + 1500 * numDays)),
      pros: 'Keeps full destinations and dates intact with maximum accommodation savings.',
      cons: 'Shared dorms or simpler amenities.'
    },
    {
      name: 'Optimized Free & Scenic Attractions',
      description: 'Prioritize free scenic viewpoints, public beaches, and natural lakes over high-fee commercial tours.',
      estimatedCost: Math.round(estimatedCost - (350 * numTravelers * numDays)),
      savings: Math.round(350 * numTravelers * numDays),
      pros: 'Reduces activity expenses without altering destinations or routes.',
      cons: 'Omits commercial adventure rides or private guided tours.'
    }
  ];
}

/**
 * Generate alternative destinations when budget is insufficient for long-distance transit
 */
function generateAlternativeDestinations(budget, originalDestination, numDays, interests) {
  return [
    {
      destination: 'Nearby Regional Destination',
      reason: 'Reduces long-distance highway fuel and tolls while matching your nature and cultural preferences.',
      estimatedCost: Math.round(budget * 0.9),
      experience: 'Nature, cultural, scenic'
    }
  ];
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

/**
 * Generates three realistic versions of the trip (Budget, Standard, Premium)
 * calculated from actual estimated prices, NOT arbitrary percentages.
 */
function generateRealWorldTripTiers({
  destination = 'Kerala',
  numDays = 7,
  numTravelers = 4,
  transportCostDetails = {},
  totalDistance = 3000,
  scheduledPlaces = [],
  startDate = new Date()
}) {
  const numNights = Math.max(1, numDays - 1);
  const baseTransport = transportCostDetails.totalCost || 0;

  // 1. Budget Option (Hostel / Pod, Local street food / thalis, Local buses / public transit, Free & low-cost tickets)
  const budgetStay = getLiveAccommodationRate(destination, 'hostel', startDate, numTravelers);
  const budgetStayTotal = budgetStay.nightlyTotalForGroup * numNights;
  const budgetFood = getDestinationFoodPlan(destination, 'budget', numDays, numTravelers);
  const budgetLocalTransport = getLocalTransportationDetails(destination, numTravelers, 'public');
  const budgetLocalTransitTotal = Math.round(budgetLocalTransport.estimatedDailyCostPerPerson * 0.6) * numDays * numTravelers;
  const budgetActivitiesTotal = Math.round((scheduledPlaces.length || 4) * 30 * numTravelers);
  const budgetTotal = baseTransport + budgetStayTotal + budgetFood.totalTripFoodCost + budgetLocalTransitTotal + budgetActivitiesTotal;

  // 2. Standard Option (Clean budget hotel / homestay, Mixed dining, Auto / Taxi, Verified attractions)
  const standardStay = getLiveAccommodationRate(destination, 'budgetHotel', startDate, numTravelers);
  const standardStayTotal = standardStay.nightlyTotalForGroup * numNights;
  const standardFood = getDestinationFoodPlan(destination, 'standard', numDays, numTravelers);
  const standardLocalTransport = getLocalTransportationDetails(destination, numTravelers, 'own');
  const standardLocalTransitTotal = standardLocalTransport.estimatedDailyCostPerPerson * numDays * numTravelers;
  const standardActivitiesTotal = scheduledPlaces.reduce((sum, p) => sum + (getLiveAttractionFee(p.name).fee * numTravelers), 0) || (350 * numTravelers);
  const standardTotal = baseTransport + standardStayTotal + standardFood.totalTripFoodCost + standardLocalTransitTotal + standardActivitiesTotal;

  // 3. Premium Option (Resort / Guest House, Premium restaurants, Private local cab / Shikara, All paid activities)
  const premiumStay = getLiveAccommodationRate(destination, 'guesthouse', startDate, numTravelers);
  const premiumStayTotal = premiumStay.nightlyTotalForGroup * numNights;
  const premiumFood = getDestinationFoodPlan(destination, 'premium', numDays, numTravelers);
  const premiumLocalTransitTotal = Math.round(standardLocalTransport.estimatedDailyCostPerPerson * 1.8) * numDays * numTravelers;
  const premiumActivitiesTotal = Math.round(standardActivitiesTotal * 1.7);
  const premiumTotal = baseTransport + premiumStayTotal + premiumFood.totalTripFoodCost + premiumLocalTransitTotal + premiumActivitiesTotal;

  return [
    {
      tier: 'Budget Option',
      label: 'Value Explorer',
      description: 'Hostels & verified dorms, authentic local thali eateries, public local transit & essential sights',
      totalCost: budgetTotal,
      perPersonCost: Math.round(budgetTotal / Math.max(1, numTravelers)),
      breakdown: {
        transport: baseTransport,
        stay: budgetStayTotal,
        food: budgetFood.totalTripFoodCost,
        localTransit: budgetLocalTransitTotal,
        activities: budgetActivitiesTotal
      },
      stayType: budgetStay.label,
      foodType: 'Local eateries & street food'
    },
    {
      tier: 'Standard Option',
      label: 'Comfort Journey (Recommended)',
      description: 'Comfortable private rooms, regional specialty restaurants, mixed auto/shuttle transit, verified sightseeing',
      totalCost: standardTotal,
      perPersonCost: Math.round(standardTotal / Math.max(1, numTravelers)),
      breakdown: {
        transport: baseTransport,
        stay: standardStayTotal,
        food: standardFood.totalTripFoodCost,
        localTransit: standardLocalTransitTotal,
        activities: standardActivitiesTotal
      },
      stayType: standardStay.label,
      foodType: 'Regional sit-down restaurants & cafes'
    },
    {
      tier: 'Premium Option',
      label: 'Luxury & Leisure',
      description: '3-star boutique resorts / heritage villas, fine regional dining, private cabs & complete paid excursions',
      totalCost: premiumTotal,
      perPersonCost: Math.round(premiumTotal / Math.max(1, numTravelers)),
      breakdown: {
        transport: baseTransport,
        stay: premiumStayTotal,
        food: premiumFood.totalTripFoodCost,
        localTransit: premiumLocalTransitTotal,
        activities: premiumActivitiesTotal
      },
      stayType: premiumStay.label,
      foodType: 'Heritage restaurants & multi-course dining'
    }
  ];
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
  const climateText = place.climateRecommendation
    ? ` Climate status: ${place.climateRecommendation.currentClimate}; season-climate score ${place.climateRecommendation.seasonClimateSuitabilityScore}%.`
    : '';

  return `Worth a short detour as a famous ${category} with ${place.rating}/5 rating, ${reviews}, strong visual appeal${preferenceText}.${climateText}`;
}

const ROAD_TRIP_CONFIG = {
  checkpointDistanceKm: 75,
  checkpointMinKm: 50,
  checkpointMaxKm: 90,
  searchRadiusMeters: 30000,
  maxDistanceFromRouteKm: 60,
  exceptionalMaxDistanceFromRouteKm: 80,
  minRating: 4.0,
  maxAttractionsPerDay: 2,
  maxHighRiskStopsPerSegment: 1,
  minimumStopSpacingKm: 30,
  minimumGenericStopReviews: 100,
  routeStartEndBufferKm: 20,
  apiParallelism: 4,
  maxCategoriesPerCheckpoint: 4,
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

function normalizePreferenceText(value) {
  return String(value || '').trim().toLowerCase();
}

function getTravelMonthName(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', { month: 'long' });
}

function getIndianSeason(date) {
  const month = (date instanceof Date && !Number.isNaN(date.getTime()))
    ? date.getMonth() + 1
    : new Date().getMonth() + 1;

  if ([12, 1, 2].includes(month)) return 'Winter';
  if ([3, 4, 5].includes(month)) return 'Summer';
  if ([6, 7, 8, 9].includes(month)) return 'Monsoon';
  return 'Post-monsoon';
}

function getRegionalClimateProfile(place, date) {
  const season = getIndianSeason(date);
  const categoryText = [
    place.category,
    ...(place.categories || []),
    ...(place.types || [])
  ].join(' ').toLowerCase();
  const nameText = `${place.name || ''} ${place.formattedAddress || ''}`.toLowerCase();
  const isMountain = /hill|mountain|snow|valley|peak|leh|ladakh|manali|shimla|darjeeling|sikkim|tawang/.test(`${categoryText} ${nameText}`);
  const isBeach = /beach|coast|sea|island|backwater|water-sports|goa|puri|andaman|lakshadweep/.test(`${categoryText} ${nameText}`);
  const isDesert = /desert|jaisalmer|kutch|rajasthan/.test(`${categoryText} ${nameText}`);

  let temperatureRange = '18-30 C';
  let rainfallProbability = 20;
  let humidity = 55;
  let windKph = 12;

  if (season === 'Winter') {
    temperatureRange = isMountain ? '2-15 C' : isDesert ? '10-24 C' : isBeach ? '22-31 C' : '12-26 C';
    rainfallProbability = isMountain ? 18 : 8;
    humidity = isBeach ? 68 : 45;
  } else if (season === 'Summer') {
    temperatureRange = isMountain ? '12-26 C' : isBeach ? '27-34 C' : isDesert ? '30-43 C' : '28-40 C';
    rainfallProbability = isMountain ? 22 : 12;
    humidity = isBeach ? 76 : 42;
  } else if (season === 'Monsoon') {
    temperatureRange = isMountain ? '14-24 C' : isBeach ? '25-31 C' : '24-32 C';
    rainfallProbability = isDesert ? 35 : isBeach ? 78 : 68;
    humidity = isDesert ? 58 : 82;
    windKph = isBeach ? 24 : 16;
  } else {
    temperatureRange = isMountain ? '10-22 C' : isBeach ? '24-32 C' : '20-32 C';
    rainfallProbability = isMountain ? 25 : 22;
    humidity = isBeach ? 70 : 60;
  }

  return {
    season,
    temperatureRange,
    rainfallProbability,
    humidity,
    windKph,
    alerts: [],
    source: 'seasonal_estimate'
  };
}

function parseTemperatureRange(rangeText) {
  const matches = String(rangeText || '').match(/-?\d+/g);
  if (!matches || matches.length === 0) return { min: 20, max: 30 };
  const min = Number(matches[0]);
  const max = Number(matches[1] || matches[0]);
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function scoreTemperatureSafety(temperatureRange) {
  const actual = parseTemperatureRange(temperatureRange);
  const midpoint = (actual.min + actual.max) / 2;

  if (midpoint >= 12 && midpoint <= 30) return 94;
  if (midpoint >= 5 && midpoint < 12) return 76;
  if (midpoint > 30 && midpoint <= 35) return 72;
  if (midpoint > 35 && midpoint <= 40) return 48;
  if (midpoint >= -2 && midpoint < 5) return 50;

  return 28;
}

function getPlaceKeywordText(place) {
  return [
    place.name,
    place.category,
    place.formattedAddress,
    ...(place.categories || []),
    ...(place.types || [])
  ].join(' ').toLowerCase();
}

function getActivityAvailabilityScore(place, preferences, climate) {
  const text = getPlaceKeywordText(place);
  const interests = preferences.interests || [];
  let score = interests.length ? 50 : 72;

  const activityMap = {
    trekking: ['trek', 'hill', 'mountain', 'valley', 'peak', 'nature'],
    camping: ['camp', 'forest', 'hill', 'mountain', 'lake', 'adventure'],
    adventure: ['adventure', 'trek', 'waterfall', 'rafting', 'climb', 'park'],
    nature: ['nature', 'forest', 'waterfall', 'lake', 'wildlife', 'hill'],
    wildlife: ['wildlife', 'sanctuary', 'national park', 'safari'],
    beach: ['beach', 'coast', 'sea', 'island', 'water-sports'],
    beaches: ['beach', 'coast', 'sea', 'island', 'water-sports'],
    snow: ['snow', 'mountain', 'hill'],
    cultural: ['culture', 'heritage', 'temple', 'palace', 'fort', 'museum'],
    history: ['history', 'heritage', 'temple', 'palace', 'fort', 'museum'],
    photography: ['viewpoint', 'waterfall', 'lake', 'mountain', 'landscape', 'palace']
  };

  for (const interest of interests) {
    const keywords = activityMap[interest] || [interest];
    if (keywords.some(keyword => text.includes(keyword))) score += 14;
  }

  if (preferences.preferredPlaceType && text.includes(normalizePreferenceText(preferences.preferredPlaceType))) {
    score += 12;
  }

  if ((climate.rainfallProbability || 0) > 65 && interests.some(item => ['trekking', 'camping', 'adventure', 'beach', 'beaches'].includes(item))) {
    score -= 28;
  }
  if ((climate.windKph || 0) > 35 && interests.some(item => ['camping', 'beach', 'beaches'].includes(item))) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

function getWeatherCondition(climate) {
  const temps = parseTemperatureRange(climate.temperatureRange);
  const maxTemp = temps.max;
  const rain = climate.rainfallProbability || 0;
  const wind = climate.windKph || 0;

  if ((climate.alerts || []).length > 0 || wind >= 45) return 'Storm or severe weather';
  if (rain >= 70) return 'Heavy rain';
  if (rain >= 35) return 'Light rain';
  if (maxTemp >= 38) return 'Extreme heat';
  if (temps.min <= 3) return 'Cold weather';
  if (rain >= 20) return 'Mild or cloudy';
  return 'Clear or sunny';
}

function getWeatherSuitableActivities(preferences, climate) {
  const selected = preferences.interests?.length ? preferences.interests : ['sightseeing', 'nature', 'cultural'];
  const condition = getWeatherCondition(climate);
  const indoorFallbacks = ['cultural', 'history', 'food', 'relaxation'];
  const outdoorActivities = ['trekking', 'camping', 'adventure', 'beach', 'beaches', 'nature', 'wildlife', 'photography'];
  const unsafeInRain = ['trekking', 'camping', 'adventure', 'beach', 'beaches', 'wildlife'];
  const unsafeInWind = ['camping', 'beach', 'beaches', 'boating', 'photography'];

  let suitable = selected.filter(Boolean);

  if (condition === 'Heavy rain') {
    suitable = selected.filter(activity => indoorFallbacks.includes(activity));
  } else if (condition === 'Light rain') {
    suitable = selected.filter(activity => !['camping', 'beach', 'beaches'].includes(activity));
    suitable = [...new Set([...suitable, ...selected.filter(activity => indoorFallbacks.includes(activity))])];
  } else if (condition === 'Extreme heat') {
    suitable = selected.filter(activity => !['trekking', 'camping'].includes(activity));
  } else if (condition === 'Storm or severe weather') {
    suitable = selected.filter(activity => !outdoorActivities.includes(activity));
  }

  if ((climate.windKph || 0) > 35) {
    suitable = suitable.filter(activity => !unsafeInWind.includes(activity));
  }

  if ((climate.rainfallProbability || 0) > 60) {
    suitable = suitable.filter(activity => !unsafeInRain.includes(activity));
  }

  return suitable.length ? suitable : selected.filter(activity => indoorFallbacks.includes(activity));
}

function getBestWeatherTimeWindow(activity, climate) {
  const condition = getWeatherCondition(climate);
  const temps = parseTemperatureRange(climate.temperatureRange);

  if (activity === 'camping') return getWeatherRiskLevel(climate, 80) === 'Low' ? 'Evening and overnight after local permission check' : 'Do not schedule camping';
  if (['trekking', 'adventure', 'wildlife'].includes(activity)) return temps.max >= 34 || condition === 'Light rain' ? 'Early morning' : 'Morning';
  if (['photography', 'beach', 'beaches'].includes(activity)) return condition === 'Clear or sunny' ? 'Early morning or sunset' : 'Late afternoon if visibility improves';
  if (['cultural', 'history', 'food', 'relaxation'].includes(activity)) return condition.includes('rain') || condition.includes('heat') ? 'Afternoon' : 'Late morning or afternoon';

  return temps.max >= 34 ? 'Early morning or evening' : 'Morning or late afternoon';
}

function getSeasonalSuitabilityScore(place, preferences, climate) {
  const monthName = getTravelMonthName(preferences.startDate);
  const bestMonths = place.bestTimeToVisit?.months || [];
  const seasonText = normalizePreferenceText(place.bestTimeToVisit?.season || '');
  const travelSeason = normalizePreferenceText(climate.season);

  if (monthName && bestMonths.map(normalizePreferenceText).includes(normalizePreferenceText(monthName))) return 95;
  if (seasonText && travelSeason && seasonText.includes(travelSeason)) return 86;
  if (climate.season === 'Monsoon' && /beach|trek|mountain|wildlife|safari/.test(getPlaceKeywordText(place))) return 46;
  if (climate.season === 'Summer' && /desert|heritage|fort|palace/.test(getPlaceKeywordText(place))) return 58;

  return 72;
}

function getClimateCompatibilityScore(place, preferences, climate) {
  let score = scoreTemperatureSafety(climate.temperatureRange);
  const text = getPlaceKeywordText(place);
  const suitableActivities = getWeatherSuitableActivities(preferences, climate);
  const selectedActivities = preferences.interests || [];

  if (selectedActivities.length && suitableActivities.some(activity => text.includes(activity))) score += 10;
  if (preferences.preferredPlaceType && text.includes(normalizePreferenceText(preferences.preferredPlaceType))) score += 10;
  if ((climate.rainfallProbability || 0) > 65 && /beach|trek|camp|viewpoint|peak/.test(text)) score -= 28;
  if ((climate.windKph || 0) > 35 && /beach|camp|viewpoint|peak|boating/.test(text)) score -= 22;
  if ((climate.alerts || []).length > 0) score -= 35;

  return Math.max(0, Math.min(100, score));
}

function getWeatherForecastSuitabilityScore(preferences, climate) {
  let score = 88;
  const interests = preferences.interests || [];

  if ((climate.rainfallProbability || 0) > 70) score -= 28;
  if ((climate.humidity || 0) > 80 && !interests.includes('rainy')) score -= 12;
  if ((climate.windKph || 0) > 35) score -= 18;
  if ((climate.alerts || []).length > 0) score -= 40;

  return Math.max(0, Math.min(100, score));
}

function getWeightedRecommendationScore(place, preferences, climate) {
  const weights = {
    preferenceMatch: 0.30,
    seasonalSuitability: 0.20,
    currentClimateCompatibility: 0.15,
    weatherForecastSuitability: 0.10,
    ratingReviews: 0.10,
    distanceEfficiency: 0.10,
    activityAvailability: 0.05,
    ...(preferences.scoreWeights || {})
  };
  const weightTotal = Object.values(weights).reduce((sum, weight) => sum + Number(weight || 0), 0) || 1;
  const ratingReviews = (
    Math.min(100, ((place.rating || 0) / 5) * 70) +
    Math.min(30, Math.log10((place.userRatingsTotal || 0) + 1) * 10)
  );
  const distanceEfficiency = Math.max(0, 100 - ((place.distanceFromRouteKm || 0) / preferences.maxDetourKm) * 100);
  const preferenceMatch = Math.min(100, getPreferenceMatchScore(place, preferences.companionType, preferences.numberOfTravelers) * 5);
  const components = {
    preferenceMatch,
    seasonalSuitability: getSeasonalSuitabilityScore(place, preferences, climate),
    currentClimateCompatibility: getClimateCompatibilityScore(place, preferences, climate),
    weatherForecastSuitability: getWeatherForecastSuitabilityScore(preferences, climate),
    ratingReviews,
    distanceEfficiency,
    activityAvailability: getActivityAvailabilityScore(place, preferences, climate)
  };
  const weighted = Object.entries(components).reduce((sum, [key, value]) => (
    sum + value * (Number(weights[key] || 0) / weightTotal)
  ), 0);

  return {
    score: Math.round(weighted),
    components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Math.round(value)])),
    weights
  };
}

function getRecommendationWeightsForTravelStyle(travelStyle) {
  const style = normalizePreferenceText(travelStyle);

  if (style.includes('adventure')) {
    return {
      preferenceMatch: 0.30,
      seasonalSuitability: 0.22,
      currentClimateCompatibility: 0.18,
      weatherForecastSuitability: 0.12,
      ratingReviews: 0.06,
      distanceEfficiency: 0.05,
      activityAvailability: 0.07
    };
  }

  if (style.includes('sightseeing')) {
    return {
      preferenceMatch: 0.28,
      seasonalSuitability: 0.18,
      currentClimateCompatibility: 0.12,
      weatherForecastSuitability: 0.08,
      ratingReviews: 0.16,
      distanceEfficiency: 0.12,
      activityAvailability: 0.06
    };
  }

  if (style.includes('relaxed')) {
    return {
      preferenceMatch: 0.28,
      seasonalSuitability: 0.22,
      currentClimateCompatibility: 0.18,
      weatherForecastSuitability: 0.12,
      ratingReviews: 0.08,
      distanceEfficiency: 0.08,
      activityAvailability: 0.04
    };
  }

  if (style.includes('budget')) {
    return {
      preferenceMatch: 0.25,
      seasonalSuitability: 0.18,
      currentClimateCompatibility: 0.12,
      weatherForecastSuitability: 0.08,
      ratingReviews: 0.08,
      distanceEfficiency: 0.24,
      activityAvailability: 0.05
    };
  }

  return {};
}

function getClimateStatus(score) {
  if (score >= 78) return 'Suitable';
  if (score >= 55) return 'Moderate';
  return 'Not Recommended';
}

function getWeatherRiskLevel(climate, score) {
  if ((climate.alerts || []).length > 0 || score < 45) return 'High';
  if ((climate.rainfallProbability || 0) > 60 || (climate.windKph || 0) > 30 || score < 70) return 'Medium';
  return 'Low';
}

function getCampingSuitability(place, preferences, climate) {
  const wantsCamping = (preferences.interests || []).includes('camping');
  const text = getPlaceKeywordText(place);
  const locationFits = /camp|hill|mountain|forest|lake|valley|nature|adventure/.test(text);

  if (!wantsCamping && !locationFits) return 'Not a camping-focused stop';
  if ((climate.rainfallProbability || 0) > 60 || (climate.windKph || 0) > 30 || (climate.alerts || []).length) {
    return 'Not recommended in current conditions';
  }
  return locationFits ? 'Suitable with local permission check' : 'Moderate';
}

function getWeatherUnsuitableActivities(preferences, climate) {
  const selected = preferences.interests || [];
  const suitable = new Set(getWeatherSuitableActivities(preferences, climate));
  return selected.filter(activity => !suitable.has(activity));
}

function buildClimateRecommendation(place, preferences, overrideClimate = null) {
  const climate = overrideClimate || getRegionalClimateProfile(place, preferences.startDate);
  const weighted = getWeightedRecommendationScore(place, preferences, climate);
  const climateScore = weighted.components.currentClimateCompatibility;
  const text = getPlaceKeywordText(place);
  const suitableActivities = getWeatherSuitableActivities(preferences, climate);
  const unsuitableActivities = getWeatherUnsuitableActivities(preferences, climate);
  const bestActivity = suitableActivities.find(interest => text.includes(interest)) ||
    suitableActivities[0] ||
    place.category ||
    (place.types || [])[0] ||
    'sightseeing';
  const bestTimeToVisit = getBestWeatherTimeWindow(bestActivity, climate);

  return {
    matchScore: weighted.score,
    seasonClimateSuitabilityScore: Math.round((
      weighted.components.seasonalSuitability * 0.45 +
      weighted.components.currentClimateCompatibility * 0.35 +
      weighted.components.weatherForecastSuitability * 0.20
    )),
    scoreBreakdown: weighted.components,
    scoreWeights: weighted.weights,
    season: climate.season,
    currentClimate: getClimateStatus(climateScore),
    weatherCondition: getWeatherCondition(climate),
    temperatureRange: climate.temperatureRange,
    weatherForecast: `${climate.rainfallProbability}% rain probability, ${climate.humidity}% humidity, wind around ${climate.windKph} km/h`,
    bestActivity,
    suitableActivities,
    unsuitableActivities,
    rescheduleAdvice: unsuitableActivities.length
      ? `Move ${unsuitableActivities.join(', ')} to a clearer or safer weather window.`
      : 'Selected activities fit this weather window.',
    bestTimeToVisit,
    recommendedStayDuration: getSuggestedVisitDuration(place),
    campingSuitability: getCampingSuitability(place, preferences, climate),
    weatherRiskLevel: getWeatherRiskLevel(climate, weighted.score),
    weatherAlerts: climate.alerts || [],
    climateDataSource: climate.source
  };
}

async function fetchOpenMeteoClimate(place, date) {
  const lat = place.location?.lat || place.coordinates?.lat;
  const lng = place.location?.lng || place.coordinates?.lng;
  if (!lat || !lng || !(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const travelDate = formatDate(date);
  const today = formatDate(new Date());
  const daysUntilTravel = Math.ceil((new Date(travelDate) - new Date(today)) / (1000 * 60 * 60 * 24));
  if (daysUntilTravel < 0 || daysUntilTravel > 15) return null;

  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      timeout: 2500,
      params: {
        latitude: lat,
        longitude: lng,
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
        hourly: 'relative_humidity_2m',
        timezone: 'auto',
        start_date: travelDate,
        end_date: travelDate
      }
    });
    const daily = response.data?.daily || {};
    const hourly = response.data?.hourly || {};
    const fallbackClimate = getRegionalClimateProfile(place, date);
    const minTemp = Number.isFinite(daily.temperature_2m_min?.[0])
      ? daily.temperature_2m_min[0]
      : parseTemperatureRange(fallbackClimate.temperatureRange).min;
    const maxTemp = Number.isFinite(daily.temperature_2m_max?.[0])
      ? daily.temperature_2m_max[0]
      : parseTemperatureRange(fallbackClimate.temperatureRange).max;
    const humidityValues = hourly.relative_humidity_2m || [];
    const averageHumidity = humidityValues.length
      ? Math.round(humidityValues.reduce((sum, value) => sum + value, 0) / humidityValues.length)
      : fallbackClimate.humidity;

    return {
      season: getIndianSeason(date),
      temperatureRange: `${Math.round(minTemp)}-${Math.round(maxTemp)} C`,
      rainfallProbability: daily.precipitation_probability_max?.[0] ?? fallbackClimate.rainfallProbability,
      humidity: averageHumidity,
      windKph: Math.round(daily.wind_speed_10m_max?.[0] || fallbackClimate.windKph),
      alerts: [],
      source: 'open_meteo_forecast'
    };
  } catch (error) {
    console.warn(`Weather forecast unavailable for ${place.name}: ${error.message}`);
    return null;
  }
}

async function enrichStopsWithLiveClimate(stops, preferences) {
  const enriched = [];

  for (const stop of stops) {
    if (stop.climateRecommendation) {
      enriched.push(stop);
      continue;
    }

    const liveClimate = await fetchOpenMeteoClimate(stop, preferences.startDate);
    const climateRecommendation = buildClimateRecommendation(stop, preferences, liveClimate);
    enriched.push({
      ...stop,
      climateRecommendation,
      matchScore: climateRecommendation.matchScore,
      seasonClimateSuitabilityScore: climateRecommendation.seasonClimateSuitabilityScore,
      weatherRiskLevel: climateRecommendation.weatherRiskLevel,
      currentClimate: climateRecommendation.currentClimate
    });
  }

  return enriched;
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
    preferredPlaceType: options.preferredPlaceType || options.placeType || '',
    travelStyle: options.travelStyle || '',
    startDate: options.startDate,
    endDate: options.endDate,
    scoreWeights: {
      ...getRecommendationWeightsForTravelStyle(options.travelStyle),
      ...(options.scoreWeights || options.recommendationWeights || {})
    },
    maxDetourKm: Math.min(60, Math.max(15, maxDetourKm)),
    minRating,
    maxAttractionsPerDay: Math.max(1, maxAttractionsPerDay),
    avoid: avoid.map(item => String(item).toLowerCase()),
    missingPreferences: options.missingPreferences || [],
    preferenceProfile: options.preferenceProfile || null,
    tripMemory: options.tripMemory || null
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

function parseDurationToMinutes(durationText) {
  if (typeof durationText === 'number') return Math.round(durationText * 60);
  const text = String(durationText || '').toLowerCase();
  if (!text) return 0;

  const dayMatch = text.match(/(\d+(?:\.\d+)?)\s*d/);
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
  const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*m/);
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*hours?/);

  if (rangeMatch) {
    return Math.round(((Number.parseFloat(rangeMatch[1]) + Number.parseFloat(rangeMatch[2])) / 2) * 60);
  }

  const days = dayMatch ? Number.parseFloat(dayMatch[1]) : 0;
  const hours = hourMatch ? Number.parseFloat(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number.parseFloat(minuteMatch[1]) : 0;
  const total = days * 24 * 60 + hours * 60 + minutes;

  if (total > 0) return Math.round(total);

  const plainHours = text.match(/(\d+(?:\.\d+)?)\s*hours?/);
  return plainHours ? Math.round(Number.parseFloat(plainHours[1]) * 60) : 0;
}

function getRouteDistanceKm(routePlan) {
  return Number(routePlan?.distance || routePlan?.primaryRoute?.distance || routePlan?.totalDistance || 0);
}

function isGenericStopName(name) {
  return /^(view\s*point|viewpoint|sunset view point|sunrise view point|hill view|water falls?|reserve forest area|eco trekking)/i
    .test(String(name || '').trim());
}

function isRealisticCorridorStop(place, routeDistanceKm) {
  if (!place?.name) return false;
  if (routeDistanceKm > 0) {
    const order = Number(place.journeyOrder || place.routeSectionKm || 0);
    if (order < ROAD_TRIP_CONFIG.routeStartEndBufferKm) return false;
    if (order > routeDistanceKm - ROAD_TRIP_CONFIG.routeStartEndBufferKm) return false;
  }
  if (isGenericStopName(place.name) && (place.userRatingsTotal || 0) < ROAD_TRIP_CONFIG.minimumGenericStopReviews) {
    return false;
  }
  return true;
}

function buildSegmentFeasibility(routePlan, days, transportMode, vehicleType) {
  const baseDrivingMinutes = parseDurationToMinutes(routePlan?.primaryRoute?.estimatedDuration || routePlan?.totalDuration);
  const selectedStops = routePlan?.intermediateStops || [];
  const sightseeingMinutes = selectedStops.reduce((sum, stop) => sum + Number(stop.totalExtraTimeMinutes || 0), 0);
  const dailyTravelMinutes = getDailyTravelMinutesLimit(transportMode, vehicleType);
  const dailySightseeingMinutes = getDailySightseeingMinutesLimit(transportMode, vehicleType);
  const totalWorkMinutes = baseDrivingMinutes + sightseeingMinutes;
  const feasibleMinutes = days * dailyTravelMinutes;
  const averageDailyMinutes = days > 0 ? Math.round(totalWorkMinutes / days) : totalWorkMinutes;
  const averageDailyHours = Math.round((averageDailyMinutes / 60) * 10) / 10;
  const averageStopMinutes = 150;
  const maxStopsByTime = Math.max(0, Math.floor((days * dailySightseeingMinutes) / averageStopMinutes));

  return {
    days,
    baseDrivingHours: Math.round((baseDrivingMinutes / 60) * 10) / 10,
    stopTimeHours: Math.round((sightseeingMinutes / 60) * 10) / 10,
    averageDailyHours,
    dailyTravelLimitHours: Math.round((dailyTravelMinutes / 60) * 10) / 10,
    selectedStops: selectedStops.length,
    feasible: totalWorkMinutes <= feasibleMinutes,
    reason: totalWorkMinutes <= feasibleMinutes
      ? `Balanced for ${days} travel day${days === 1 ? '' : 's'} with ${selectedStops.length} selected stop${selectedStops.length === 1 ? '' : 's'}.`
      : `Too much driving and sightseeing for ${days} travel day${days === 1 ? '' : 's'}; reduce stops or add days.`,
    maxSuggestedStops: Math.min(days * 2, maxStopsByTime)
  };
}

function buildTripFeasibility(routePlan, numDays, transportMode, vehicleType) {
  const onward = buildSegmentFeasibility(routePlan.onwardRoute, routePlan.phases.onwardDays, transportMode, vehicleType);
  const returning = buildSegmentFeasibility(routePlan.returnRoute, routePlan.phases.returnDays, transportMode, vehicleType);
  const highRiskStops = (routePlan.intermediateStops || []).filter(stop =>
    stop.weatherRiskLevel === 'High' || stop.climateRecommendation?.weatherRiskLevel === 'High'
  );
  const notRecommendedClimateStops = (routePlan.intermediateStops || []).filter(stop =>
    stop.currentClimate === 'Not Recommended' || stop.climateRecommendation?.currentClimate === 'Not Recommended'
  );
  const isFeasible = onward.feasible && returning.feasible;
  const minimumComfortableDays = Math.max(
    numDays,
    Math.ceil((onward.baseDrivingHours + onward.stopTimeHours + returning.baseDrivingHours + returning.stopTimeHours) / 7)
  );

  return {
    status: isFeasible ? 'Realistic' : 'Too rushed',
    isFeasible,
    minimumComfortableDays,
    onward,
    return: returning,
    selectedStops: (routePlan.intermediateStops || []).length,
    highRiskStopCount: highRiskStops.length,
    notRecommendedClimateStopCount: notRecommendedClimateStops.length,
    notes: [
      isFeasible
        ? 'The plan fits conservative daily driving and sightseeing limits.'
        : `The trip needs about ${minimumComfortableDays} days for a comfortable pace.`,
      highRiskStops.length
        ? `${highRiskStops.length} stop${highRiskStops.length === 1 ? '' : 's'} still have high weather risk.`
        : '',
      notRecommendedClimateStops.length
        ? `${notRecommendedClimateStops.length} selected stop${notRecommendedClimateStops.length === 1 ? '' : 's'} have Not Recommended climate fit.`
        : ''
    ].filter(Boolean)
  };
}

function scoreCorridorPlace(place, preferences) {
  const fameScore = calculateFameScore(place);
  const fameComponent = fameScore * 100;
  const ratingScore = Math.min(100, ((place.rating || 4.0) / 5) * 100);
  const reviewScore = Math.min(100, Math.log10((place.userRatingsTotal || 0) + 1) * 25);
  const detourScore = Math.max(0, 100 - ((place.distanceFromRouteKm || 0) / (preferences.maxDetourKm || 40)) * 100);
  const popularityScore = getTouristPopularityScore(place);
  const categoryScore = Math.min(100, place.categoryPriority || 0);
  const preferenceScore = getPreferenceMatchScore(place, preferences.companionType, preferences.numberOfTravelers);
  const climateRecommendation = buildClimateRecommendation(place, preferences);

  // 17-dimension user preference matching
  let dynamicPrefBonus = 0;
  if (preferences.preferenceProfile) {
    const affinity = calculatePOIPreferenceMatch(place, preferences.preferenceProfile);
    dynamicPrefBonus = (affinity.score || 0) * 30; // up to 30 points
  }

  // Missing preference boost (especially on Return journey to fill gaps)
  let missingPrefBonus = 0;
  if (preferences.missingPreferences && preferences.missingPreferences.length > 0) {
    const placeCat = String(place.category || place.type || '').toLowerCase();
    const matchesMissing = preferences.missingPreferences.some(dim => {
      const dimName = String(dim?.dimension || dim || '').toLowerCase();
      return dimName && placeCat.includes(dimName);
    });
    if (matchesMissing) {
      missingPrefBonus = 25; // boost candidate to prioritize uncovered categories
    }
  }

  // Experience repetition penalty (avoid multiple identical experiences)
  let experiencePenalty = 0;
  if (preferences.tripMemory) {
    experiencePenalty = preferences.tripMemory.calculateExperiencePenalty(place) * 20;
  }

  return Math.max(0, Math.round((
    climateRecommendation.matchScore * 0.25 +
    ratingScore * 0.15 +
    fameComponent * 0.20 +
    reviewScore * 0.10 +
    detourScore * 0.15 +
    popularityScore * 0.05 +
    categoryScore * 0.05 +
    preferenceScore +
    dynamicPrefBonus +
    missingPrefBonus -
    experiencePenalty
  ) * 10) / 10);
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

  const fameScore = calculateFameScore(candidate);
  const isExceptional = fameScore >= 0.85 || candidate.isUNESCO || candidate.isNationalHeritage || (candidate.userRatingsTotal || candidate.reviews || 0) >= 5000;

  // 4-tier detour limits: Tier 1 (0-20km), Tier 2 (20-40km), Tier 3 (40-60km), Tier 4 (60-80km for exceptional)
  const maxAllowableDetour = isExceptional
    ? (ROAD_TRIP_CONFIG.exceptionalMaxDistanceFromRouteKm || 80)
    : (ROAD_TRIP_CONFIG.maxDistanceFromRouteKm || 60);

  if (nearest.distanceKm > maxAllowableDetour) return null;

  // Filter out places right at origin departure curb or destination arrival curb
  const startEndBufferKm = ROAD_TRIP_CONFIG.routeStartEndBufferKm || 20;
  const totalRouteDistKm = routePoints[routePoints.length - 1]?.distanceAlongRoute || 1000;
  if (nearest.point.distanceAlongRoute < startEndBufferKm || nearest.point.distanceAlongRoute > totalRouteDistKm - startEndBufferKm) {
    return null;
  }

  // Minimum rating pruning with protection for high-fame/heritage attractions
  const effectiveMinRating = isExceptional ? 3.8 : (preferences.minRating || 4.0);
  if ((candidate.rating || 0) > 0 && (candidate.rating || 0) < effectiveMinRating) return null;

  const detourDistance = Math.round(nearest.distanceKm * 2 * 10) / 10;
  const detourTime = Math.max(8, Math.round((detourDistance / 45) * 60)); // ~45 km/h on detour access roads
  const visitDurationMinutes = calculateVisitDurationMinutes(candidate);
  const distanceAlongRouteKm = Math.round(nearest.point.distanceAlongRoute * 10) / 10;

  const enriched = {
    ...candidate,
    phase,
    fameScore,
    isMustVisit: isExceptional,
    distanceFromRouteKm: Math.round(nearest.distanceKm * 10) / 10,
    detourDistance,
    detourTime,
    drivingTime: `${Math.round((distanceAlongRouteKm / 65) * 10) / 10} hr from route start`,
    visitDurationMinutes,
    estimatedVisitTime: `${Math.floor(visitDurationMinutes / 60)} hr ${visitDurationMinutes % 60} min`,
    totalExtraTimeMinutes: detourTime + visitDurationMinutes,
    journeyOrder: distanceAlongRouteKm,
    routeSectionKm: distanceAlongRouteKm,
    distanceAlongRouteKm,
    routePointIndex: nearest.point.routeIndex,
    googleMapsLink: buildGoogleMapsLink(candidate),
    imageUrl: candidate.imageUrl || null,
    bestTimeToVisit: getBestTimeToVisit(candidate),
    suggestedVisitDuration: getSuggestedVisitDuration(candidate)
  };

  enriched.climateRecommendation = buildClimateRecommendation(enriched, preferences);
  enriched.matchScore = enriched.climateRecommendation.matchScore;
  enriched.seasonClimateSuitabilityScore = enriched.climateRecommendation.seasonClimateSuitabilityScore;
  enriched.weatherRiskLevel = enriched.climateRecommendation.weatherRiskLevel;
  enriched.currentClimate = enriched.climateRecommendation.currentClimate;
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

function optimizeCorridorStops(places, days, preferences, routeContext = {}) {
  const numDays = Math.max(1, Number(days) || 1);
  const routeDistanceKm = Number(routeContext.routeDistanceKm || 0);
  const maxAttractionsPerDay = Number(preferences.maxAttractionsPerDay) || ROAD_TRIP_CONFIG.maxAttractionsPerDay || 2;
  const maxStops = Math.max(1, numDays * maxAttractionsPerDay);

  // Compute daily leg driving and available sightseeing budget
  const dailyKm = numDays > 0 ? (routeDistanceKm / numDays) : routeDistanceKm;
  const dailyDrivingMinutes = Math.round((dailyKm / 65) * 60);
  // Active daytime is 07:00 AM to 08:30 PM (810 mins).
  // 120 mins reserved for meals/fuel/rest breaks.
  // Daily sightseeing budget is between 90 and 270 mins per travel day.
  const dailySightseeingMinutes = Math.max(90, Math.min(270, 780 - dailyDrivingMinutes - 120));
  const sightseeingBudgetMinutes = numDays * dailySightseeingMinutes;

  const ordered = [...places].sort((a, b) =>
    (a.journeyOrder || 0) - (b.journeyOrder || 0) ||
    (b.aiRecommendationScore || 0) - (a.aiRecommendationScore || 0)
  );

  const selected = [];
  let lastOrder = -Infinity;
  let usedExtraMinutes = 0;
  const categoryCounts = {};

  for (const place of ordered) {
    if (selected.length >= maxStops) break;
    if (!isRealisticCorridorStop(place, routeDistanceKm)) continue;

    const cat = String(place.category || 'attraction').toLowerCase();
    const currentCatCount = categoryCounts[cat] || 0;
    // Diversity constraint: max 2 of any category per segment unless exceptional
    if (currentCatCount >= 2 && (place.fameScore || 0) < 0.90) continue;

    const isNearLastStop =
      selected.length > 0 &&
      Math.abs((place.journeyOrder || 0) - lastOrder) < ROAD_TRIP_CONFIG.minimumStopSpacingKm;
    const placeExtraMinutes = Number(place.totalExtraTimeMinutes || 45);

    // Hard feasibility check on budget
    if (usedExtraMinutes + placeExtraMinutes > sightseeingBudgetMinutes && selected.length >= numDays) {
      continue;
    }

    if (isNearLastStop) {
      const previous = selected[selected.length - 1];
      const previousExtraMinutes = Number(previous.totalExtraTimeMinutes || 45);
      if ((place.aiRecommendationScore || 0) > (previous.aiRecommendationScore || 0) + 8) {
        selected[selected.length - 1] = place;
        lastOrder = place.journeyOrder || 0;
        usedExtraMinutes = usedExtraMinutes - previousExtraMinutes + placeExtraMinutes;
      }
      continue;
    }

    selected.push(place);
    lastOrder = place.journeyOrder || 0;
    usedExtraMinutes += placeExtraMinutes;
    categoryCounts[cat] = currentCatCount + 1;
  }

  return selected.sort((a, b) => (a.journeyOrder || 0) - (b.journeyOrder || 0));
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

  // Multi-Segment Landmark Discovery Engine candidates
  let adaptedCorridorPlaces = [];
  try {
    const corridorDiscovered = await discoverAllRouteCandidates({
      startLocation,
      destination,
      userPreferences: {
        activities: Array.isArray(interests) ? interests.join(',') : interests,
        preferredPlaceType: options.preferredPlaceType
      },
      maxPlaces: 35
    });

    adaptedCorridorPlaces = corridorDiscovered.map(p => ({
      name: p.name,
      placeId: p.placeId,
      rating: p.rating,
      userRatingsTotal: p.reviews,
      types: [p.category],
      location: p.coordinates,
      formattedAddress: `${p.name}, ${p.city}, ${p.state}`
    }));
  } catch (err) {
    console.warn('Corridor discovery engine warning:', err.message);
  }

  // Precomputed candidates integration if already discovered upstream
  let precomputedPlaces = [];
  if (Array.isArray(options.precomputedRouteDiscovery?.allCandidates)) {
    precomputedPlaces = options.precomputedRouteDiscovery.allCandidates.map(p => ({
      name: p.name,
      placeId: p.placeId,
      rating: p.rating,
      userRatingsTotal: p.reviews,
      types: [p.category],
      location: p.coordinates,
      formattedAddress: `${p.name}, ${p.city}, ${p.state}`
    }));
  }

  const allCandidatePool = [...rawCandidates, ...adaptedCorridorPlaces, ...precomputedPlaces];
  const excludedPlaceIds = new Set(options.excludePlaceIds || []);
  const excludedPlaceNames = new Set((options.excludePlaceNames || []).map(name => String(name).toLowerCase()));
  const validatedPlaces = allCandidatePool
    .filter(place => !excludedPlaceIds.has(place.placeId))
    .filter(place => !excludedPlaceNames.has(String(place.name || '').toLowerCase()))
    .map(place => decorateCorridorCandidate(place, routePoints, preferences, phase))
    .filter(Boolean);

  const dedupedPlaces = dedupeCorridorPlaces(validatedPlaces);
  let optimizedPlaces = optimizeCorridorStops(dedupedPlaces, numDays, preferences, {
    baseDuration: directionsResult.duration,
    routeDistanceKm: directionsResult.distance,
    transportMode,
    vehicleType: options.vehicleType
  })
    .map((place, index) => ({
      ...place,
      journeyOrder: index + 1,
      routeSectionKm: Number(place.distanceAlongRouteKm || place.routeSectionKm || 0)
    }));
  optimizedPlaces = await enrichStopsWithLiveClimate(optimizedPlaces, preferences);

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
    matchScore: stop.matchScore || stop.climateRecommendation?.matchScore,
    seasonClimateSuitabilityScore: stop.seasonClimateSuitabilityScore || stop.climateRecommendation?.seasonClimateSuitabilityScore,
    currentClimate: stop.currentClimate || stop.climateRecommendation?.currentClimate,
    weatherRiskLevel: stop.weatherRiskLevel || stop.climateRecommendation?.weatherRiskLevel,
    climateRecommendation: stop.climateRecommendation,
    phase: stop.phase,
    location: stop.location,
    routeSectionKm: stop.routeSectionKm || stop.distanceAlongRouteKm || 0,
    distanceAlongRouteKm: stop.distanceAlongRouteKm || stop.routeSectionKm || 0
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
    matchScore: stop.matchScore || stop.climateRecommendation?.matchScore || 0,
    seasonClimateSuitabilityScore: stop.seasonClimateSuitabilityScore || stop.climateRecommendation?.seasonClimateSuitabilityScore || 0,
    currentClimate: stop.currentClimate || stop.climateRecommendation?.currentClimate,
    weatherRiskLevel: stop.weatherRiskLevel || stop.climateRecommendation?.weatherRiskLevel,
    climateRecommendation: stop.climateRecommendation,
    journeyOrder: stop.journeyOrder,
    routeSectionKm: stop.routeSectionKm,
    phase: stop.phase || fallbackPhase,
    reason: stop.reason,
    bestTimeToVisit: stop.bestTimeToVisit
  };
}

async function buildDestinationStayPlan(destination, stayDays, activities, accommodationDetails, preferences = {}, options = {}) {
  const destinationClimateRecommendation = buildClimateRecommendation({
    name: destination,
    category: preferences.preferredPlaceType || 'destination',
    categories: preferences.interests || [],
    rating: 4.4,
    userRatingsTotal: 1000
  }, preferences);

  let dynamicDailyPlans = [];
  try {
    const dynamicResult = await dynamicTravelPlanner({
      destination,
      numberOfDays: Math.max(1, stayDays),
      userPreferences: {
        activities: Array.isArray(preferences.interests) ? preferences.interests.join(',') : preferences.interests,
        preferredPlaceType: preferences.preferredPlaceType,
        travelStyle: preferences.travelStyle || 'balanced'
      },
      dailyStartTime: options.dailyStartTime || '08:00',
      dailyEndTime: options.dailyEndTime || '21:00',
      transportMode: options.transportMode || 'car'
    });

    if (dynamicResult && Array.isArray(dynamicResult.dailyItinerary)) {
      dynamicDailyPlans = dynamicResult.dailyItinerary;
    }
  } catch (err) {
    console.warn('Dynamic planner fallback:', err.message);
  }

  return Array.from({ length: stayDays }, (_, index) => {
    const dynamicDay = dynamicDailyPlans[index];
    const dayActivities = dynamicDay?.activities?.length > 0
      ? dynamicDay.activities
      : activities.filter(activity => (activity.estimatedDay || 1) % Math.max(stayDays, 1) === index % Math.max(stayDays, 1));

    const focus = dayActivities.length > 0
      ? dayActivities.map(activity => activity.name || activity.rawName).join(', ')
      : `local sightseeing, food walks, markets, and relaxed exploration in ${destination}`;

    return {
      dayOffset: index + 1,
      title: `Destination stay in ${destination}`,
      focus,
      activities: dayActivities,
      detailedSchedule: dynamicDay?.plan || '',
      stops: dynamicDay?.stops || [],
      accommodationPlan: `Stay at ${accommodationDetails.type}`,
      mealPlan: `Breakfast near accommodation, lunch near sightseeing area, dinner at a well-rated local restaurant`,
      climateRecommendation: destinationClimateRecommendation
    };
  });
}

function buildDailyWeatherPlan(dayClimateRecommendation, fallbackActivities = []) {
  if (!dayClimateRecommendation) {
    return {
      weatherCondition: 'Unknown',
      selectedActivities: fallbackActivities.map(activity => activity.name || activity).filter(Boolean),
      movedActivities: [],
      bestTimeWindow: 'Morning or late afternoon',
      campingSuitability: 'Unknown',
      note: 'Weather data was not available for this day.'
    };
  }

  return {
    weatherCondition: dayClimateRecommendation.weatherCondition,
    forecast: dayClimateRecommendation.weatherForecast,
    selectedActivities: dayClimateRecommendation.suitableActivities || [],
    movedActivities: dayClimateRecommendation.unsuitableActivities || [],
    bestActivity: dayClimateRecommendation.bestActivity,
    bestTimeWindow: dayClimateRecommendation.bestTimeToVisit,
    campingSuitability: dayClimateRecommendation.campingSuitability,
    weatherRiskLevel: dayClimateRecommendation.weatherRiskLevel,
    note: dayClimateRecommendation.rescheduleAdvice
  };
}

function splitStopsAcrossJourneyDays(stops, days, routeDistanceKm) {
  const buckets = Array.from({ length: days }, () => []);
  if (!stops.length || days <= 0) return buckets;

  const safeDistance = Math.max(1, Number(routeDistanceKm || stops[stops.length - 1]?.routeSectionKm || 1));

  for (const stop of stops) {
    const sectionKm = Number(stop.routeSectionKm || stop.journeyOrder || 0);
    const dayIndex = Math.min(
      days - 1,
      Math.max(0, Math.floor((sectionKm / safeDistance) * days))
    );
    buckets[dayIndex].push(stop);
  }

  return buckets.map(dayStops =>
    dayStops
      .sort((a, b) => (a.routeSectionKm || a.journeyOrder || 0) - (b.routeSectionKm || b.journeyOrder || 0))
      .slice(0, ROAD_TRIP_CONFIG.maxAttractionsPerDay)
  );
}

function resolveIntermediateOvernightHub({ routePlan, dayIndex, totalDays, dayStops = [], fromCity, toCity }) {
  if (dayIndex >= totalDays - 1) {
    return toCity;
  }

  // 1. If today has scheduled stops, check the last scheduled stop
  if (dayStops.length > 0) {
    const lastStop = dayStops[dayStops.length - 1];
    if (lastStop.city && !String(lastStop.city).toLowerCase().includes(String(fromCity).toLowerCase())) {
      return lastStop.city;
    }
    if (lastStop.formattedAddress) {
      const parts = lastStop.formattedAddress.split(',');
      if (parts.length >= 2) {
        const potentialCity = parts[parts.length - 2].trim();
        if (potentialCity && !potentialCity.toLowerCase().includes(String(fromCity).toLowerCase())) {
          return potentialCity;
        }
      }
    }
    if (lastStop.name) {
      return `${lastStop.name} Vicinity`;
    }
  }

  // 2. Estimate target route km for this intermediate day
  const totalKm = Number(routePlan?.distance || routePlan?.primaryRoute?.distance || routePlan?.totalDistance || 600);
  const targetKm = Math.round(((dayIndex + 1) / totalDays) * totalKm);

  // Find route coordinate closest to targetKm
  const routePoints = routePlan?.routeCoordinates || [];
  let targetCoord = null;
  if (routePoints.length > 0) {
    let closestDiff = Infinity;
    for (const pt of routePoints) {
      const ptDist = pt.distanceAlongRoute || 0;
      const diff = Math.abs(ptDist - targetKm);
      if (diff < closestDiff) {
        closestDiff = diff;
        targetCoord = pt;
      }
    }
  }

  // 3. Search landmark database near targetCoord
  if (targetCoord && Array.isArray(FAMOUS_LANDMARKS_DATABASE)) {
    let closestLandmark = null;
    let minDistance = 85; // km

    for (const lm of FAMOUS_LANDMARKS_DATABASE) {
      if (lm.coordinates && lm.city) {
        const d = calculateStraightLineDistanceKm(targetCoord, lm.coordinates);
        if (d !== null && d < minDistance && !String(lm.city).toLowerCase().includes(String(fromCity).toLowerCase())) {
          minDistance = d;
          closestLandmark = lm;
        }
      }
    }

    if (closestLandmark && closestLandmark.city) {
      return closestLandmark.city;
    }
  }

  // 4. Corridor segment towns fallback
  const segments = segmentRoute(fromCity, toCity);
  if (segments && segments.length > 1) {
    const segIdx = Math.min(segments.length - 1, Math.max(0, Math.floor(((dayIndex + 1) / totalDays) * (segments.length - 1))));
    const candidate = segments[segIdx];
    if (candidate && !candidate.toLowerCase().includes(fromCity.toLowerCase())) {
      return candidate;
    }
  }

  return `Highway Corridor Hub (km ${targetKm})`;
}

function buildTimelineForDayStops(stopsOrOptions, dayPhase, startCity, endCity, accommodationType, isFinalPhaseDay = true, dayStartKm = 0, dayEndKm = 0) {
  let stops = [];
  let phase = 'Onward Journey';
  let start = 'Origin';
  let end = 'Destination';
  let hotelType = 'Accommodation';
  let isFinal = true;
  let startKm = 0;
  let endKm = 0;

  if (stopsOrOptions && typeof stopsOrOptions === 'object' && !Array.isArray(stopsOrOptions)) {
    stops = stopsOrOptions.stops || [];
    phase = stopsOrOptions.dayPhase || 'Onward Journey';
    start = stopsOrOptions.startCity || 'Origin';
    end = stopsOrOptions.endCity || 'Destination';
    hotelType = stopsOrOptions.accommodationType || 'Accommodation';
    isFinal = stopsOrOptions.isFinalPhaseDay !== undefined ? stopsOrOptions.isFinalPhaseDay : true;
    startKm = Number(stopsOrOptions.dayStartKm) || 0;
    endKm = Number(stopsOrOptions.dayEndKm) || 0;
  } else {
    stops = stopsOrOptions || [];
    phase = dayPhase || 'Onward Journey';
    start = startCity || 'Origin';
    end = endCity || 'Destination';
    hotelType = accommodationType || 'Accommodation';
    isFinal = isFinalPhaseDay !== undefined ? isFinalPhaseDay : true;
    startKm = Number(dayStartKm) || 0;
    endKm = Number(dayEndKm) || 0;
  }

  const timeline = [];
  let currentMinutes = 7 * 60; // 07:00 AM start
  let currentKm = startKm;
  const targetEndKm = endKm > startKm
    ? endKm
    : (stops.length ? Math.max(...stops.map(s => Number(s.routeSectionKm || s.distanceAlongRouteKm || 0))) + 60 : startKm + 350);

  // 1. Morning Departure
  timeline.push({
    time: formatMinutesTo12(currentMinutes),
    place: `Depart from ${start}`,
    category: 'travel',
    travelTime: '0 mins',
    visitDuration: '15 mins',
    bestVisitWindow: 'Early Morning (06:30 AM - 07:30 AM)',
    traffic: 'Smooth Morning Highway Flow',
    cost: '₹0',
    reason: `Start the day early from ${start} to maximize daylight sightseeing and avoid city congestion.`
  });
  currentMinutes += 15;

  // 2. Breakfast Window
  const firstStop = stops[0];
  const firstStopKm = firstStop ? Number(firstStop.routeSectionKm || firstStop.distanceAlongRouteKm || currentKm + 60) : currentKm + 90;
  const distToFirst = Math.max(0, firstStopKm - currentKm);

  if (distToFirst > 60) {
    const bDriveKm = Math.min(distToFirst - 20, Math.round(distToFirst * 0.45));
    const bDriveMins = Math.max(35, Math.round((bDriveKm / 65) * 60));
    currentMinutes += bDriveMins;
    currentKm += bDriveKm;
    timeline.push({
      time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 45)}`,
      place: `Regional Breakfast Stop near ${start} Corridor`,
      category: 'meal',
      travelTime: `${bDriveMins} mins (${bDriveKm} km transit)`,
      visitDuration: '45 mins',
      bestVisitWindow: 'Breakfast Window (08:00 AM - 09:30 AM)',
      traffic: 'Normal Highway Flow',
      cost: '₹120',
      reason: 'Authentic local highway breakfast and morning driving break.'
    });
    currentMinutes += 45;
  } else {
    currentMinutes += 20;
    currentKm += 15;
    timeline.push({
      time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 40)}`,
      place: `Morning Breakfast Halt near ${start}`,
      category: 'meal',
      travelTime: '20 mins (15 km transit)',
      visitDuration: '40 mins',
      bestVisitWindow: 'Breakfast Window (07:30 AM - 09:00 AM)',
      traffic: 'Normal Highway Flow',
      cost: '₹120',
      reason: 'Quick breakfast before reaching the morning attraction.'
    });
    currentMinutes += 40;
  }

  // 3. Sightseeing Stops & Lunch Halt
  let lunchInserted = false;

  stops.forEach((stop) => {
    const stopKm = Number(stop.routeSectionKm || stop.distanceAlongRouteKm || (currentKm + 40));
    const legTransitKm = Math.max(10, stopKm - currentKm);
    const legDrivingMins = Math.round((legTransitKm / 65) * 60);
    const detourMins = Number(stop.detourTime) || 15;
    const totalTravelMins = legDrivingMins + detourMins;

    // Check if lunch should happen before this stop
    if (!lunchInserted && currentMinutes + totalTravelMins >= 12 * 60 + 30) {
      const lunchDriveKm = Math.max(10, Math.round(legTransitKm * 0.4));
      const lunchDriveMins = Math.round((lunchDriveKm / 65) * 60);
      currentMinutes += lunchDriveMins;
      currentKm += lunchDriveKm;

      timeline.push({
        time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 60)}`,
        place: `Authentic Regional Lunch & Rest Halt near ${stop.city || 'Highway Corridor'}`,
        category: 'meal',
        travelTime: `${lunchDriveMins} mins (${lunchDriveKm} km transit)`,
        visitDuration: '60 mins',
        bestVisitWindow: 'Lunch Window (12:30 PM - 02:30 PM)',
        traffic: 'Normal Flow',
        cost: '₹220',
        reason: 'Mandatory driver rest break and regional dining to restore energy for afternoon exploration.'
      });
      currentMinutes += 60;
      lunchInserted = true;

      // Recalculate remaining leg to stop
      const remTransitKm = Math.max(5, stopKm - currentKm);
      const remTravelMins = Math.round((remTransitKm / 65) * 60) + detourMins;
      currentMinutes += remTravelMins;
      currentKm = stopKm;
    } else {
      currentMinutes += totalTravelMins;
      currentKm = stopKm;
    }

    const durMins = Number(stop.durationMinutes) || Number(stop.visitDurationMinutes) || 75;
    const bestWin = stop.bestTimeToVisit || 'Morning to Afternoon';
    const costVal = stop.entryFee !== undefined ? stop.entryFee : (stop.cost || 50);
    const detourDist = stop.detourDistance || stop.distanceFromRouteKm || 0;

    timeline.push({
      time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + durMins)}`,
      place: stop.name,
      category: stop.category || (stop.types ? stop.types[0] : 'attraction'),
      travelTime: `${totalTravelMins} mins (${legTransitKm} km highway + ${detourDist} km detour)`,
      visitDuration: `${Math.floor(durMins / 60)}h ${durMins % 60}m`,
      bestVisitWindow: bestWin,
      traffic: 'Normal Highway Flow',
      cost: `₹${costVal}`,
      reason: stop.whyRecommended || stop.reason || 'Curated high-affinity attraction matching your travel preferences.'
    });
    currentMinutes += durMins + 15; // 15 min buffer
  });

  // Ensure lunch is recorded if not inserted yet
  if (!lunchInserted) {
    const lunchTime = Math.max(currentMinutes, 13 * 60 + 15);
    timeline.push({
      time: `${formatMinutesTo12(lunchTime)} – ${formatMinutesTo12(lunchTime + 60)}`,
      place: `Authentic Regional Lunch & Rest Halt`,
      category: 'meal',
      travelTime: '20 mins',
      visitDuration: '60 mins',
      bestVisitWindow: 'Lunch Window (12:30 PM - 02:30 PM)',
      traffic: 'Normal Flow',
      cost: '₹220',
      reason: 'Midday meal and driver relaxation break.'
    });
    currentMinutes = lunchTime + 60;
  }

  // 4. Final Leg to endCity
  const finalLegKm = Math.max(15, targetEndKm - currentKm);
  const finalTransitMins = Math.round((finalLegKm / 65) * 60);
  currentMinutes += finalTransitMins;

  const checkInTime = Math.max(19 * 60, currentMinutes);
  const checkInDuration = 75;

  const checkInPlace = isFinal
    ? `Dinner & Check-in at ${hotelType} (${end}) — Final Destination Arrival`
    : `Dinner & Intermediate Overnight Stay at ${hotelType} (${end})`;

  const checkInReason = isFinal
    ? `Arrival at final destination ${end}. Check into accommodation, dinner with regional dishes, and rest for destination stay.`
    : `End of today's travel leg in ${end}. Settle into accommodation, enjoy dinner, and recharge before resuming onward road trip tomorrow.`;

  timeline.push({
    time: `${formatMinutesTo12(checkInTime)} – ${formatMinutesTo12(checkInTime + checkInDuration)}`,
    place: checkInPlace,
    category: 'hotel',
    travelTime: `${finalTransitMins} mins (${finalLegKm} km transit)`,
    visitDuration: `${checkInDuration} mins`,
    bestVisitWindow: 'Evening (07:00 PM - 09:00 PM)',
    traffic: 'Evening City Transit',
    cost: '₹250',
    reason: checkInReason
  });

  return timeline;
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
    const routeTotalDist = getRouteDistanceKm(routePlan);
    const dayStopBuckets = splitStopsAcrossJourneyDays(stops, days, routeTotalDist);

    let currentDepartureCity = from;

    for (let index = 0; index < days; index += 1) {
      const dayStops = dayStopBuckets[index] || [];
      const service = services[index] || {};
      const isFinalPhaseDay = index === days - 1;

      // Determine day's arrival city
      const dayArrivalCity = resolveIntermediateOvernightHub({
        routePlan,
        dayIndex: index,
        totalDays: days,
        dayStops,
        fromCity: from,
        toCity: to
      });

      const dayStartKm = Math.round((index / days) * routeTotalDist);
      const dayEndKm = Math.round(((index + 1) / days) * routeTotalDist);

      let plan = `**${phaseName} - Day ${index + 1}**\n\n`;

      plan += `**Route:** ${currentDepartureCity} to ${dayArrivalCity}\n`;
      plan += `**Date:** ${formatDate(addDays(startDate, dayNumber - 1))}\n`;
      plan += `**Travel Target:** ${isFinalPhaseDay ? `Reach final destination ${to}` : `Overnight stop at ${dayArrivalCity} after highway corridor exploration`}\n`;
      plan += `**Daily Travel Limit:** About ${phases.dailyTravelLimitKm} km before major rest\n\n`;

      if (dayStops.length > 0) {
        const dayClimate = dayStops[0].climateRecommendation;
        if (dayClimate) {
          plan += `**Weather Window:** ${dayClimate.weatherCondition}; ${dayClimate.weatherForecast}\n`;
          plan += `**Best Activity Today:** ${dayClimate.bestActivity} during ${dayClimate.bestTimeToVisit}\n`;
          if (dayClimate.unsuitableActivities?.length) {
            plan += `**Move/Avoid Today:** ${dayClimate.unsuitableActivities.join(', ')}\n`;
          }
          plan += '\n';
        }

        plan += `**Worthwhile Detours:**\n`;
        for (const stop of dayStops) {
          plan += `- **${stop.name}** (${stop.category || (stop.types ? stop.types[0] : 'attraction')})\n`;
          plan += `  * Rating: ${stop.rating || stop.googleRating || 4.5}/5 from ${stop.userRatingsTotal || stop.reviews || 0} reviews\n`;
          plan += `  * Distance from route: ${stop.distanceFromRouteKm || stop.detourDistance || 0} km\n`;
          plan += `  * Detour time: ${stop.detourTime || 15} minutes\n`;
          plan += `  * Visit duration: ${stop.suggestedVisitDuration || '1-2 hours'}\n`;
          plan += `  * Best time: ${stop.bestTimeToVisit || 'Morning to Afternoon'}\n`;
          plan += `  * Why: ${stop.whyRecommended || stop.reason}\n\n`;
        }
      } else {
        plan += `**Worthwhile Detours:** Direct highway transit leg along the ${currentDepartureCity} to ${dayArrivalCity} corridor; keep this stretch efficient without unnecessary detours.\n\n`;
      }

      plan += `**Food:** ${service.restaurantPlan || `Eat at a well-rated restaurant on the ${currentDepartureCity}-${dayArrivalCity} corridor`}\n`;
      plan += `**Fuel/Transit:** ${service.fuelStopPlan || 'Use a major fuel stop or transit hub before continuing'}\n`;
      plan += `**Accommodation:** ${isFinalPhaseDay ? `Check into ${accommodationDetails.type} at ${to}` : `Overnight stay at ${accommodationDetails.type} in ${dayArrivalCity}`}\n`;

      const journeyActivities = dayStops.length > 0
        ? dayStops.map((s) => serializeRoadTripAttraction(s, destination))
        : [{
            name: `${phaseName}: Scenic highway transit from ${currentDepartureCity} towards ${dayArrivalCity}`,
            rawName: `Transit from ${currentDepartureCity} to ${dayArrivalCity}`,
            category: 'travel',
            cost: 0,
            timeFit: 1,
            description: `Comfortable driving along the route corridor with planned meal and rest halts.`
          }];

      const dayTimeline = buildTimelineForDayStops({
        stops: dayStops,
        dayPhase: phaseName,
        startCity: currentDepartureCity,
        endCity: dayArrivalCity,
        accommodationType: accommodationDetails?.type,
        isFinalPhaseDay,
        dayStartKm,
        dayEndKm,
        dayIndex: index,
        totalDays: days
      });

      dayPlans.push({
        day: dayNumber,
        date: formatDate(addDays(startDate, dayNumber - 1)),
        phase: phaseName,
        plan,
        weatherPlan: buildDailyWeatherPlan(dayStops[0]?.climateRecommendation),
        activities: journeyActivities,
        timeline: dayTimeline,
        stops: dayStops,
        restaurants: [service.restaurantPlan].filter(Boolean),
        fuelStops: [service.fuelStopPlan].filter(Boolean),
        accommodation: isFinalPhaseDay ? service.accommodationPlan : `Overnight stay in ${dayArrivalCity}`
      });

      // Next day starts from today's arrival city!
      currentDepartureCity = dayArrivalCity;
      dayNumber += 1;
    }
  };

  pushJourneyDays('Onward Journey', onwardRoute, startLocation, destination, phases.onwardDays);

  for (const stayDay of destinationStayPlan) {
    const activityList = stayDay.activities && stayDay.activities.length > 0 ? stayDay.activities : activities.slice(0, 3);
    let plan = `**Destination Stay - Day ${stayDay.dayOffset}**\n\n`;
    plan += `**Location:** ${destination}\n`;
    plan += `**Date:** ${formatDate(addDays(startDate, dayNumber - 1))}\n`;
    plan += `**Focus:** ${stayDay.focus}\n\n`;

    if (stayDay.detailedSchedule) {
      plan += `${stayDay.detailedSchedule}\n\n`;
    } else {
      plan += `**Morning:** Start with a top-rated local breakfast and your highest-priority activity\n`;
      plan += `**Afternoon:** Sightseeing, cultural stops, nature time, or rest based on pace\n`;
      plan += `**Evening:** Local food, markets, viewpoint, or relaxed waterfront/city walk\n`;
    }

    if (stayDay.climateRecommendation) {
      plan += `**Climate Fit:** ${stayDay.climateRecommendation.currentClimate}; ${stayDay.climateRecommendation.weatherForecast}\n`;
      plan += `**Best Activity Today:** ${stayDay.climateRecommendation.bestActivity} during ${stayDay.climateRecommendation.bestTimeToVisit}\n`;
      if (stayDay.climateRecommendation.unsuitableActivities?.length) {
        plan += `**Move/Avoid Today:** ${stayDay.climateRecommendation.unsuitableActivities.join(', ')}\n`;
      }
    }
    plan += `**Meals:** ${stayDay.mealPlan}\n`;
    plan += `**Accommodation:** ${stayDay.accommodationPlan}\n`;

    // Build timeline for destination stay day
    const stayDayTimeline = [];
    stayDayTimeline.push({
      time: '08:00 AM – 09:00 AM',
      place: `Authentic Local Breakfast (${destination})`,
      category: 'meal',
      travelTime: '10 mins',
      visitDuration: '60 mins',
      bestVisitWindow: 'Morning (08:00 AM - 09:30 AM)',
      traffic: 'Local City Traffic',
      cost: '₹140',
      reason: 'Fresh regional breakfast to start the exploration day.'
    });

    activityList.forEach((act, actIdx) => {
      const startH = 9 + actIdx * 3;
      const endH = startH + 2;
      const startStr = `${startH <= 12 ? startH : startH - 12}:30 ${startH < 12 ? 'AM' : 'PM'}`;
      const endStr = `${endH <= 12 ? endH : endH - 12}:30 ${endH < 12 ? 'AM' : 'PM'}`;

      if (actIdx === 1) {
        // Lunch before 2nd activity
        stayDayTimeline.push({
          time: '01:00 PM – 02:15 PM',
          place: `Famous Regional Dining & Rest (${destination})`,
          category: 'meal',
          travelTime: '15 mins',
          visitDuration: '75 mins',
          bestVisitWindow: 'Lunch Window (01:00 PM - 02:30 PM)',
          traffic: 'Moderate Flow',
          cost: '₹280',
          reason: 'Taste iconic local dishes and take midday rest.'
        });
      }

      stayDayTimeline.push({
        time: `${startStr} – ${endStr}`,
        place: act.rawName || act.name,
        category: act.category || 'attraction',
        travelTime: `${act.travelTimeMinutes || 20} mins`,
        visitDuration: `${act.suggestedVisitDuration || '2 hours'}`,
        bestVisitWindow: act.bestTimeToVisit || 'Daylight Hours',
        traffic: 'Normal Flow',
        cost: `₹${act.cost || act.entryFee || 50}`,
        reason: act.reason || act.whyRecommended || `Signature destination experience in ${destination} matching your interests.`
      });
    });

    stayDayTimeline.push({
      time: '07:30 PM – 09:00 PM',
      place: `Evening Street Food & Traditional Dinner (${destination})`,
      category: 'meal',
      travelTime: '15 mins',
      visitDuration: '90 mins',
      bestVisitWindow: 'Evening (07:30 PM - 09:30 PM)',
      traffic: 'Evening City Transit',
      cost: '₹300',
      reason: 'Experience local night market dining and regional food specialties.'
    });

    dayPlans.push({
      day: dayNumber,
      date: formatDate(addDays(startDate, dayNumber - 1)),
      phase: 'Destination Stay',
      plan,
      weatherPlan: buildDailyWeatherPlan(stayDay.climateRecommendation, activityList),
      activities: activityList,
      timeline: stayDayTimeline,
      stops: stayDay.stops || [],
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
  plannerOptions = {},
  preferenceProfile,
  coverageMatrix,
  tripMemory
}) {
  const prefProfile = preferenceProfile || normalizePreferenceProfile({ activities: interests });
  const memory = tripMemory || new TripMemory();
  const matrix = coverageMatrix || new UserPreferenceCoverageMatrix(prefProfile);

  const estimateRoute = await getDirectionsFromGoogleMaps(startLocation, destination, [], transportMode);
  const estimatedDistance = estimateRoute.distance || 350;
  const phases = buildTripPhases(numDays, preferredArrivalDay, estimatedDistance, transportMode, vehicleType, preferredStayDays);
  const weatherPreferences = parseRoadTripPreferences({
    interests,
    companionType,
    numberOfTravelers,
    options: plannerOptions
  });

  // PHASE 1: OUTBOUND JOURNEY
  const onwardRoute = await generateDynamicRouteWithPlaces(
    startLocation,
    destination,
    transportMode,
    phases.onwardDays,
    interests,
    budget,
    companionType,
    numberOfTravelers,
    {
      ...plannerOptions,
      segmentType: 'onward',
      preferenceProfile: prefProfile,
      tripMemory: memory
    }
  );
  onwardRoute.segmentType = 'onward';
  onwardRoute.intermediateStops = (onwardRoute.intermediateStops || []).map(stop => ({
    ...stop,
    phase: 'Onward Journey',
    type: stop.category || (stop.types ? stop.types[0] : 'attraction'),
    googleRating: stop.rating,
    whyRecommended: stop.reason || `Directly along the ${startLocation} to ${destination} corridor.`
  }));
  onwardRoute.intermediateStops = await enrichStopsWithLiveClimate(onwardRoute.intermediateStops, weatherPreferences);
  onwardRoute.routeServices = buildRouteServices('Onward Journey', startLocation, destination, phases.onwardDays, accommodationType, transportMode);

  // Record into trip memory and coverage matrix
  onwardRoute.intermediateStops.forEach(stop => {
    memory.recordVisit(stop, 'outbound');
    matrix.recordPlace(stop, 'Outbound');
  });

  const usedPlaceIds = onwardRoute.intermediateStops.map(stop => stop.placeId).filter(Boolean);
  const usedPlaceNames = onwardRoute.intermediateStops.map(stop => stop.name).filter(Boolean);

  // PHASE 3: RETURN JOURNEY (PLANNED INDEPENDENTLY)
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
      excludePlaceNames: usedPlaceNames,
      missingPreferences: matrix.getMissingPreferences(),
      preferenceProfile: prefProfile,
      tripMemory: memory
    }
  );
  returnRoute.segmentType = 'return';
  returnRoute.intermediateStops = (returnRoute.intermediateStops || []).map(stop => ({
    ...stop,
    phase: 'Return Journey',
    type: stop.category || (stop.types ? stop.types[0] : 'attraction'),
    googleRating: stop.rating,
    whyRecommended: stop.reason || `Selected to complete your round-trip journey without repeating onward stops.`
  }));
  returnRoute.intermediateStops = await enrichStopsWithLiveClimate(returnRoute.intermediateStops, weatherPreferences);
  returnRoute.routeServices = buildRouteServices('Return Journey', destination, startLocation, phases.returnDays, accommodationType, transportMode);

  // Record into trip memory and coverage matrix
  returnRoute.intermediateStops.forEach(stop => {
    memory.recordVisit(stop, 'return');
    matrix.recordPlace(stop, 'Return');
  });

  // Calculate Route Overlap & Alternative Return Routes
  const routeOverlap = calculateRouteOverlap(
    onwardRoute.intermediateStops,
    returnRoute.intermediateStops,
    onwardRoute.totalDistance || estimatedDistance,
    returnRoute.totalDistance || estimatedDistance
  );

  const alternativeReturnRoutes = generateAlternativeReturnRoutes({
    origin: startLocation,
    destination,
    baseDistance: returnRoute.totalDistance || estimatedDistance,
    baseDurationMinutes: 300,
    outboundCorridor: onwardRoute.intermediateStops,
    missingPreferences: matrix.getMissingPreferences(),
    transportMode,
    vehicleMileage: plannerOptions.mileage || plannerOptions.vehicleMileage || 14.5,
    fuelPrice: 101.5,
    numTravelers: numberOfTravelers
  });

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
  const feasibility = buildTripFeasibility({
    phases,
    onwardRoute,
    returnRoute,
    intermediateStops: allStops
  }, numDays, transportMode, vehicleType);

  return {
    phases,
    onwardRoute,
    returnRoute,
    feasibility,
    routeOverlap,
    alternativeReturnRoutes,
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
      startLocation: inputStartLocation,
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
      rentalDetails,
      rentalVehicle,
      rentalBooking,
      maxDetourKm,
      maximumDetour,
      minRating,
      minimumRating,
      maxAttractionsPerDay,
      maximumAttractionsPerDay,
      avoid,
      avoidance,
      preferredPlaceType,
      placeType,
      travelStyle,
      scoreWeights,
      recommendationWeights
    } = data;

    const startLocation = inputStartLocation || data.startLocation || data.start || data.origin || destination;

    // Validate inputs
    if (!budget || !travelDates || !destination) {
      throw new Error('Missing required fields');
    }

    const { startDate, endDate } = parseTravelDateRange(travelDates);
    const numDays = calculateDays(formatDate(startDate), formatDate(endDate));
    const parsedBudget = parseFloat(budget);
    const preferredArrivalDay = getPreferredArrivalDay(data, startDate, numDays);
    const preferredStayDays = parseDestinationStayDays(data);
    const isSelfDriveRental = transport === 'selfDriveRentalCar';
    const effectiveTransportMode = isSelfDriveRental ? 'ownTransport' : (transport || 'bus');
    const effectiveVehicleType = isSelfDriveRental ? 'car' : vehicleType;
    const effectiveFuelType = isSelfDriveRental
      ? String(rentalVehicle?.fuelType || fuelType || 'petrol').toLowerCase()
      : fuelType;
    const effectiveMileage = isSelfDriveRental
      ? (rentalVehicle?.mileage || vehicleMileage || mileage || (effectiveFuelType === 'electric' ? 6 : 16))
      : (mileage || vehicleMileage);
    const plannerOptions = {
      maxDetourKm: maxDetourKm || maximumDetour,
      minRating: minRating || minimumRating,
      maxAttractionsPerDay: maxAttractionsPerDay || maximumAttractionsPerDay,
      avoid: avoid || avoidance,
      preferredPlaceType: preferredPlaceType || placeType,
      travelStyle,
      startDate,
      endDate,
      vehicleType: effectiveVehicleType,
      scoreWeights: scoreWeights || recommendationWeights,
      precomputedRouteDiscovery: data.precomputedRouteDiscovery
    };

    // Initialize trip-wide preference profile, memory, and coverage matrix
    const preferenceProfile = normalizePreferenceProfile(data.preferences || data);
    const tripMemory = new TripMemory();
    const coverageMatrix = new UserPreferenceCoverageMatrix(preferenceProfile);

    // Generate complete round-trip route with onward, destination-stay, and return phases
    const routePlan = await generateRoundTripRoutePlan({
      startLocation: startLocation || destination,
      destination,
      transportMode: effectiveTransportMode,
      numDays,
      interests: activitiesPreference,
      budget: parsedBudget,
      companionType: travelCompanionType,
      numberOfTravelers,
      preferredArrivalDay,
      preferredStayDays,
      accommodationType: accommodation || 'budgetHotel',
      vehicleType: effectiveVehicleType,
      plannerOptions,
      preferenceProfile,
      coverageMatrix,
      tripMemory
    });

    // 1. Calculate Real Transport Costs (Fuel / EV Charging + Tolls / Public Transit)
    let transportCostDetails;
    let transportCost = 0;

    if ((transportType === 'own' && effectiveVehicleType) || isSelfDriveRental) {
      transportCostDetails = calculateOwnVehicleCost(
        effectiveVehicleType,
        effectiveFuelType || 'petrol',
        effectiveMileage,
        routePlan.totalDistance,
        numberOfTravelers,
        startLocation || destination,
        destination,
        data.vehicleModel || null
      );
      if (isSelfDriveRental && rentalVehicle) {
        const rentalCost = Number(rentalVehicle.estimatedTotalCost || rentalVehicle.pricePerDay || 0);
        transportCostDetails = {
          ...transportCostDetails,
          mode: 'Self-Drive Rental Car',
          rentalCost,
          selectedVehicle: rentalVehicle,
          rentalBooking: rentalBooking || {},
          totalCost: transportCostDetails.totalCost + rentalCost
        };
      }
      transportCost = transportCostDetails.totalCost;
    } else {
      transportCostDetails = calculatePublicTransportCost(
        effectiveTransportMode || 'bus',
        routePlan.totalDistance,
        numberOfTravelers,
        startLocation,
        destination,
        data.travelClass
      );
      transportCost = transportCostDetails.totalCost;
    }

    // 2. Real Destination Local Transportation (Water ferries, Shikara boats, Jeeps, Autos where own car is impractical)
    const localTransitDetails = getLocalTransportationDetails(destination, numberOfTravelers, transportType);
    const localTransportCost = localTransitDetails.estimatedDailyCostPerPerson * numDays * numberOfTravelers;

    // 3. Real Market Accommodation Cost (Room requirement based on traveler count)
    const accommodationDetails = getAccommodationRecommendations(
      accommodation || 'budgetHotel',
      numDays,
      numberOfTravelers,
      destination,
      startDate
    );

    // 4. Real Destination-Specific Food Cost (Local dishes, meal prices)
    const budgetCategory = data.travelStyle === 'budget' ? 'budget' : (data.travelStyle === 'luxury' || data.travelStyle === 'premium') ? 'premium' : 'standard';
    const foodDetails = calculateFoodCost(numberOfTravelers, numDays, budgetCategory, destination);

    // 5. Real Attraction Entry Tickets & Activity Fees
    const { activities: recommendedActivities } = getRecommendedActivities(
      activitiesPreference || 'cultural,nature,adventure',
      6,
      numDays
    );

    // Evaluate ticket costs across all scheduled corridor stops and planned activities
    const allStopsForTicketing = [...(routePlan.intermediateStops || []), ...recommendedActivities];
    const activityPricing = calculateActivityCosts(allStopsForTicketing, numberOfTravelers);
    const activitiesTotalCost = activityPricing.totalCost;

    // 6. Complete Realistic Grand Total (Sum of actual calculated costs, NOT percentage distributions)
    const estimatedCosts = {
      mainTransport: transportCost,
      fuelCost: transportCostDetails.fuelCost || transportCostDetails.chargingCost || 0,
      tollCost: transportCostDetails.tollCost || 0,
      localTransport: localTransportCost,
      accommodation: accommodationDetails.totalCost,
      food: foodDetails.totalCost,
      activities: activitiesTotalCost,
      miscellaneous: 0,
      total: Math.round((
        transportCost +
        localTransportCost +
        accommodationDetails.totalCost +
        foodDetails.totalCost +
        activitiesTotalCost
      ) * 100) / 100
    };

    // 7. Check User Budget as a Constraint (NOT artificially reduced)
    const isOverBudget = estimatedCosts.total > parsedBudget;
    const budgetGap = Math.round(estimatedCosts.total - parsedBudget);
    const isSignificantlyOver = estimatedCosts.total > parsedBudget * 1.25;
    const isBudgetInsufficientForBase = transportCost > parsedBudget;

    let budgetMessage = '';
    if (isBudgetInsufficientForBase) {
      budgetMessage = `Your budget (₹${parsedBudget.toLocaleString('en-IN')}) is insufficient even to cover the mandatory road trip fuel and toll expenses (₹${transportCost.toLocaleString('en-IN')}). The minimum realistic trip cost is ₹${estimatedCosts.total.toLocaleString('en-IN')}.`;
    } else if (isSignificantlyOver) {
      budgetMessage = `Your estimated realistic trip cost is ₹${estimatedCosts.total.toLocaleString('en-IN')}, exceeding your budget by ₹${budgetGap.toLocaleString('en-IN')}. Top drivers: ${transportCost > accommodationDetails.totalCost ? `Travel Fuel & Tolls (₹${transportCost.toLocaleString('en-IN')})` : `Accommodation (₹${accommodationDetails.totalCost.toLocaleString('en-IN')})`}. See our calculated Budget Option below.`;
    } else if (isOverBudget) {
      budgetMessage = `Trip cost is slightly above budget by ₹${budgetGap.toLocaleString('en-IN')}. Switching to hostel dorms or reducing paid activities can bridge this gap comfortably.`;
    } else {
      budgetMessage = `Trip cost is well within your budget! You have ₹${(parsedBudget - estimatedCosts.total).toLocaleString('en-IN')} remaining buffer.`;
    }

    // 8. Generate 3 Realistic Trip Options (Budget, Standard, Premium) calculated from actual itemized rates
    const realTripTiers = generateRealWorldTripTiers({
      destination,
      numDays,
      numTravelers: numberOfTravelers,
      transportCostDetails,
      totalDistance: routePlan.totalDistance,
      scheduledPlaces: routePlan.intermediateStops,
      startDate
    });

    const alternatives = realTripTiers;

    const destinationStayPlan = await buildDestinationStayPlan(
      destination,
      routePlan.phases.destinationStayDays,
      recommendedActivities,
      accommodationDetails,
      parseRoadTripPreferences({
        interests: activitiesPreference,
        companionType: travelCompanionType,
        numberOfTravelers,
        options: plannerOptions
      }),
      {
        startLocation: startLocation || destination,
        dailyStartTime: data.dailyStartTime || '08:00',
        dailyEndTime: data.dailyEndTime || '21:00',
        transportMode: effectiveTransportMode || 'car'
      }
    );

    // Record destination activities into trip memory and coverage matrix
    recommendedActivities.forEach(act => {
      tripMemory.recordVisit(act, 'destination');
      coverageMatrix.recordPlace(act, 'Destination Exploration');
    });

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

    const climateAwarePlaces = routePlan.intermediateStops.map(stop => ({
      name: stop.name,
      matchScore: stop.matchScore || stop.climateRecommendation?.matchScore || 0,
      seasonClimateSuitabilityScore: stop.seasonClimateSuitabilityScore || stop.climateRecommendation?.seasonClimateSuitabilityScore || 0,
      season: stop.climateRecommendation?.season,
      currentClimate: stop.currentClimate || stop.climateRecommendation?.currentClimate,
      temperatureRange: stop.climateRecommendation?.temperatureRange,
      weatherCondition: stop.climateRecommendation?.weatherCondition,
      weatherForecast: stop.climateRecommendation?.weatherForecast,
      bestActivity: stop.climateRecommendation?.bestActivity,
      suitableActivities: stop.climateRecommendation?.suitableActivities,
      unsuitableActivities: stop.climateRecommendation?.unsuitableActivities,
      rescheduleAdvice: stop.climateRecommendation?.rescheduleAdvice,
      bestTimeToVisit: stop.climateRecommendation?.bestTimeToVisit,
      recommendedStayDuration: stop.climateRecommendation?.recommendedStayDuration,
      campingSuitability: stop.climateRecommendation?.campingSuitability,
      weatherRiskLevel: stop.weatherRiskLevel || stop.climateRecommendation?.weatherRiskLevel,
      dataSource: stop.climateRecommendation?.climateDataSource,
      whyRecommended: stop.reason,
      scoreBreakdown: stop.climateRecommendation?.scoreBreakdown
    }));
    const highRiskClimatePlaces = climateAwarePlaces.filter(place => place.weatherRiskLevel === 'High');
    const climateWarnings = highRiskClimatePlaces.map(place =>
      `${place.name} has high weather risk for your travel window. Prefer indoor alternatives or reschedule this stop.`
    );
    const feasibilityWarnings = routePlan.feasibility?.isFeasible
      ? []
      : [
        `This route is too rushed for ${numDays} days. A comfortable plan needs about ${routePlan.feasibility?.minimumComfortableDays || numDays + 1} days, or fewer stops.`
      ];

    const rentalWarnings = isSelfDriveRental
      ? [
        `Rental pickup is planned for ${rentalDetails?.pickupDate || formatDate(startDate)} ${rentalDetails?.pickupTime || '10:00'}. Schedule earlier stops only if another transport is available.`,
        `Rental return is due by ${rentalDetails?.returnDate || formatDate(endDate)} ${rentalDetails?.returnTime || '18:00'}. The return journey must leave enough buffer for drop-off.`
      ]
      : [];

    // 6. SINGLE AUTHORITATIVE COST CALCULATION PIPELINE (Sections 2, 3, 13, 14, 15, 32, 34)
    const authoritativeCostSummary = calculateTripCost({
      startLocation: startLocation || destination,
      destination,
      numDays,
      numberOfTravelers,
      budget: parsedBudget,
      transport: effectiveTransportMode,
      transportMode: effectiveTransportMode,
      vehicleType: effectiveVehicleType,
      vehicleModel: data.vehicleModel,
      fuelType: effectiveFuelType,
      mileage: effectiveMileage,
      accommodation,
      travelStyle,
      foodPreference: preferenceProfile.foodPreference,
      routePlan,
      scheduledStops: routePlan.intermediateStops || [],
      recommendedActivities,
      startDate
    });

    // Attach authoritative day-by-day cost object to each day plan (Section 12)
    dayPlans.forEach(dp => {
      const matchingDayCost = authoritativeCostSummary.dayWise.find(dw => dw.day === dp.day);
      if (matchingDayCost) {
        dp.cost = matchingDayCost;
      }
    });

    // Run 24-point comprehensive validation checklist
    const validationCheck = runFinalValidationChecklist({
      itinerary: { dayPlans, intermediateStops: routePlan.intermediateStops },
      tripMemory,
      coverageMatrix,
      budget: parsedBudget,
      estimatedCosts: authoritativeCostSummary,
      numDays
    });

    // Generate money-saving tips
    const tips = generateMoneyTips(destination, numDays, effectiveTransportMode, accommodation);

    // Final itinerary object with structured output
    const itinerary = {
      success: true,

      // 🚀 Section 50: Advanced AI Travel Planner Engine Outputs
      tripSummary: {
        origin: startLocation || destination,
        destination,
        dates: `${formatDate(startDate)} to ${formatDate(endDate)}`,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        travelers: numberOfTravelers,
        travelMode: isSelfDriveRental ? 'Self-Drive Rental Car' : (effectiveTransportMode || 'bus'),
        vehicle: effectiveVehicleType ? `${effectiveVehicleType} (${effectiveFuelType || 'petrol'})` : 'Public Transport',
        vehicleModel: data.vehicleModel || null,
        budget: parsedBudget,
        tripDuration: `${numDays} Days`,
        travelStyle: travelStyle || 'Standard'
      },

      routeSummary: {
        outboundDistance: `${routePlan.onwardRoute.totalDistance || Math.round(routePlan.totalDistance / 2)} km`,
        outboundTravelTime: routePlan.onwardRoute.totalDuration || '4-5 hours',
        destinationTravel: `${routePlan.phases.destinationStayDays * 35} km local exploration`,
        returnDistance: `${routePlan.returnRoute.totalDistance || Math.round(routePlan.totalDistance / 2)} km`,
        returnTravelTime: routePlan.returnRoute.totalDuration || '4-5 hours',
        totalDistance: `${routePlan.totalDistance} km`,
        totalDrivingTime: routePlan.totalDuration,
        drivingPace: data.travelPace || 'Balanced'
      },

      dayByDayItinerary: dayPlans,

      // Authoritative, single source of truth cost breakdown (Section 15, 32)
      costSummary: authoritativeCostSummary,

      estimatedCosts: {
        mainTransport: authoritativeCostSummary.fuel + authoritativeCostSummary.tolls,
        fuelCost: authoritativeCostSummary.fuel,
        tollCost: authoritativeCostSummary.tolls,
        localTransport: authoritativeCostSummary.localTransport,
        accommodation: authoritativeCostSummary.accommodation,
        food: authoritativeCostSummary.food,
        activities: authoritativeCostSummary.activities + authoritativeCostSummary.entryFees,
        miscellaneous: authoritativeCostSummary.parking + authoritativeCostSummary.other,
        total: authoritativeCostSummary.totalTripCost
      },

      costBreakdown: {
        totalDistanceKm: routePlan.totalDistance,
        transport: {
          mode: effectiveTransportMode,
          fuelCost: authoritativeCostSummary.fuel,
          tollCost: authoritativeCostSummary.tolls,
          totalCost: authoritativeCostSummary.fuel + authoritativeCostSummary.tolls
        },
        localTransport: {
          cost: authoritativeCostSummary.localTransport
        },
        accommodation: {
          type: accommodation,
          totalCost: authoritativeCostSummary.accommodation
        },
        food: {
          totalCost: authoritativeCostSummary.food
        },
        activities: {
          totalCost: authoritativeCostSummary.activities + authoritativeCostSummary.entryFees
        },
        total: authoritativeCostSummary.totalTripCost
      },

      preferenceCoverage: {
        matrix: coverageMatrix.getMatrix(),
        summaryStats: coverageMatrix.getSummaryStats(),
        missingPreferences: coverageMatrix.getMissingPreferences(),
        explanations: coverageMatrix.getCoverageExplanations()
      },

      routeDiversity: {
        outboundRoute: `${startLocation || destination} → ${destination} (${routePlan.onwardRoute.totalDistance || 0} km)`,
        destinationRoute: `${destination} local exploration (${routePlan.phases.destinationStayDays} days)`,
        returnRoute: `${destination} → ${startLocation || destination} (${routePlan.returnRoute.totalDistance || 0} km)`,
        routeOverlap: routePlan.routeOverlap,
        newReturnExperiences: (routePlan.returnRoute.intermediateStops || []).map(s => s.name),
        alternativeReturnRoutes: routePlan.alternativeReturnRoutes
      },

      validation: validationCheck,

      map: {
        origin: startLocation || destination,
        destination,
        outboundPOIs: (routePlan.onwardRoute.intermediateStops || []).map(s => ({
          name: s.name,
          category: s.category || 'attraction',
          location: s.location,
          phase: 'Outbound',
          detourDistance: s.detourDistance || 0
        })),
        destinationPOIs: recommendedActivities.map(a => ({
          name: a.name,
          category: a.category || 'attraction',
          location: a.location,
          phase: 'Destination Exploration'
        })),
        returnPOIs: (routePlan.returnRoute.intermediateStops || []).map(s => ({
          name: s.name,
          category: s.category || 'attraction',
          location: s.location,
          phase: 'Return',
          detourDistance: s.detourDistance || 0
        })),
        routePolylines: {
          onward: routePlan.onwardRoute.mapPolyline || null,
          return: routePlan.returnRoute.mapPolyline || null
        },
        markers: [
          { type: 'origin', name: startLocation || destination, phase: 'Origin' },
          { type: 'destination', name: destination, phase: 'Destination' },
          ...(routePlan.onwardRoute.intermediateStops || []).map(s => ({ type: 'outbound_poi', name: s.name, location: s.location, category: s.category })),
          ...recommendedActivities.map(a => ({ type: 'destination_poi', name: a.name, location: a.location, category: a.category })),
          ...(routePlan.returnRoute.intermediateStops || []).map(s => ({ type: 'return_poi', name: s.name, location: s.location, category: s.category })),
          ...(routePlan.onwardRoute.routeServices || []).flatMap(s => [
            s.fuelStopPlan?.location ? { type: 'fuel', name: s.fuelStopPlan.name, location: s.fuelStopPlan.location } : null,
            s.restaurantPlan?.location ? { type: 'restaurant', name: s.restaurantPlan.name, location: s.restaurantPlan.location } : null
          ]).filter(Boolean)
        ]
      },

      // 📌 Trip Overview (Legacy Compatibility)
      tripOverview: {
        startLocation: routePlan.primaryRoute.from,
        destination: routePlan.primaryRoute.to,
        totalDistance: routePlan.totalDistance,
        travelTime: routePlan.primaryRoute.estimatedDuration,
        numDays: numDays,
        numTravelers: numberOfTravelers,
        arrivalDay: routePlan.phases.arrivalDay,
        arrivalDate: formatDate(addDays(startDate, routePlan.phases.arrivalDay - 1)),
        feasibilityStatus: routePlan.feasibility?.status
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
        arrivalDate: formatDate(addDays(startDate, routePlan.phases.arrivalDay - 1)),
        preferredPlaceType: preferredPlaceType || placeType || '',
        travelStyle: travelStyle || ''
      },

      details: {
        startLocation: startLocation || destination,
        preferredActivities: activitiesPreference || '',
        preferredPlaceType: preferredPlaceType || placeType || '',
        travelStyle: travelStyle || '',
        accommodationType: accommodation || 'hostel',
        transportMode: isSelfDriveRental ? 'Self-Drive Rental Car' : effectiveTransportMode || 'bus',
        rentalPickupDateTime: rentalDetails ? `${rentalDetails.pickupDate} ${rentalDetails.pickupTime}` : undefined,
        rentalReturnDateTime: rentalDetails ? `${rentalDetails.returnDate} ${rentalDetails.returnTime}` : undefined
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
        },
        feasibility: routePlan.feasibility
      },

      route: {
        primaryRoute: routePlan.primaryRoute,
        intermediateStops: routePlan.intermediateStops,
        routeSegments: routePlan.routeSegments,
        mapPolyline: routePlan.mapPolyline,
        recommendedStops: routePlan.recommendedStops,
        extraDistance: routePlan.extraDistance,
        extraTime: routePlan.extraTime,
        feasibility: routePlan.feasibility
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
        matchScore: stop.matchScore || stop.climateRecommendation?.matchScore,
        seasonClimateSuitabilityScore: stop.seasonClimateSuitabilityScore || stop.climateRecommendation?.seasonClimateSuitabilityScore,
        season: stop.climateRecommendation?.season,
        currentClimate: stop.currentClimate || stop.climateRecommendation?.currentClimate,
        temperatureRange: stop.climateRecommendation?.temperatureRange,
        weatherCondition: stop.climateRecommendation?.weatherCondition,
        weatherForecast: stop.climateRecommendation?.weatherForecast,
        bestActivity: stop.climateRecommendation?.bestActivity,
        suitableActivities: stop.climateRecommendation?.suitableActivities,
        unsuitableActivities: stop.climateRecommendation?.unsuitableActivities,
        rescheduleAdvice: stop.climateRecommendation?.rescheduleAdvice,
        recommendedStayDuration: stop.climateRecommendation?.recommendedStayDuration,
        campingSuitability: stop.climateRecommendation?.campingSuitability,
        weatherRiskLevel: stop.weatherRiskLevel || stop.climateRecommendation?.weatherRiskLevel,
        climateRecommendation: stop.climateRecommendation,
        location: stop.location
      })),

      climateIntelligence: {
        enabled: true,
        dataSources: [...new Set(climateAwarePlaces.map(place => place.dataSource).filter(Boolean))],
        travelSeason: getIndianSeason(startDate),
        scoringModel: 'selected activity preference 30%, seasonal suitability 20%, actual weather compatibility 15%, forecast suitability 10%, ratings 10%, distance 10%, activity availability 5%',
        recommendedPlaces: climateAwarePlaces,
        replanning: {
          supported: true,
          triggerConditions: [
            'High weather risk',
            'Heavy rainfall probability',
            'Strong winds',
            'Low activity availability',
            'Extreme temperature mismatch'
          ],
          action: 'Recalculate scores, move outdoor activities to safer times, and suggest nearby alternatives.'
        }
      },
      warnings: [...feasibilityWarnings, ...climateWarnings, ...rentalWarnings],

      // 📅 Day-wise Itinerary
      dayWiseItinerary: dayPlans,
      dayPlans,

      // 💵 Budget Breakdown (Unified with Authoritative Cost Engine)
      budgetBreakdown: {
        fuel: authoritativeCostSummary.fuel,
        tolls: authoritativeCostSummary.tolls,
        localTransport: authoritativeCostSummary.localTransport,
        accommodation: authoritativeCostSummary.accommodation,
        food: authoritativeCostSummary.food,
        entryFees: authoritativeCostSummary.entryFees,
        activities: authoritativeCostSummary.activities,
        parking: authoritativeCostSummary.parking,
        other: authoritativeCostSummary.other,
        totalEstimatedCost: authoritativeCostSummary.totalTripCost,
        originalBudget: parsedBudget,
        remainingBudget: authoritativeCostSummary.remainingBudget,
        costPerPerson: authoritativeCostSummary.costPerPerson,
        budgetStatus: authoritativeCostSummary.budgetStatus
      },

      estimatedCosts: {
        mainTransport: authoritativeCostSummary.fuel + authoritativeCostSummary.tolls,
        fuelCost: authoritativeCostSummary.fuel,
        tollCost: authoritativeCostSummary.tolls,
        localTransport: authoritativeCostSummary.localTransport,
        accommodation: authoritativeCostSummary.accommodation,
        food: authoritativeCostSummary.food,
        activities: authoritativeCostSummary.activities + authoritativeCostSummary.entryFees,
        entryFees: authoritativeCostSummary.entryFees,
        parking: authoritativeCostSummary.parking,
        other: authoritativeCostSummary.other,
        total: authoritativeCostSummary.totalTripCost
      },
      transportation: {
        mode: isSelfDriveRental ? 'Self-Drive Rental Car' : effectiveTransportMode || 'bus',
        vehicleType: effectiveVehicleType,
        vehicleModel: data.vehicleModel || null,
        distance: routePlan.totalDistance,
        fuelCost: authoritativeCostSummary.fuel,
        tollCost: authoritativeCostSummary.tolls,
        isEV: transportCostDetails.isEV || false,
        evPlan: transportCostDetails.evPlan || null,
        transitDetails: transportCostDetails.transitRoutes ? {
          primaryRoute: transportCostDetails.primaryRoute,
          transitRoutes: transportCostDetails.transitRoutes,
          faresByClass: transportCostDetails.faresByClass,
          feedId: transportCostDetails.feedId,
          feedProvider: transportCostDetails.feedProvider,
          source: transportCostDetails.source,
          mobilityDatabaseVerified: true
        } : null,
        rentalVehicle: rentalVehicle || null,
        rentalBooking: rentalBooking || null,
        rentalDetails: rentalDetails || null,
        pickupConstraints: isSelfDriveRental ? {
          pickupDateTime: rentalDetails ? `${rentalDetails.pickupDate} ${rentalDetails.pickupTime}` : null,
          returnDateTime: rentalDetails ? `${rentalDetails.returnDate} ${rentalDetails.returnTime}` : null,
          parkingRequired: true,
          roadTravelOptimized: true,
          chargingStopsRequired: effectiveFuelType === 'electric',
          fuelStopsRequired: effectiveFuelType !== 'electric'
        } : null
      },
      mobilityTransit: (effectiveTransportMode === 'train' || effectiveTransportMode === 'bus') ? {
        mode: effectiveTransportMode,
        corridor: `${startLocation} → ${destination}`,
        primaryRoute: transportCostDetails.primaryRoute,
        routes: transportCostDetails.transitRoutes,
        faresByClass: transportCostDetails.faresByClass,
        feedId: transportCostDetails.feedId,
        feedProvider: transportCostDetails.feedProvider,
        source: transportCostDetails.source,
        mobilityDatabaseVerified: true
      } : null,
      rentalVehicle: rentalVehicle || null,
      rentalBooking: rentalBooking || null,

      // 📊 Transparent Real-World Cost Breakdown (Authoritative Object, Section 15, 32)
      costBreakdown: {
        totalDistanceKm: routePlan.totalDistance,
        fuel: authoritativeCostSummary.fuel,
        tolls: authoritativeCostSummary.tolls,
        localTransport: authoritativeCostSummary.localTransport,
        accommodation: authoritativeCostSummary.accommodation,
        food: authoritativeCostSummary.food,
        entryFees: authoritativeCostSummary.entryFees,
        activities: authoritativeCostSummary.activities,
        parking: authoritativeCostSummary.parking,
        other: authoritativeCostSummary.other,
        outboundTotal: authoritativeCostSummary.outboundTotal,
        destinationTotal: authoritativeCostSummary.destinationTotal,
        returnTotal: authoritativeCostSummary.returnTotal,
        totalTripCost: authoritativeCostSummary.totalTripCost,
        total: authoritativeCostSummary.totalTripCost,
        travelerCount: authoritativeCostSummary.travelerCount,
        costPerPerson: authoritativeCostSummary.costPerPerson,
        budget: authoritativeCostSummary.budget,
        remainingBudget: authoritativeCostSummary.remainingBudget,
        budgetStatus: authoritativeCostSummary.budgetStatus,
        statusBreakdown: authoritativeCostSummary.statusBreakdown,
        unavailableCategories: authoritativeCostSummary.unavailableCategories,
        estimatedRange: authoritativeCostSummary.estimatedRange,
        lineItemSummary: {
          totalDistance: `${routePlan.totalDistance} km`,
          fuelCost: authoritativeCostSummary.fuel,
          tollCost: authoritativeCostSummary.tolls,
          localTransportation: authoritativeCostSummary.localTransport,
          accommodation: authoritativeCostSummary.accommodation,
          food: authoritativeCostSummary.food,
          entryFees: authoritativeCostSummary.entryFees,
          activities: authoritativeCostSummary.activities,
          parkingAndOther: authoritativeCostSummary.parking + authoritativeCostSummary.other,
          estimatedTotalTripCost: authoritativeCostSummary.totalTripCost,
          costPerPerson: authoritativeCostSummary.costPerPerson,
          remainingBudget: authoritativeCostSummary.remainingBudget,
          withinBudget: authoritativeCostSummary.isWithinBudget
        },
        dataSources: (authoritativeCostSummary.sources || []).map(s => `${s.category.toUpperCase()}: ${s.source} (${s.status})`),
        items: authoritativeCostSummary.items,
        dayWise: authoritativeCostSummary.dayWise,
        validation: authoritativeCostSummary.validation,
        debug: authoritativeCostSummary.debug
      },

      // ⚠ Budget Suggestions & 3 Real-World Calculated Tiers
      budgetSuggestions: {
        status: isOverBudget ? 'OVER_BUDGET' : 'WITHIN_BUDGET',
        message: budgetMessage,
        alternatives: realTripTiers,
        adjustments: isOverBudget ? generateBudgetAdjustmentOptions(parsedBudget, estimatedCosts, routePlan, numDays) : []
      },

      // Additional metadata
      metadata: {
        routeSource: routePlan.routeSource,
        apiUsed: hasGoogleMapsAPI() ? 'Google Maps APIs' : 'Local Database',
        generatedAt: new Date().toISOString(),
        pricingEngine: 'Real-World Dynamic Travel Cost Engine 2026'
      },

      moneyTips: tips,
      accommodationSuggestions: accommodationDetails.suggestions,
      foodRecommendations: foodDetails.famousDishes?.map(d => `${d.name} (${d.priceRange})`) || []
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

module.exports = {
  generateItinerary,
  generateRecommendations,
  calculateTripCost,
  calculatePoiCostImpact,
  calculateAlternativeRouteCost,
  buildTripPhases,
  buildTimelineForDayStops
};
