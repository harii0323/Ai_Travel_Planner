// AI Travel Planner Service - Generates optimized, budget-friendly itineraries for students

// Database of budget-friendly accommodations
const accommodationDb = {
  hostel: { avgPrice: 15, maxPrice: 25, description: 'Youth hostels with shared or private rooms' },
  budgetHotel: { avgPrice: 35, maxPrice: 60, description: 'Budget hotels with basic amenities' },
  homestay: { avgPrice: 20, maxPrice: 40, description: 'Local homestays for cultural experience' },
  airbnb: { avgPrice: 30, maxPrice: 50, description: 'Budget Airbnb listings' },
  guesthouse: { avgPrice: 25, maxPrice: 45, description: 'Local guest houses' }
};

// Activity database with costs and categories
const activityDb = {
  adventure: [
    { name: 'Hiking', cost: 0, category: 'adventure', days: 8 },
    { name: 'Rock climbing', cost: 30, category: 'adventure', days: 4 },
    { name: 'Paragliding', cost: 80, category: 'adventure', days: 2 },
    { name: 'Kayaking', cost: 35, category: 'adventure', days: 3 },
    { name: 'Mountain biking', cost: 40, category: 'adventure', days: 5 }
  ],
  cultural: [
    { name: 'Museum visits', cost: 5, category: 'cultural', days: 7 },
    { name: 'Temple tours', cost: 0, category: 'cultural', days: 8 },
    { name: 'Historical site visits', cost: 10, category: 'cultural', days: 6 },
    { name: 'Local market exploration', cost: 0, category: 'cultural', days: 7 },
    { name: 'Street art tours', cost: 0, category: 'cultural', days: 5 }
  ],
  food: [
    { name: 'Street food tour', cost: 5, category: 'food', days: 7 },
    { name: 'Cooking class', cost: 25, category: 'food', days: 3 },
    { name: 'Food market visit', cost: 0, category: 'food', days: 7 },
    { name: 'Local restaurant dinner', cost: 12, category: 'food', days: 6 }
  ],
  nature: [
    { name: 'Beach time', cost: 0, category: 'nature', days: 8 },
    { name: 'National park visits', cost: 20, category: 'nature', days: 5 },
    { name: 'Wildlife watching', cost: 45, category: 'nature', days: 2 },
    { name: 'Forest walks', cost: 0, category: 'nature', days: 7 },
    { name: 'Waterfall visits', cost: 5, category: 'nature', days: 4 }
  ]
};

// Transportation costs (estimated per trip)
const transportCosts = {
  flight: { base: 150, perKm: 0.1, student_discount: 0.15 },
  train: { base: 50, perKm: 0.08, student_discount: 0.25 },
  bus: { base: 30, perKm: 0.05, student_discount: 0.20 },
  localTransport: { daily: 5, monthly: 30, student_discount: 0.25 }
};

// Daily meal costs
const foodCosts = {
  budget: { breakfast: 3, lunch: 5, dinner: 8 },
  moderate: { breakfast: 5, lunch: 8, dinner: 12 },
  splurge: { breakfast: 8, lunch: 12, dinner: 18 }
};

// Calculate number of days from date range
function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
}

// Get transportation cost estimate
function estimateTransportCost(mode, distance, isStudent = true) {
  const config = transportCosts[mode] || transportCosts.bus;
  let cost = config.base + (distance * config.perKm || 0);
  
  if (isStudent) {
    cost = cost * (1 - config.student_discount);
  }
  
  return Math.round(cost * 100) / 100;
}

// Allocate budget across categories
function allocateBudget(totalBudget, numDays) {
  // Recommended budget allocation for students (in percentages)
  const allocation = {
    mainTransport: 0.25, // Inter-city transport
    accommodation: 0.35, // Lodging
    food: 0.25, // Food and dining
    activities: 0.10, // Activities and attractions
    miscellaneous: 0.05 // Emergencies and misc
  };

  return {
    mainTransport: Math.round(totalBudget * allocation.mainTransport),
    accommodation: Math.round(totalBudget * allocation.accommodation),
    food: Math.round(totalBudget * allocation.food),
    activities: Math.round(totalBudget * allocation.activities),
    miscellaneous: Math.round(totalBudget * allocation.miscellaneous),
    perDayBudget: Math.round(totalBudget / numDays)
  };
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
      { name: 'Street food tour', cost: 5, category: 'food' }
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

// Generate day-wise itinerary
function generateDayWiseItinerary(numDays, destination, activities, accommodation) {
  const dayPlans = [];
  const activityIndex = {};
  
  // Initialize activity counter
  for (const activity of activities) {
    if (!activityIndex[activity.estimatedDay]) {
      activityIndex[activity.estimatedDay] = [];
    }
    activityIndex[activity.estimatedDay].push(activity);
  }

  for (let day = 1; day <= numDays; day++) {
    let plan = '';
    
    if (day === 1) {
      plan = `Day ${day} - Arrival:\n`;
      plan += `- Arrive at ${destination}\n`;
      plan += `- Check into ${accommodation.type}\n`;
      plan += `- Explore nearby area/grab dinner locally\n`;
      plan += `- Rest and acclimatize`;
    } else if (day === numDays) {
      plan = `Day ${day} - Departure:\n`;
      plan += `- Final shopping/souvenir hunting\n`;
      plan += `- Last meal at favorite local spot\n`;
      plan += `- Check out and depart`;
    } else {
      plan = `Day ${day}:\n`;
      
      if (activityIndex[day] && activityIndex[day].length > 0) {
        plan += `- Activities:\n`;
        for (const activity of activityIndex[day]) {
          plan += `  * ${activity.name} (Cost: $${activity.cost})\n`;
        }
      } else {
        plan += `- Free exploration time\n`;
        plan += `- Visit local attractions\n`;
      }
      
      plan += `- Morning: Local breakfast and exploration\n`;
      plan += `- Afternoon: Main activity\n`;
      plan += `- Evening: Local dinner and street food`;
    }

    dayPlans.push({
      day,
      plan,
      activities: activityIndex[day] || []
    });
  }

  return dayPlans;
}

// Calculate estimated daily food costs
function estimateFoodCosts(numDays, budget) {
  const dailyFoodBudget = Math.round(budget / numDays);
  const meals = {
    breakfast: 3,
    lunch: 5,
    dinner: 8
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
      originalBudget * 0.30 + // accommodation (hostels only)
      originalBudget * 0.20 + // transport
      originalBudget * 0.30   // food (budget meals)
    ),
    savings: estimatedCost - (originalBudget * 0.80),
    pros: 'Maximum savings, authentic local experience',
    cons: 'Miss out on paid activities and attractions'
  });

  // Alternative 3: Nearby destination
  alternatives.push({
    name: 'Nearby Alternative Destination',
    description: 'Visit a closer destination with lower costs',
    estimatedCost: Math.round(originalBudget * 0.85),
    savings: Math.round(originalBudget * 0.15),
    pros: 'Lower transport costs, same experience quality',
    cons: 'Different destination'
  });

  return alternatives;
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