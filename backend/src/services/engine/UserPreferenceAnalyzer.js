/**
 * UserPreferenceAnalyzer
 * 
 * Module 1 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Ingests natural-language travel requests, companion requirements, and constraints.
 * - Normalizes travel dimensions into a calibrated numerical interest vector [0.0 - 1.0].
 * - NEVER assigns high importance to unexpressed activities (avoids default falsy bugs).
 * - Calibrates priorities based on destination context, companionship, pace, and vehicle details.
 * - Extracts constraints (places to avoid, budget limits, maximum daily travel hours).
 */

const PREFERENCE_DIMENSIONS = [
  'spiritual',
  'nature',
  'mountains',
  'adventure',
  'beaches',
  'historical',
  'cultural',
  'photography',
  'trekking',
  'wildlife',
  'food',
  'relaxation',
  'family',
  'waterfalls',
  'shopping',
  'nightlife'
];

// Known destination characteristics to derive natural context when user hasn't explicitly specified
const DESTINATION_PROFILES = {
  goa: { beaches: 0.95, relaxation: 0.85, food: 0.80, photography: 0.75, nightlife: 0.70, nature: 0.60 },
  tirupati: { spiritual: 0.98, cultural: 0.80, historical: 0.70, relaxation: 0.40 },
  manali: { mountains: 0.95, nature: 0.90, adventure: 0.85, photography: 0.90, trekking: 0.85 },
  hampi: { historical: 0.98, cultural: 0.90, photography: 0.85, nature: 0.60 },
  araku: { nature: 0.95, waterfalls: 0.90, photography: 0.90, relaxation: 0.80, mountains: 0.75 },
  arakuvalley: { nature: 0.95, waterfalls: 0.90, photography: 0.90, relaxation: 0.80, mountains: 0.75 },
  kerala: { nature: 0.90, mountains: 0.80, photography: 0.85, relaxation: 0.80, waterfalls: 0.75 },
  munnar: { mountains: 0.95, nature: 0.92, photography: 0.90, waterfalls: 0.80, trekking: 0.75 },
  wayanad: { nature: 0.92, wildlife: 0.85, waterfalls: 0.85, trekking: 0.80, mountains: 0.80 },
  alleppey: { beaches: 0.75, nature: 0.90, relaxation: 0.95, food: 0.80, photography: 0.85 },
  kochi: { cultural: 0.90, historical: 0.88, food: 0.85, photography: 0.75, beaches: 0.60 },
  jaipur: { historical: 0.95, cultural: 0.92, shopping: 0.80, food: 0.85, photography: 0.85 },
  agra: { historical: 0.98, cultural: 0.90, photography: 0.90, food: 0.70 },
  rishikesh: { spiritual: 0.90, adventure: 0.92, nature: 0.85, relaxation: 0.80, mountains: 0.80 },
  ooty: { mountains: 0.92, nature: 0.90, photography: 0.88, relaxation: 0.85 },
  kodaikanal: { mountains: 0.92, nature: 0.90, waterfalls: 0.85, photography: 0.88, relaxation: 0.85 },
  pondicherry: { beaches: 0.85, cultural: 0.85, relaxation: 0.88, food: 0.85, historical: 0.75 },
  coorg: { nature: 0.92, waterfalls: 0.85, relaxation: 0.85, mountains: 0.80, food: 0.80 },
  srisailam: { spiritual: 0.98, nature: 0.75, photography: 0.70, historical: 0.75 }
};

// Keyword mapping dictionary for natural language interest parsing
const KEYWORD_MAP = {
  spiritual: ['spiritual', 'spirituality', 'temple', 'temples', 'darshan', 'jyotirlinga', 'shrine', 'ashram', 'puja', 'religious', 'divine', 'pilgrimage', 'holy', 'ghats'],
  nature: ['nature', 'greenery', 'landscape', 'forest', 'valley', 'eco', 'botanical', 'flora', 'lakes', 'gardens', 'scenic'],
  mountains: ['mountain', 'mountains', 'hill', 'hills', 'hillstation', 'ghat', 'peak', 'ridge', 'pass', 'highland', 'mist'],
  adventure: ['adventure', 'rafting', 'kayaking', 'paragliding', 'zipline', 'sports', 'thrill', 'ropeway', 'bungee', 'boating', 'safari'],
  beaches: ['beach', 'beaches', 'coast', 'coastal', 'shore', 'ocean', 'sea', 'cove', 'waves', 'lighthouse', 'sand'],
  historical: ['historical', 'history', 'fort', 'forts', 'palace', 'monument', 'ruins', 'unesco', 'heritage', 'archaeological', 'ancient'],
  cultural: ['cultural', 'culture', 'tradition', 'art', 'dance', 'craft', 'folk', 'museum', 'monastery'],
  photography: ['photography', 'photo', 'camera', 'viewpoint', 'viewpoints', 'sunset', 'sunrise', 'panoramic', 'vistas', 'scenicview'],
  trekking: ['trekking', 'trek', 'hike', 'hiking', 'trails', 'walking', 'summit', 'trail'],
  wildlife: ['wildlife', 'safari', 'tiger', 'elephant', 'sanctuary', 'national park', 'animals', 'birds', 'birdwatching'],
  food: ['food', 'cuisine', 'culinary', 'seafood', 'streetfood', 'dining', 'restaurant', 'localfood', 'tasting', 'gourmet', 'dishes', 'coffee'],
  relaxation: ['relaxation', 'relax', 'chill', 'peaceful', 'serene', 'quiet', 'wellness', 'spa', 'calm', 'leisure', 'resort'],
  family: ['family', 'kids', 'children', 'elderly', 'comfortable', 'safe', 'parents'],
  waterfalls: ['waterfall', 'waterfalls', 'cascade', 'falls', 'stream', 'rapids'],
  shopping: ['shopping', 'bazaar', 'market', 'souvenirs', 'handicrafts', 'silk', 'spices'],
  nightlife: ['nightlife', 'party', 'shacks', 'clubs', 'bars', 'evening', 'acoustic']
};

/**
 * Normalizes travel dates, duration, and calendar bounds.
 */
function normalizeDateRange(rawDates, rawDays, rawInput = {}) {
  let startDate = null;
  let endDate = null;
  let totalDays = null;

  // 1. Try parsing explicit numeric duration keys
  const candidateDays = [
    rawDays,
    rawInput.totalDays,
    rawInput.days,
    rawInput.numberOfDays,
    rawInput.numDays,
    rawInput.trip_duration,
    rawInput.tripDuration,
    rawInput.durationDays,
    rawInput.duration,
    rawInput.availableDays,
    rawInput.tripDays
  ];
  for (const cand of candidateDays) {
    const num = parseInt(cand, 10);
    if (Number.isFinite(num) && num >= 1) {
      totalDays = num;
      break;
    }
  }

  // 2. Parse date range string ("YYYY-MM-DD to YYYY-MM-DD")
  const dateStr = typeof rawDates === 'string' && rawDates.includes(' to ')
    ? rawDates
    : (typeof rawInput.travelDates === 'string' && rawInput.travelDates.includes(' to ')
      ? rawInput.travelDates
      : (typeof rawInput.dates === 'string' && rawInput.dates.includes(' to ') ? rawInput.dates : ''));

  if (dateStr) {
    const [startStr, endStr] = dateStr.split(' to ');
    const s = new Date(startStr.trim());
    const e = new Date(endStr.trim());
    if (!isNaN(s.getTime())) startDate = s;
    if (!isNaN(e.getTime())) endDate = e;
  } else {
    // Check separate startDate and endDate
    const rawStart = rawInput.startDate || (rawDates && !(typeof rawDates === 'string' && rawDates.includes(' to ')) ? rawDates : null);
    const rawEnd = rawInput.endDate;
    if (rawStart) {
      const s = new Date(rawStart);
      if (!isNaN(s.getTime())) startDate = s;
    }
    if (rawEnd) {
      const e = new Date(rawEnd);
      if (!isNaN(e.getTime())) endDate = e;
    }
  }

  // 3. Natural language duration extraction from activities / prompt / notes
  if (!totalDays) {
    const text = `${rawInput.activities || ''} ${rawInput.prompt || ''} ${rawInput.notes || ''} ${rawInput.planningStyle || ''}`;
    const match = text.match(/\b(\d{1,2})\s*(?:day|days|d)\b/i);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed >= 1 && parsed <= 30) totalDays = parsed;
    }
  }

  // 4. Default start date if missing
  if (!startDate || isNaN(startDate.getTime())) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() + 7); // Default: 7 days in future
  }

  // 5. Reconcile dates and duration
  if (endDate && !isNaN(endDate.getTime()) && endDate >= startDate) {
    // Both startDate and endDate are valid
    const diffMs = endDate.getTime() - startDate.getTime();
    const calDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

    // User explicitly chose a date range, so the calendar duration takes precedence
    totalDays = calDays;
  } else {
    // End date missing or invalid: compute from totalDays
    if (!Number.isFinite(totalDays) || totalDays < 1) {
      totalDays = 3; // Fallback only if no days or dates specified anywhere
    }
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (totalDays - 1));
  }

  totalDays = Math.max(1, Math.min(30, totalDays));

  return {
    startDate,
    endDate,
    totalDays,
    formattedRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
  };
}

/**
 * Extracts normalized interest weights from user inputs.
 * Strictly respects unexpressed preferences: unmentioned dimensions stay at baseline.
 */
function extractInterestProfile(input = {}, destinationKey = '') {
  const profile = {};
  // Baseline neutral for unexpressed activities: 0.10 (NOT 0.95!)
  PREFERENCE_DIMENSIONS.forEach(dim => {
    profile[dim] = 0.10;
  });

  // 1. Explicit weights passed as object (e.g. from UI sliders or preset)
  const explicitWeights = input.preferences?.weights || input.preferences?.dimensions || input.preferences || {};
  if (typeof explicitWeights === 'object' && !Array.isArray(explicitWeights)) {
    Object.keys(explicitWeights).forEach(k => {
      const val = parseFloat(explicitWeights[k]);
      if (Number.isFinite(val) && val >= 0) {
        const canonicalKey = k.toLowerCase().replace(/[^a-z]/g, '');
        if (profile[canonicalKey] !== undefined) {
          profile[canonicalKey] = Math.max(0.0, Math.min(1.0, val));
        } else if (canonicalKey.includes('spirit') || canonicalKey.includes('temple')) {
          profile.spiritual = Math.max(profile.spiritual, Math.min(1.0, val));
        } else if (canonicalKey.includes('beach') || canonicalKey.includes('coast')) {
          profile.beaches = Math.max(profile.beaches, Math.min(1.0, val));
        } else if (canonicalKey.includes('mountain') || canonicalKey.includes('hill')) {
          profile.mountains = Math.max(profile.mountains, Math.min(1.0, val));
        } else if (canonicalKey.includes('photo') || canonicalKey.includes('scenic')) {
          profile.photography = Math.max(profile.photography, Math.min(1.0, val));
        }
      }
    });
  }

  // 2. Natural language keywords from activities string or array
  const rawActivities = input.activities || input.preferred_activities || input.preferredActivities || '';
  const textTokens = (typeof rawActivities === 'string' ? rawActivities.split(/[,;\n]/) : Array.isArray(rawActivities) ? rawActivities : [])
    .map(t => String(t).trim().toLowerCase())
    .filter(Boolean);

  // Also include travel style, planning style, food preference text
  const extraContext = `${input.travelStyle || ''} ${input.planningStyle || ''} ${input.foodPreference || ''} ${input.specialRequirements || ''}`.toLowerCase();

  for (const [dim, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const kw of keywords) {
      const foundInTokens = textTokens.some(t => t.includes(kw));
      const foundInContext = extraContext.includes(kw);
      if (foundInTokens) {
        profile[dim] = Math.max(profile[dim], 0.90);
      } else if (foundInContext) {
        profile[dim] = Math.max(profile[dim], 0.75);
      }
    }
  }

  // 3. Destination natural affinity (ONLY applied when user hasn't expressed specific preferences at all)
  const isUserExpressingSpecifics = textTokens.length > 0 || (typeof explicitWeights === 'object' && Object.keys(explicitWeights).length > 0);
  if (!isUserExpressingSpecifics && destinationKey && DESTINATION_PROFILES[destinationKey]) {
    const destProfile = DESTINATION_PROFILES[destinationKey];
    for (const [dim, impliedWeight] of Object.entries(destProfile)) {
      if (profile[dim] <= 0.15) {
        profile[dim] = impliedWeight;
      }
    }
  }

  // Round values
  Object.keys(profile).forEach(k => {
    profile[k] = Math.round(profile[k] * 100) / 100;
  });

  return profile;
}

/**
 * Normalizes travel companion constraints.
 */
function normalizeCompanionType(rawCompanion) {
  const comp = String(rawCompanion || 'solo').toLowerCase();
  if (comp.includes('fam')) return 'family';
  if (comp.includes('coup') || comp.includes('partner')) return 'couple';
  if (comp.includes('friend') || comp.includes('squad') || comp.includes('group')) return 'friends';
  return 'solo';
}

/**
 * Normalizes transport mode and vehicle specifications.
 */
function normalizeTransportDetails(input = {}) {
  const rawTransport = String(input.transport || input.travel_mode || input.transportMode || 'car').toLowerCase();
  let mode = 'car';

  if (rawTransport.includes('bike') || rawTransport.includes('motorcycle')) {
    mode = 'bike';
  } else if (rawTransport.includes('train')) {
    mode = 'train';
  } else if (rawTransport.includes('bus')) {
    mode = 'bus';
  } else if (rawTransport.includes('flight') || rawTransport.includes('plane')) {
    mode = 'flight';
  } else if (rawTransport.includes('rental') || rawTransport === 'selfdriverentalcar') {
    mode = 'selfDriveRentalCar';
  } else if (rawTransport.includes('car') || rawTransport === 'owntransport' || rawTransport.includes('personal')) {
    mode = 'car';
  }

  const isPersonalVehicle = mode === 'car' || mode === 'bike' || mode === 'selfDriveRentalCar';
  const fuelType = String(input.fuelType || input.fuel_type || 'petrol').toLowerCase();

  let mileage = parseFloat(input.mileage || input.vehicleMileage);
  if (!Number.isFinite(mileage) || mileage <= 0) {
    if (mode === 'bike') mileage = 40;
    else if (fuelType === 'diesel') mileage = 18;
    else if (fuelType === 'electric') mileage = 6; // km/kWh
    else mileage = 15;
  }

  return {
    mode,
    isPersonalVehicle,
    vehicleType: mode === 'bike' ? 'bike' : 'car',
    fuelType: fuelType === 'diesel' ? 'diesel' : fuelType === 'electric' ? 'electric' : fuelType === 'cng' ? 'cng' : 'petrol',
    mileage,
    rentalDetails: input.rentalDetails || null,
    rentalVehicle: input.rentalVehicle || null
  };
}

/**
 * Main UserPreferenceAnalyzer entry point.
 */
function analyzeUserPreferences(rawInput = {}) {
  const origin = String(rawInput.origin || rawInput.startLocation || rawInput.start || 'Hyderabad').trim();
  const rawDestination = String(rawInput.destination || 'Goa').trim();

  // Clean destination city name
  const destClean = rawDestination.split(',')[0].trim();
  const destKey = destClean.toLowerCase().replace(/[^a-z]/g, '');

  const dateData = normalizeDateRange(
    rawInput.travelDates || rawInput.dates || rawInput.travel_date || rawInput.travelDate,
    rawInput.totalDays || rawInput.days || rawInput.numberOfDays || rawInput.numDays || rawInput.trip_duration || rawInput.duration || rawInput.durationDays || rawInput.availableDays || rawInput.tripDays,
    rawInput
  );

  const travelersCount = Math.max(1, Math.min(50, parseInt(rawInput.numberOfTravelers || rawInput.travelers || rawInput.number_of_travelers || 1, 10)));
  const companionType = normalizeCompanionType(rawInput.travelCompanionType || rawInput.companionType || rawInput.traveler_type);

  // Budget calculations
  const rawBudget = parseFloat(rawInput.budget || rawInput.total_budget || 25000);
  const totalBudget = Number.isFinite(rawBudget) && rawBudget >= 500 ? rawBudget : 25000;
  const isBudgetPerPerson = Boolean(rawInput.isBudgetPerPerson);
  const effectiveTotalBudget = isBudgetPerPerson ? totalBudget * travelersCount : totalBudget;

  const transportDetails = normalizeTransportDetails(rawInput);
  const normalizedInterests = extractInterestProfile(rawInput, destKey);

  // Travel pace and daily time limits
  const rawPace = String(rawInput.travelPace || rawInput.planningStyle || rawInput.travelStyle || 'balanced').toLowerCase();
  let travelPace = 'balanced';
  let maxDailyDrivingHours = 6;

  if (rawPace.includes('relax') || rawPace.includes('slow') || companionType === 'family') {
    travelPace = 'relaxed';
    maxDailyDrivingHours = 4.5;
  } else if (rawPace.includes('fast') || rawPace.includes('active') || rawPace.includes('rush')) {
    travelPace = 'fast';
    maxDailyDrivingHours = 8;
  }

  // Places to avoid
  const rawAvoid = rawInput.placesToAvoid || rawInput.avoid || rawInput.avoidance || '';
  const placesToAvoid = (typeof rawAvoid === 'string' ? rawAvoid.split(/[,;\n]/) : Array.isArray(rawAvoid) ? rawAvoid : [])
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

  // Departure preference
  const rawDep = String(rawInput.departurePreference || rawInput.departureTime || rawInput.startTime || '07:00 AM').toLowerCase();
  const isEarlyBird = rawDep.includes('early') || rawDep.includes('4:') || rawDep.includes('5:');
  const departureTime = isEarlyBird ? '05:00 AM' : (rawInput.startTime || '07:30 AM');

  // Structured Preference Classification (Prompt Section 2)
  const mandatoryPreferences = [];
  const strongPreferences = [];
  const optionalInterests = [];
  const excludedCategories = [...placesToAvoid];

  Object.entries(normalizedInterests).forEach(([dim, weight]) => {
    if (weight >= 0.85) {
      mandatoryPreferences.push(dim);
    } else if (weight >= 0.65) {
      strongPreferences.push(dim);
    } else if (weight >= 0.30) {
      optionalInterests.push(dim);
    } else if (weight <= 0.15) {
      if (!excludedCategories.includes(dim)) excludedCategories.push(dim);
    }
  });

  // Adventure Intensity
  const isHighAdventure = normalizedInterests.adventure >= 0.8 || normalizedInterests.trekking >= 0.8;
  const isModAdventure = normalizedInterests.adventure >= 0.5 || normalizedInterests.nature >= 0.7;
  const adventureIntensity = isHighAdventure ? 'high' : isModAdventure ? 'moderate' : 'relaxed';

  return {
    origin,
    destination: rawDestination,
    destinationCity: destClean,
    destinationKey: destKey,
    startDate: dateData.startDate,
    endDate: dateData.endDate,
    totalDays: dateData.totalDays,
    travelDates: dateData.formattedRange,
    numberOfTravelers: travelersCount,
    travelCompanionType: companionType,
    totalBudget: effectiveTotalBudget,
    perPersonBudget: Math.round(effectiveTotalBudget / travelersCount),
    isBudgetPerPerson,
    transportDetails,
    transportMode: transportDetails.mode,
    vehicleDetails: {
      vehicleType: transportDetails.vehicleType,
      fuelType: transportDetails.fuelType,
      mileage: transportDetails.mileage
    },
    normalizedInterests,
    mandatoryPreferences,
    strongPreferences,
    optionalInterests,
    excludedCategories,
    adventureIntensity,
    travelPace,
    maxDailyDrivingHours,
    departureTime,
    placesToAvoid,
    foodPreference: rawInput.foodPreference || 'local_famous',
    accommodationPreference: rawInput.accommodation || rawInput.accommodationType || 'budgetHotel',
    specialRequirements: rawInput.specialRequirements || ''
  };
}

module.exports = {
  analyzeUserPreferences,
  PreferenceUnderstandingEngine: analyzeUserPreferences,
  PREFERENCE_DIMENSIONS,
  KEYWORD_MAP,
  DESTINATION_PROFILES
};
