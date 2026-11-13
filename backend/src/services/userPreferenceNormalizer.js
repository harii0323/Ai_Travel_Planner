/**
 * UserPreferenceNormalizer
 * 
 * Normalizes and validates user input for itinerary generation:
 * - Origin & Destination resolution (e.g., resolving "Kerala" to specific destination city)
 * - Dates, total duration & daily available hours
 * - Travelers count and companion type
 * - Travel mode, vehicle type, fuel type, and mileage
 * - Budget and cost constraints (group vs per-person)
 * - Normalized preference dimensions (spirituality, scenic, mountain, trekking, adventure, etc.)
 * - Food, accommodation, and pace preferences
 * - Departure time preference (early morning vs standard)
 */

const { PREFERENCE_DIMENSIONS, CATEGORY_TAG_MAP } = require('./preferenceEngine');

// Popular destination cities in Kerala if state name is passed
const KERALA_DESTINATION_CITIES = {
  munnar: {
    city: 'Munnar',
    state: 'Kerala',
    focus: 'Scenic hills, tea plantations, mist-covered mountain peaks, trekking, and waterfalls',
    coordinates: { lat: 10.0889, lng: 77.0595 }
  },
  wayanad: {
    city: 'Wayanad',
    state: 'Kerala',
    focus: 'Ancient caves, misty hill ranges, waterfalls, wildlife sanctuaries, and trekking trails',
    coordinates: { lat: 11.6854, lng: 76.1320 }
  },
  kochi: {
    city: 'Kochi',
    state: 'Kerala',
    focus: 'Historic port, Fort Kochi heritage, Chinese fishing nets, art cafes, and backwaters',
    coordinates: { lat: 9.9312, lng: 76.2673 }
  },
  alleppey: {
    city: 'Alleppey',
    state: 'Kerala',
    focus: 'Backwater canals, traditional houseboats, serene lagoons, and coastal beaches',
    coordinates: { lat: 9.4981, lng: 76.3388 }
  },
  thekkady: {
    city: 'Thekkady',
    state: 'Kerala',
    focus: 'Periyar Tiger Reserve, spice plantations, bamboo rafting, and elephant trails',
    coordinates: { lat: 9.6031, lng: 77.1615 }
  },
  trivandrum: {
    city: 'Thiruvananthapuram',
    state: 'Kerala',
    focus: 'Padmanabhaswamy Temple spirituality, Kovalam cliffs, beaches, and royal palaces',
    coordinates: { lat: 8.5241, lng: 76.9366 }
  }
};

/**
 * Resolves destination city when general region/state name is provided.
 */
function resolveDestination(destinationInput, preferences = {}) {
  const raw = String(destinationInput || '').trim();
  const lower = raw.toLowerCase();

  // If user explicitly asks for Kerala or mentions Kerala
  if (lower === 'kerala' || lower.includes('kerala')) {
    // Check if a specific city was mentioned in input or preferences
    for (const [key, val] of Object.entries(KERALA_DESTINATION_CITIES)) {
      if (lower.includes(key)) {
        return {
          originalDestination: raw,
          resolvedCity: val.city,
          fullDestination: `${val.city}, Kerala`,
          state: 'Kerala',
          coordinates: val.coordinates,
          focus: val.focus,
          isStateLevel: false
        };
      }
    }

    // Check user preferences or activity interests to select best fitting Kerala destination
    const actStr = String(preferences.activities || preferences.preferred_activities || '').toLowerCase();
    if (actStr.includes('hill') || actStr.includes('mountain') || actStr.includes('tea') || actStr.includes('trek')) {
      const def = KERALA_DESTINATION_CITIES.munnar;
      return {
        originalDestination: raw,
        resolvedCity: def.city,
        fullDestination: 'Munnar, Kerala',
        state: 'Kerala',
        coordinates: def.coordinates,
        focus: def.focus,
        isStateLevel: true,
        note: 'Kerala is a multi-region state. Based on your mountain, hill, scenic, and trekking preferences, Munnar has been selected as your primary destination city.'
      };
    }

    if (actStr.includes('beach') || actStr.includes('backwater') || actStr.includes('houseboat')) {
      const def = KERALA_DESTINATION_CITIES.alleppey;
      return {
        originalDestination: raw,
        resolvedCity: def.city,
        fullDestination: 'Alleppey, Kerala',
        state: 'Kerala',
        coordinates: def.coordinates,
        focus: def.focus,
        isStateLevel: true,
        note: 'Kerala is a multi-region state. Based on your beach and backwater preferences, Alleppey has been selected as your primary destination city.'
      };
    }

    // Default to Munnar for scenic / nature / road trip road access from Hyderabad
    const def = KERALA_DESTINATION_CITIES.munnar;
    return {
      originalDestination: raw,
      resolvedCity: def.city,
      fullDestination: 'Munnar, Kerala',
      state: 'Kerala',
      coordinates: def.coordinates,
      focus: def.focus,
      isStateLevel: true,
      note: 'Kerala is a multi-region state. Munnar (Idukki district) has been selected as your target destination city for this scenic road trip.'
    };
  }

  // General city destination
  return {
    originalDestination: raw,
    resolvedCity: raw.split(',')[0].trim(),
    fullDestination: raw,
    state: raw.includes(',') ? raw.split(',')[1].trim() : '',
    coordinates: null,
    isStateLevel: false
  };
}

/**
 * Normalizes travel dates and duration.
 */
function normalizeDatesAndDuration(rawInput) {
  const daysVal = parseInt(rawInput.days || rawInput.totalDays || rawInput.numDays || rawInput.trip_duration, 10);
  let totalDays = Number.isFinite(daysVal) && daysVal >= 1 ? Math.min(14, daysVal) : null;

  let startDate = null;
  let endDate = null;
  const rawDates = rawInput.travelDates || rawInput.dates || rawInput.travel_date;

  if (rawDates) {
    if (typeof rawDates === 'string' && rawDates.includes(' to ')) {
      const [sStr, eStr] = rawDates.split(' to ');
      startDate = new Date(sStr.trim());
      endDate = new Date(eStr.trim());
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        totalDays = Math.max(1, Math.min(14, diffDays));
      }
    } else {
      startDate = new Date(rawDates);
      if (!isNaN(startDate.getTime())) {
        if (!totalDays) totalDays = 5;
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (totalDays - 1));
      }
    }
  }

  if (!startDate || isNaN(startDate.getTime())) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    if (!totalDays) totalDays = 5;
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (totalDays - 1));
  }

  if (!totalDays) {
    totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
  }

  return {
    startDate,
    endDate,
    totalDays,
    datesString: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
  };
}

/**
 * Normalizes user interests across travel dimensions with numerical scores (0.0 to 1.0).
 */
function normalizeInterests(rawInput) {
  const profile = {};
  PREFERENCE_DIMENSIONS.forEach(dim => {
    profile[dim] = 0.25; // neutral baseline
  });

  // Extract raw activities text or array
  let rawList = [];
  const source = rawInput.activities || rawInput.preferred_activities || rawInput.interests || rawInput.preferences;
  if (typeof source === 'string') {
    rawList = source.split(',').map(s => s.trim().toLowerCase());
  } else if (Array.isArray(source)) {
    rawList = source.map(s => String(s).trim().toLowerCase());
  } else if (source && typeof source === 'object') {
    Object.keys(source).forEach(k => {
      const val = parseFloat(source[k]);
      if (!isNaN(val) && profile[k] !== undefined) {
        profile[k] = Math.max(0.0, Math.min(1.0, val));
      }
    });
  }

  // High weight mapping for explicitly requested preferences
  rawList.forEach(rawItem => {
    const item = rawItem.toLowerCase().replace(/[^a-z0-9_]/g, ' ');
    if (item.includes('spirit') || item.includes('temple') || item.includes('relig') || item.includes('darshan') || item.includes('puja')) {
      profile.temple = 0.95;
    }
    if (item.includes('scenic') || item.includes('landscape') || item.includes('view') || item.includes('photo')) {
      profile.photography = 0.95;
      profile.nature = 0.90;
    }
    if (item.includes('mountain') || item.includes('hill') || item.includes('ghat')) {
      profile.mountain = 0.95;
    }
    if (item.includes('trek') || item.includes('hike') || item.includes('trail')) {
      profile.trekking = 0.95;
    }
    if (item.includes('adventure') || item.includes('zipline') || item.includes('ropeway') || item.includes('safari') || item.includes('boating')) {
      profile.adventure = 0.90;
    }
    if (item.includes('waterfall') || item.includes('falls')) {
      profile.waterfall = 0.90;
    }
    if (item.includes('wildlife') || item.includes('forest') || item.includes('national park')) {
      profile.wildlife = 0.85;
    }
    if (item.includes('histor') || item.includes('heritage') || item.includes('fort') || item.includes('monument')) {
      profile.historical = 0.85;
    }
    if (item.includes('cultur')) {
      profile.cultural = 0.85;
    }
    if (item.includes('beach') || item.includes('coast')) {
      profile.beach = 0.85;
    }
    if (item.includes('relax') || item.includes('peace')) {
      profile.relaxation = 0.85;
    }
  });

  return profile;
}

/**
 * Main Normalization function
 */
function normalizeUserPreferences(rawInput = {}) {
  const origin = String(rawInput.origin || rawInput.startLocation || rawInput.start || 'Hyderabad').trim();
  const destinationData = resolveDestination(rawInput.destination || 'Kerala', rawInput);

  const { startDate, endDate, totalDays, datesString } = normalizeDatesAndDuration(rawInput);

  const travelersVal = parseInt(rawInput.numberOfTravelers || rawInput.travelers || rawInput.number_of_travelers, 10);
  const numberOfTravelers = Number.isFinite(travelersVal) && travelersVal >= 1 ? Math.min(50, travelersVal) : 1;

  const rawCompanion = String(rawInput.travelCompanionType || rawInput.companionType || rawInput.traveler_type || 'friends').toLowerCase();
  let companionType = 'friends';
  if (rawCompanion.includes('solo')) companionType = 'solo';
  else if (rawCompanion.includes('couple') || rawCompanion.includes('partner')) companionType = 'couple';
  else if (rawCompanion.includes('fam')) companionType = 'family';
  else if (rawCompanion.includes('friend')) companionType = 'friends';
  else if (rawCompanion.includes('group')) companionType = 'group';

  // Transport details
  const rawTransport = String(rawInput.transport || rawInput.travel_mode || rawInput.transportMode || 'car').toLowerCase();
  let transportMode = 'car';
  if (rawTransport.includes('bike') || rawTransport.includes('motorcycle')) transportMode = 'bike';
  else if (rawTransport.includes('bus')) transportMode = 'bus';
  else if (rawTransport.includes('train')) transportMode = 'train';
  else if (rawTransport.includes('flight')) transportMode = 'flight';
  else if (rawTransport.includes('rental') || rawTransport === 'selfdriverentalcar') transportMode = 'selfDriveRentalCar';
  else if (rawTransport.includes('car') || rawTransport.includes('personal') || rawTransport === 'owntransport') transportMode = 'car';

  const vehicleType = transportMode === 'bike' ? 'bike' : 'car';
  const fuelType = String(rawInput.fuelType || rawInput.fuel_type || 'petrol').toLowerCase();
  const rawMileage = parseFloat(rawInput.mileage || rawInput.vehicleMileage);
  const mileage = !isNaN(rawMileage) && rawMileage > 0 ? rawMileage : (vehicleType === 'bike' ? 40 : (fuelType === 'diesel' ? 18 : 15));

  // Departure preference
  const rawDep = String(rawInput.departurePreference || rawInput.departureTime || rawInput.startTime || 'early_morning').toLowerCase();
  const isEarlyMorning = rawDep.includes('early') || rawDep.includes('4:') || rawDep.includes('5:') || rawDep.includes('4.') || rawDep.includes('5.');
  const preferredDepartureTime = isEarlyMorning ? '04:30 AM' : (rawInput.startTime || '07:30 AM');

  // Budget
  const budgetVal = parseFloat(rawInput.budget || rawInput.total_budget || 45000);
  const budget = !isNaN(budgetVal) && budgetVal >= 1000 ? budgetVal : 45000;
  const isPerPersonBudget = Boolean(rawInput.isBudgetPerPerson);
  const totalBudget = isPerPersonBudget ? budget * numberOfTravelers : budget;

  // Pace and Style
  const rawPace = String(rawInput.planningStyle || rawInput.travelPace || rawInput.pace || 'balanced').toLowerCase();
  let pace = 'balanced';
  if (rawPace.includes('relax')) pace = 'relaxed';
  else if (rawPace.includes('fast') || rawPace.includes('rush')) pace = 'fast';

  const accommodation = String(rawInput.accommodation || rawInput.accommodationType || 'budgetHotel').trim();
  const foodPreference = String(rawInput.foodPreference || 'local_famous').trim();

  // Normalized interest profile
  const normalizedInterests = normalizeInterests(rawInput);

  // Return trip requested? (default true for road trips with origin != destination)
  const isRoundTrip = rawInput.isRoundTrip !== undefined
    ? Boolean(rawInput.isRoundTrip)
    : true; // Round trip requested by default for personal road trip

  return {
    origin,
    startLocation: origin,
    destination: destinationData.fullDestination,
    destinationCity: destinationData.resolvedCity,
    destinationData,
    startDate,
    endDate,
    totalDays,
    datesString,
    travelDates: datesString,
    numberOfTravelers,
    travelCompanionType: companionType,
    transportMode,
    isPersonalVehicle: transportMode === 'car' || transportMode === 'bike',
    vehicleDetails: {
      vehicleType,
      fuelType,
      mileage
    },
    departurePreference: isEarlyMorning ? 'early_morning' : 'standard',
    preferredDepartureTime,
    budget: totalBudget,
    totalBudget,
    perPersonBudget: Math.round(totalBudget / numberOfTravelers),
    normalizedInterests,
    pace,
    accommodation,
    foodPreference,
    isRoundTrip,
    rawInput
  };
}

module.exports = {
  normalizeUserPreferences,
  resolveDestination,
  normalizeDatesAndDuration,
  normalizeInterests,
  KERALA_DESTINATION_CITIES
};
