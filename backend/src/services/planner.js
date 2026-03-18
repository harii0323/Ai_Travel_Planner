// AI Travel Planner Service - Comprehensive Route Planning with Cost Estimation

// Database of budget-friendly accommodations by destination type
const accommodationDb = {
  hostel: { avgPrice: 300, maxPrice: 600, description: 'Youth hostels with shared or private rooms' },
  budgetHotel: { avgPrice: 500, maxPrice: 1000, description: 'Budget hotels with basic amenities' },
  homestay: { avgPrice: 600, maxPrice: 1500, description: 'Local homestays for cultural experience' },
  airbnb: { avgPrice: 800, maxPrice: 2000, description: 'Budget Airbnb listings' },
  guesthouse: { avgPrice: 2500, maxPrice: 4500, description: 'Local guest houses' }
};

// Activity database with costs and categories
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

// Transportation costs (estimated per trip)
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

// Daily meal costs per person
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

// Toll charges database (simplified)
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

// Generate route with intermediate stops
function generateRouteWithStops(startLocation, destination, transportMode, numDays) {
  const routeKey = `${startLocation}-${destination}`;
  const reverseRouteKey = `${destination}-${startLocation}`;

  // Try to find route in database
  let routeData = routeDatabase[routeKey] || routeDatabase[reverseRouteKey];

  if (!routeData) {
    // Generate basic route if not in database
    routeData = {
      distance: Math.floor(Math.random() * 1000) + 500, // Random distance 500-1500 km
      duration: '12-24 hours',
      intermediateStops: []
    };
  }

  // Select appropriate stops based on available time
  const maxStops = Math.min(3, Math.floor(numDays / 2)); // Max 3 stops, spread across days
  const selectedStops = routeData.intermediateStops
    .sort((a, b) => b.rating - a.rating) // Sort by rating
    .slice(0, maxStops);

  return {
    primaryRoute: {
      from: startLocation,
      to: destination,
      distance: routeData.distance,
      estimatedDuration: routeData.duration,
      transportMode: transportMode
    },
    intermediateStops: selectedStops,
    totalDistance: routeData.distance + selectedStops.reduce((sum, stop) => sum + (stop.distance || 50), 0)
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
function generateItinerary(data) {
  try {
    const {
      budget,
      travelDates,
      startLocation,
      destination,
      activities: activitiesPreference,
      accommodation,
      transport,
      travelCompanionType,
      numberOfTravelers = 1,
      vehicleType,
      fuelType,
      vehicleMileage
    } = data;

    // Parse inputs
    const parsedBudget = parseFloat(budget) || 0;
    const numTravelers = parseInt(numberOfTravelers) || 1;
    const numDays = calculateDays(travelDates.split(' to ')[0], travelDates.split(' to ')[1] || travelDates);

    // Generate route with intermediate stops
    const routePlan = generateRouteWithStops(startLocation, destination, transport, numDays);

    // Calculate transportation costs
    let transportDetails;
    if (transport === 'ownTransport') {
      transportDetails = calculateOwnVehicleCost(
        vehicleType,
        fuelType,
        parseFloat(vehicleMileage),
        routePlan.totalDistance,
        numTravelers
      );
    } else {
      transportDetails = calculatePublicTransportCost(transport, routePlan.primaryRoute.distance, numTravelers);
    }

    // Calculate food costs
    const foodDetails = calculateFoodCost(numTravelers, numDays);

    // Calculate accommodation costs
    const accommodationDetails = calculateAccommodationCost(destination, accommodation, numDays, numTravelers);

    // Get recommended activities
    const { activities: recommendedActivities } = getRecommendedActivities(activitiesPreference, parsedBudget * 0.1, numDays);

    // Calculate activity costs
    const activityDetails = calculateActivityCosts(recommendedActivities, numTravelers);

    // Calculate total estimated costs
    const estimatedCosts = {
      transport: transportDetails.totalCost,
      food: foodDetails.totalCost,
      accommodation: accommodationDetails.totalCost,
      activities: activityDetails.totalCost,
      miscellaneous: Math.round(parsedBudget * 0.05 * 100) / 100, // 5% for miscellaneous
      total: 0
    };

    estimatedCosts.total = Math.round((
      estimatedCosts.transport +
      estimatedCosts.food +
      estimatedCosts.accommodation +
      estimatedCosts.activities +
      estimatedCosts.miscellaneous
    ) * 100) / 100;

    // Check if over budget
    const isOverBudget = parsedBudget > 0 && estimatedCosts.total > parsedBudget;

    // Generate day-wise itinerary with stops
    const dayPlans = generateDayWiseItineraryWithStops(numDays, routePlan, recommendedActivities, accommodationDetails);

    // Generate money-saving tips
    const tips = generateMoneyTips(destination, numDays, transport, accommodation);

    // Final itinerary object
    const itinerary = {
      success: true,
      summary: {
        startLocation,
        destination,
        totalDays: numDays,
        totalDistance: routePlan.totalDistance,
        originalBudget: parsedBudget,
        estimatedCost: estimatedCosts.total,
        withinBudget: !isOverBudget,
        budgetStatus: isOverBudget ? 'OVER_BUDGET' : 'WITHIN_BUDGET',
        numTravelers: numTravelers,
        travelCompanionType: travelCompanionType || 'solo'
      },
      route: routePlan,
      transportation: transportDetails,
      estimatedCosts,
      costBreakdown: {
        transport: transportDetails,
        food: foodDetails,
        accommodation: accommodationDetails,
        activities: activityDetails,
        miscellaneous: {
          amount: estimatedCosts.miscellaneous,
          description: 'Emergency funds, local transport, tips, and miscellaneous expenses'
        }
      },
      dayPlans,
      moneyTips: tips,
      warnings: isOverBudget ? [
        `Your estimated cost (₹${estimatedCosts.total}) exceeds your budget (₹${parsedBudget}).`,
        'Consider the alternative options or adjust your preferences.',
        'You can reduce trip duration, choose cheaper accommodation, or skip some activities.'
      ] : []
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
function getAccommodationRecommendations(type, numDays, budget) {
  const accommodation = accommodationDb[type] || accommodationDb.hostel;
  const costPerNight = Math.min(accommodation.avgPrice, budget / numDays);
  const totalAccommodationCost = costPerNight * numDays;

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

// Calculate estimated daily food costs
function estimateFoodCosts(numDays, budget) {
  const dailyFoodBudget = Math.round(budget / numDays);
  const meals = {
    breakfast: 80,
    lunch: 150,
    dinner: 200
  };

  return {
    breakfast: meals.breakfast,
    lunch: dailyFoodBudget <= 10 ? meals.lunch : meals.lunch + 2,
    dinner: dailyFoodBudget <= 10 ? meals.dinner : meals.dinner + 2,
    dailyTotal: Math.round((meals.breakfast + meals.lunch + meals.dinner) * 100) / 100,
    tripTotal: Math.round((meals.breakfast + meals.lunch + meals.dinner) * numDays * 100) / 100,
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
      transport
    } = data;

    // Validate inputs
    if (!budget || !travelDates || !destination) {
      throw new Error('Missing required fields');
    }

    const numDays = calculateDays(travelDates.split(' to ')[0], travelDates.split(' to ')[1] || travelDates);
    const parsedBudget = parseFloat(budget);

    // Allocate budget
    const budgetAllocation = allocateBudget(parsedBudget, numDays);

    // Estimate transport cost (estimate from sample distances)
    const estimatedTransportCost = estimateTransportCost(transport || 'bus', 500);

    // Get accommodation recommendations
    const accommodationDetails = getAccommodationRecommendations(
      accommodation || 'hostel',
      numDays,
      budgetAllocation.accommodation
    );

    // Get food costs
    const foodDetails = estimateFoodCosts(numDays, budgetAllocation.food);

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
      mainTransport: estimatedTransportCost,
      accommodation: accommodationDetails.totalCost,
      food: foodDetails.tripTotal,
      activities: activitiesTotalCost,
      miscellaneous: budgetAllocation.miscellaneous,
      total: Math.round((
        estimatedTransportCost +
        accommodationDetails.totalCost +
        foodDetails.tripTotal +
        activitiesTotalCost +
        budgetAllocation.miscellaneous
      ) * 100) / 100
    };

    // Check if over budget and generate alternatives
    const isOverBudget = estimatedCosts.total > parsedBudget;
    const alternatives = isOverBudget ?
      generateAlternativePlan(parsedBudget, estimatedCosts.total, data, numDays) : [];

    // Generate day-wise itinerary
    const dayPlans = generateDayWiseItinerary(numDays, destination, recommendedActivities, accommodationDetails);

    // Generate money-saving tips
    const tips = generateMoneyTips(destination, numDays, transport, accommodation);

    // Final itinerary object
    const itinerary = {
      success: true,
      summary: {
        destination,
        startDate: travelDates.split(' to ')[0],
        endDate: travelDates.split(' to ')[1] || travelDates,
        totalDays: numDays,
        totalCost: estimatedCosts.total,
        originalBudget: parsedBudget,
        withinBudget: !isOverBudget,
        budgetStatus: isOverBudget ? 'OVER_BUDGET' : 'WITHIN_BUDGET'
      },
      details: {
        startLocation,
        destination,
        preferredActivities: activitiesPreference,
        accommodationType: accommodation,
        transportMode: transport
      },
      estimatedCosts,
      costBreakdown: {
        accommodation: {
          type: accommodationDetails.type,
          perNight: accommodationDetails.costPerNight,
          nights: numDays,
          total: accommodationDetails.totalCost
        },
        food: {
          breakfast: foodDetails.breakfast,
          lunch: foodDetails.lunch,
          dinner: foodDetails.dinner,
          dailyTotal: foodDetails.dailyTotal,
          tripTotal: foodDetails.tripTotal
        },
        activities: recommendedActivities.slice(0, 5),
        transport: {
          mode: transport || 'bus',
          estimatedCost: estimatedTransportCost,
          studentDiscount: 'Applied'
        }
      },
      dayPlans,
      moneyTips: tips,
      accommodationSuggestions: accommodationDetails.suggestions,
      foodRecommendations: foodDetails.recommendations,
      alternatives: alternatives.length > 0 ? alternatives : null,
      warnings: isOverBudget ? [
        `Your estimated cost ($${estimatedCosts.total}) exceeds your budget ($${parsedBudget}).`,
        'Consider the alternative plans below to fit your budget.',
        'You can reduce trip duration, skip some activities, or adjust accommodation.'
      ] : []
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