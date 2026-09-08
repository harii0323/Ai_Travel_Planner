/**
 * Dynamic Travel Planner Algorithm
 * Implementation of Multi-Factor Greedy Time-Windowed Scheduling with
 * Geographic Clustering, 2-Opt Route Optimization, and Real-Time Re-Optimization.
 *
 * Core Decision Formula:
 * NextScore = 0.30*P + 0.20*T + 0.15*W + 0.15*R + 0.10*D + 0.10*V - 0.10*C
 */

const {
  getDistanceFromGoogleMaps,
  getDirectionsFromGoogleMaps,
  searchPlacesByText,
  findPlacesNearby,
  hasGoogleMapsAPI
} = require('../utils/googleMapsAPI');

const indiaTouristPlaces = require('../data/indiaTouristPlaces');
const {
  segmentRoute,
  calculateFameScore,
  computeComprehensivePlaceScore,
  discoverAllRouteCandidates,
  FAMOUS_LANDMARKS_DATABASE
} = require('./routePlaceDiscoveryEngine');

/* =========================================================================
 * 1. PLACE KNOWLEDGE BASE & METADATA ENRICHMENT
 * ========================================================================= */

// Default opening/closing hours and visit durations by category
const CATEGORY_DEFAULTS = {
  sunrise_point: {
    open: '05:00',
    close: '19:00',
    durationMinutes: 75,
    bestWindow: { start: '05:00', end: '07:30', peak: '06:00', type: 'sunrise' },
    sunriseSuitable: true,
    sunsetSuitable: false,
    rainSafe: false,
    entryFee: 0,
    activityType: 'nature'
  },
  sunset_point: {
    open: '06:00',
    close: '20:00',
    durationMinutes: 90,
    bestWindow: { start: '16:45', end: '19:00', peak: '18:00', type: 'sunset' },
    sunriseSuitable: false,
    sunsetSuitable: true,
    rainSafe: false,
    entryFee: 0,
    activityType: 'nature'
  },
  temple: {
    open: '06:00',
    close: '20:30',
    durationMinutes: 60,
    bestWindow: { start: '06:30', end: '10:00', peak: '08:00', type: 'morning' },
    sunriseSuitable: false,
    sunsetSuitable: false,
    rainSafe: true,
    entryFee: 0,
    activityType: 'cultural'
  },
  museum: {
    open: '10:00',
    close: '17:30',
    durationMinutes: 105,
    bestWindow: { start: '11:30', end: '16:00', peak: '13:30', type: 'afternoon' },
    sunriseSuitable: false,
    sunsetSuitable: false,
    rainSafe: true,
    entryFee: 50,
    activityType: 'cultural'
  },
  palace: {
    open: '09:00',
    close: '17:30',
    durationMinutes: 120,
    bestWindow: { start: '09:30', end: '13:00', peak: '10:30', type: 'morning' },
    sunriseSuitable: false,
    sunsetSuitable: false,
    rainSafe: true,
    entryFee: 200,
    activityType: 'heritage'
  },
  fort: {
    open: '08:30',
    close: '18:00',
    durationMinutes: 150,
    bestWindow: { start: '09:00', end: '12:00', peak: '10:00', type: 'morning' },
    sunriseSuitable: false,
    sunsetSuitable: true,
    rainSafe: false,
    entryFee: 100,
    activityType: 'heritage'
  },
  beach: {
    open: '00:00',
    close: '23:59',
    durationMinutes: 120,
    bestWindow: { start: '15:30', end: '19:00', peak: '17:30', type: 'sunset' },
    sunriseSuitable: true,
    sunsetSuitable: true,
    rainSafe: false,
    entryFee: 0,
    activityType: 'nature'
  },
  waterfall: {
    open: '07:00',
    close: '17:30',
    durationMinutes: 90,
    bestWindow: { start: '09:00', end: '14:00', peak: '11:00', type: 'morning' },
    sunriseSuitable: false,
    sunsetSuitable: false,
    rainSafe: false,
    entryFee: 30,
    activityType: 'nature'
  },
  national_park: {
    open: '06:00',
    close: '17:00',
    durationMinutes: 180,
    bestWindow: { start: '06:00', end: '10:00', peak: '07:00', type: 'morning' },
    sunriseSuitable: true,
    sunsetSuitable: false,
    rainSafe: false,
    entryFee: 250,
    activityType: 'adventure'
  },
  market: {
    open: '11:00',
    close: '21:30',
    durationMinutes: 90,
    bestWindow: { start: '16:00', end: '20:30', peak: '18:30', type: 'evening' },
    sunriseSuitable: false,
    sunsetSuitable: false,
    rainSafe: true,
    entryFee: 0,
    activityType: 'food'
  },
  viewpoint: {
    open: '05:30',
    close: '19:30',
    durationMinutes: 60,
    bestWindow: { start: '06:00', end: '08:30', peak: '06:30', type: 'sunrise' },
    sunriseSuitable: true,
    sunsetSuitable: true,
    rainSafe: false,
    entryFee: 20,
    activityType: 'nature'
  },
  lake: {
    open: '06:00',
    close: '19:00',
    durationMinutes: 80,
    bestWindow: { start: '15:30', end: '18:30', peak: '17:00', type: 'sunset' },
    sunriseSuitable: true,
    sunsetSuitable: true,
    rainSafe: false,
    entryFee: 50,
    activityType: 'nature'
  },
  adventure: {
    open: '08:00',
    close: '17:00',
    durationMinutes: 120,
    bestWindow: { start: '08:30', end: '13:00', peak: '10:00', type: 'morning' },
    sunriseSuitable: false,
    sunsetSuitable: false,
    rainSafe: false,
    entryFee: 500,
    activityType: 'adventure'
  }
};

/**
 * Convert time string "HH:MM" to minutes from midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  if (typeof timeStr === 'number') return timeStr;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Convert minutes from midnight to "HH:MM" string
 */
function minutesToTime(minutes) {
  const norm = Math.max(0, Math.floor(minutes)) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Format 24-hr time to 12-hr with AM/PM
 */
function formatTime12(timeStrOrMinutes) {
  const mins = typeof timeStrOrMinutes === 'number' ? timeStrOrMinutes : timeToMinutes(timeStrOrMinutes);
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Detect place category from name and keywords
 */
function detectPlaceCategory(placeName, placeTypes = []) {
  const name = String(placeName || '').toLowerCase();
  const types = (placeTypes || []).map((t) => String(t).toLowerCase());

  if (name.includes('sunrise') || name.includes('tiger hill') || name.includes('sarangkot')) return 'sunrise_point';
  if (name.includes('sunset') || name.includes('sunset point') || name.includes('anjuna sunset')) return 'sunset_point';
  if (name.includes('temple') || name.includes('mandir') || name.includes('ashram') || name.includes('ghat') || types.includes('hindu_temple') || types.includes('place_of_worship')) return 'temple';
  if (name.includes('museum') || name.includes('memorial') || name.includes('gallery') || types.includes('museum')) return 'museum';
  if (name.includes('palace') || name.includes('haveli') || name.includes('mahal')) return 'palace';
  if (name.includes('fort') || name.includes('castle') || name.includes('qila')) return 'fort';
  if (name.includes('beach') || name.includes('cove') || name.includes('sea') || name.includes('cliff')) return 'beach';
  if (name.includes('waterfall') || name.includes('falls') || name.includes('cascade')) return 'waterfall';
  if (name.includes('national park') || name.includes('wildlife') || name.includes('sanctuary') || name.includes('safari')) return 'national_park';
  if (name.includes('bazaar') || name.includes('market') || name.includes('mall road') || name.includes('street')) return 'market';
  if (name.includes('viewpoint') || name.includes('peak') || name.includes('lookout') || name.includes('hill')) return 'viewpoint';
  if (name.includes('lake') || name.includes('tal') || name.includes('dam') || name.includes('backwater')) return 'lake';
  if (name.includes('rafting') || name.includes('camp') || name.includes('paragliding') || name.includes('trek')) return 'adventure';

  return 'viewpoint';
}

/**
 * Enrich raw place with complete metadata
 */
function enrichPlace(rawPlace, destinationName = '') {
  const category = detectPlaceCategory(rawPlace.name, rawPlace.types || rawPlace.categories);
  const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.viewpoint;

  const lat = rawPlace.coordinates?.lat || rawPlace.geometry?.location?.lat || rawPlace.lat || 0;
  const lng = rawPlace.coordinates?.lng || rawPlace.geometry?.location?.lng || rawPlace.lng || 0;

  const openingTime = rawPlace.openingTime || rawPlace.openingHours?.open || defaults.open;
  const closingTime = rawPlace.closingTime || rawPlace.openingHours?.close || defaults.close;

  return {
    placeId: rawPlace.placeId || rawPlace.id || `place_${rawPlace.name.replace(/\s+/g, '_').toLowerCase()}`,
    name: rawPlace.name,
    city: rawPlace.city || destinationName,
    state: rawPlace.state || '',
    coordinates: { lat, lng },
    category,
    rating: Number(rawPlace.rating || 4.4),
    reviews: Number(rawPlace.reviews || rawPlace.userRatingsTotal || 850),
    openingTime,
    closingTime,
    openingMinutes: timeToMinutes(openingTime),
    closingMinutes: timeToMinutes(closingTime),
    recommendedVisitDuration: Number(rawPlace.recommendedVisitDuration || rawPlace.averageVisitDuration || defaults.durationMinutes),
    bestVisitWindow: rawPlace.bestVisitWindow || defaults.bestWindow,
    sunriseSunsetSuitability: {
      sunrise: rawPlace.sunriseSuitable ?? defaults.sunriseSuitable,
      sunset: rawPlace.sunsetSuitable ?? defaults.sunsetSuitable
    },
    weatherSuitability: {
      rainSafe: rawPlace.rainSafe ?? defaults.rainSafe,
      outdoor: !(rawPlace.rainSafe ?? defaults.rainSafe),
      season: rawPlace.bestTimeToVisit?.season || 'Pleasant'
    },
    entryFee: Number(rawPlace.entryFee ?? defaults.entryFee),
    activityType: rawPlace.activityType || defaults.activityType
  };
}

/* =========================================================================
 * 2. STEP 1: DISCOVER PLACES
 * ========================================================================= */

/**
 * Get curated and API places for a destination
 * Get curated and API places for a destination and complete travel corridor
 */
async function getPlaces(destination, preferredPlaceType = '', limit = 40, userPreferences = {}, startLocation = '') {
  const normalizedDest = String(destination || '').toLowerCase().trim();
  const normalizedStart = String(startLocation || '').toLowerCase().trim();
  const enrichedList = [];
  const seenNames = new Set();

  // 1. Check built-in India tourism dataset
  console.log(`\n======================================================`);
  console.log(`🏛️ [PlaceDiscovery] Discovering attractions for: "${destination}" (Start: "${startLocation || 'Local'}")`);

  // 1. Discover using Route Discovery Engine (segmentation + landmark database + multi-query)
  if (normalizedStart && normalizedStart !== normalizedDest) {
    try {
      const corridorCandidates = await discoverAllRouteCandidates({
        startLocation,
        destination,
        userPreferences,
        maxPlaces: limit
      });
      corridorCandidates.forEach((p) => {
        const key = p.name.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          enrichedList.push(enrichPlace(p, p.city || destination));
        }
      });
    } catch (err) {
      console.warn('   ⚠️ Corridor discovery notice:', err.message);
    }
  }

  // 2. Discover destination landmarks from Landmark Heritage Database
  const landmarkMatches = FAMOUS_LANDMARKS_DATABASE.filter((lm) => {
    const city = (lm.city || '').toLowerCase();
    const state = (lm.state || '').toLowerCase();
    const name = (lm.name || '').toLowerCase();
    return (
      city.includes(normalizedDest) ||
      normalizedDest.includes(city) ||
      state.includes(normalizedDest) ||
      name.includes(normalizedDest)
    );
  });

  landmarkMatches.forEach((lm) => {
    const key = lm.name.toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      enrichedList.push(enrichPlace(lm, destination));
    }
  });

  // 3. Search built-in India Tourist Places Database
  const localMatches = indiaTouristPlaces.filter((p) => {
    const city = (p.city || '').toLowerCase();
    const state = (p.state || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    return (
      city.includes(normalizedDest) ||
      normalizedDest.includes(city) ||
      state.includes(normalizedDest) ||
      name.includes(normalizedDest)
    );
  });

  localMatches.forEach((p) => {
    const key = p.name.toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      enrichedList.push(enrichPlace(p, destination));
    }
  });

  // 2. If Google Maps API is available, search for more top attractions
  if (hasGoogleMapsAPI() && enrichedList.length < 15) {
    try {
      const apiResults = await searchPlacesByText(`top tourist attractions in ${destination}`);
      if (Array.isArray(apiResults)) {
        apiResults.forEach((place) => {
          const key = place.name.toLowerCase();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            enrichedList.push(enrichPlace(place, destination));
          }
        });
      }
    } catch (err) {
      console.warn('Google Places search error:', err.message);
    }
  }

  // 4. Multi-query Google Places API search
  if (hasGoogleMapsAPI() && enrichedList.length < 25) {
    const queries = [
      `famous tourist places in ${destination}`,
      `top attractions and temples in ${destination}`,
      `must visit places in ${destination}`
    ];
    for (const query of queries) {
      try {
        const apiResults = await searchPlacesByText(query);
        if (Array.isArray(apiResults)) {
          apiResults.forEach((place) => {
            const key = place.name.toLowerCase();
            if (!seenNames.has(key)) {
              seenNames.add(key);
              enrichedList.push(enrichPlace(place, destination));
            }
          });
        }
      } catch (err) {
        console.warn('Google Places search error:', err.message);
      }
    }
  }

  // 3. Fallback destination-specific presets if list is small
  // 5. Fallback presets if list is small
  if (enrichedList.length < 5) {
    const defaultAttractions = [
      { name: `${destination} Sunrise Point`, category: 'sunrise_point' },
      { name: `${destination} Heritage Temple`, category: 'temple' },
      { name: `${destination} Central Museum & Gallery`, category: 'museum' },
      { name: `${destination} Scenic Lake / Waterfront`, category: 'lake' },
      { name: `${destination} Old Fort & Viewpoint`, category: 'fort' },
      { name: `${destination} Local Food Market & Bazaar`, category: 'market' },
      { name: `${destination} Sunset Promenade`, category: 'sunset_point' }
    ];

    defaultAttractions.forEach((p) => {
      const key = p.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        enrichedList.push(enrichPlace(p, destination));
      }
    });
  }

  console.log(`✅ [PlaceDiscovery] Found ${enrichedList.length} candidate places for ${destination}`);
  return enrichedList.slice(0, limit);
}

/* =========================================================================
 * 3. STEP 2: MATCH USER PREFERENCES & SCORING
 * ========================================================================= */

/**
 * Calculate user preference match score (0.0 to 1.0)
 */
function calculatePreferenceMatch(placeCategory, userPreferences = {}) {
  const preferredActivities = String(userPreferences.activities || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const preferredType = String(userPreferences.preferredPlaceType || userPreferences.placeType || '').toLowerCase();
  const travelStyle = String(userPreferences.travelStyle || 'balanced').toLowerCase();

  let score = 0.5; // Base score

  // Category to user activity mapping
  const categoryActivityMap = {
    sunrise_point: ['nature', 'photography', 'adventure'],
    sunset_point: ['nature', 'photography', 'relaxation'],
    temple: ['cultural', 'heritage', 'spiritual'],
    museum: ['cultural', 'heritage', 'history'],
    palace: ['cultural', 'heritage', 'photography'],
    fort: ['heritage', 'adventure', 'photography'],
    beach: ['nature', 'relaxation', 'adventure'],
    waterfall: ['nature', 'trekking', 'photography'],
    national_park: ['wildlife', 'nature', 'adventure'],
    market: ['food', 'shopping', 'cultural'],
    viewpoint: ['nature', 'photography', 'trekking'],
    lake: ['nature', 'relaxation', 'photography'],
    adventure: ['adventure', 'trekking', 'camping']
  };

  const relevantActivities = categoryActivityMap[placeCategory] || ['nature', 'cultural'];

  // Check overlap with preferred activities
  const matches = preferredActivities.filter((act) => relevantActivities.includes(act));
  if (matches.length > 0) {
    score += 0.35 * (matches.length / Math.max(1, preferredActivities.length));
  }

  // Check preferred place type match
  if (preferredType) {
    if (
      (preferredType.includes('mountain') && ['viewpoint', 'sunrise_point', 'waterfall', 'adventure'].includes(placeCategory)) ||
      (preferredType.includes('beach') && ['beach', 'sunset_point', 'lake'].includes(placeCategory)) ||
      (preferredType.includes('heritage') && ['palace', 'fort', 'temple', 'museum'].includes(placeCategory)) ||
      (preferredType.includes('wildlife') && ['national_park', 'lake'].includes(placeCategory))
    ) {
      score += 0.25;
    }
  }

  return Math.min(1.0, Math.max(0.1, score));
}

/**
 * Normalize rating score (0.0 to 1.0)
 */
function normalizeRating(rating) {
  const r = Number(rating) || 4.0;
  return Math.min(1.0, Math.max(0.0, (r - 3.0) / 2.0));
}

/**
 * Calculate popularity / review confidence score (0.0 to 1.0)
 */
function calculateReviewConfidence(reviews) {
  const count = Math.max(1, Number(reviews) || 50);
  return Math.min(1.0, Math.log10(count) / 4.5);
}

/**
 * Calculate place score
 * placeScore = 0.40 * preferenceScore + 0.25 * ratingScore + 0.15 * popularityScore + 0.20 * activityRelevance
 * placeScore = 0.30 * fameScore + 0.25 * preferenceScore + 0.20 * ratingScore + 0.15 * popularityScore + 0.10 * activityRelevance
 */
function calculatePlaceScore(place, userPreferences) {
  const fameScore = calculateFameScore(place);
  const preferenceScore = calculatePreferenceMatch(place.category, userPreferences);
  const ratingScore = normalizeRating(place.rating);
  const popularityScore = calculateReviewConfidence(place.reviews);
  const activityRelevance = preferenceScore;

  const placeScore =
    0.30 * fameScore +
    0.25 * preferenceScore +
    0.20 * ratingScore +
    0.15 * popularityScore +
    0.10 * activityRelevance;

  return {
    placeScore: Math.round(placeScore * 1000) / 1000,
    fameScore: Math.round(fameScore * 100) / 100,
    preferenceScore: Math.round(preferenceScore * 100) / 100,
    ratingScore: Math.round(ratingScore * 100) / 100,
    popularityScore: Math.round(popularityScore * 100) / 100,
    activityRelevance: Math.round(activityRelevance * 100) / 100,
    isMustVisit: fameScore >= 0.85 || (fameScore >= 0.8 && place.rating >= 4.7)
  };
}

/* =========================================================================
 * 4. STEP 4: TIME & WEATHER SUITABILITY
 * ========================================================================= */

/**
 * Calculate time suitability curve
 * Function CalculateTimeSuitability(place, arrivalMinutes)
 */
function calculateTimeSuitability(place, arrivalMinutes) {
  const arrival = typeof arrivalMinutes === 'number' ? arrivalMinutes : timeToMinutes(arrivalMinutes);

  // Closed check
  if (arrival < place.openingMinutes || arrival > place.closingMinutes) {
    return 0.0;
  }

  const window = place.bestVisitWindow;
  if (!window || !window.start || !window.end) {
    return 0.5;
  }

  const winStart = timeToMinutes(window.start);
  const winEnd = timeToMinutes(window.end);
  const winPeak = window.peak ? timeToMinutes(window.peak) : (winStart + winEnd) / 2;

  // Inside best window: graded curve peaking at 1.0
  if (arrival >= winStart && arrival <= winEnd) {
    const diffFromPeak = Math.abs(arrival - winPeak);
    const windowSpan = Math.max(30, (winEnd - winStart) / 2);
    return 1.0 - 0.2 * (diffFromPeak / windowSpan);
  }

  // Near best window (within 60 mins before or after)
  const distBefore = winStart - arrival;
  const distAfter = arrival - winEnd;
  if ((distBefore > 0 && distBefore <= 60) || (distAfter > 0 && distAfter <= 60)) {
    const dist = Math.min(Math.abs(distBefore), Math.abs(distAfter));
    return 0.7 - 0.3 * (dist / 60);
  }

  // Default outside optimal window but open
  return 0.3;
}

/**
 * Calculate weather suitability (0.0 to 1.0)
 */
function calculateWeatherSuitability(place, weatherCondition = 'Clear') {
  const isRain = String(weatherCondition).toLowerCase().includes('rain') || String(weatherCondition).toLowerCase().includes('storm');

  if (isRain) {
    return place.weatherSuitability.rainSafe ? 0.9 : 0.2;
  }

  // Pleasant / Sunny / Clear
  return 0.95;
}

/**
 * Calculate category diversity score (0.0 to 1.0)
 * Penalizes visiting the same category consecutively or repeatedly
 */
function calculateCategoryDiversity(selectedPlaces, candidateCategory) {
  if (!selectedPlaces || selectedPlaces.length === 0) return 1.0;

  const countOfSameCategory = selectedPlaces.filter((p) => p.category === candidateCategory).length;
  const lastPlace = selectedPlaces[selectedPlaces.length - 1];

  let penalty = 0;
  if (lastPlace && lastPlace.category === candidateCategory) {
    penalty += 0.5; // Back-to-back same category penalty
  }

  penalty += countOfSameCategory * 0.25;
  return Math.max(0.1, 1.0 - penalty);
}

/* =========================================================================
 * 5. STEP 5: TRAVEL TIME & DISTANCE MATRIX
 * ========================================================================= */

/**
 * Compute straight-line distance in km (Haversine formula)
 */
function haversineDistanceKm(coord1, coord2) {
  if (!coord1 || !coord2 || coord1.lat == null || coord2.lat == null) return 5;
  const R = 6371; // Earth radius km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Estimate real-time travel duration in minutes based on distance & transport mode
 */
function estimateTravelMinutes(coord1, coord2, transportMode = 'car') {
  const distanceKm = haversineDistanceKm(coord1, coord2);
  const mode = String(transportMode || 'car').toLowerCase();

  let avgSpeedKmh = 30; // Average city speed with traffic
  if (mode === 'walking') avgSpeedKmh = 4.5;
  else if (mode === 'bike') avgSpeedKmh = 35;
  else if (mode === 'bus') avgSpeedKmh = 22;
  else if (mode === 'train') avgSpeedKmh = 45;

  const travelMinutes = Math.max(8, Math.round((distanceKm / avgSpeedKmh) * 60) + 5);
  return { distanceKm, travelMinutes };
}

/* =========================================================================
 * 6. STEP 6 & 9: MULTI-DAY GEOGRAPHIC CLUSTERING
 * ========================================================================= */

/**
 * Cluster places geographically into K clusters (for K days)
 * Simple Spatial K-Means clustering
 */
function clusterPlacesByProximity(places, k) {
  if (places.length === 0) return [];
  const numClusters = Math.min(k, places.length);
  if (numClusters <= 1) return [places];

  // Initialize centroids spread across sorted coordinates
  const sorted = [...places].sort((a, b) => (a.coordinates.lat - b.coordinates.lat) || (a.coordinates.lng - b.coordinates.lng));
  const step = Math.floor(sorted.length / numClusters);
  const centroids = [];
  for (let i = 0; i < numClusters; i++) {
    const place = sorted[Math.min(i * step, sorted.length - 1)];
    centroids.push({ lat: place.coordinates.lat, lng: place.coordinates.lng });
  }

  let clusters = Array.from({ length: numClusters }, () => []);

  // 3 Iterations of K-Means
  for (let iter = 0; iter < 3; iter++) {
    clusters = Array.from({ length: numClusters }, () => []);
    places.forEach((place) => {
      let bestClusterIdx = 0;
      let minDistance = Infinity;
      centroids.forEach((centroid, idx) => {
        const dist = haversineDistanceKm(place.coordinates, centroid);
        if (dist < minDistance) {
          minDistance = dist;
          bestClusterIdx = idx;
        }
      });
      clusters[bestClusterIdx].push(place);
    });

    // Update centroids
    clusters.forEach((cluster, idx) => {
      if (cluster.length > 0) {
        const avgLat = cluster.reduce((sum, p) => sum + p.coordinates.lat, 0) / cluster.length;
        const avgLng = cluster.reduce((sum, p) => sum + p.coordinates.lng, 0) / cluster.length;
        centroids[idx] = { lat: avgLat, lng: avgLng };
      }
    });
  }

  // Filter empty clusters and balance
  return clusters.filter((c) => c.length > 0);
}

/* =========================================================================
 * 7. STEP 7 & 8: GREEDY DECISION FORMULA + 2-OPT ROUTE OPTIMIZATION
 * ========================================================================= */

/**
 * The Core Decision Formula:
 * NextScore = 0.30P + 0.20T + 0.15W + 0.15R + 0.10D + 0.10V - 0.10C
 */
function evaluateNextPlaceCandidate({
  place,
  currentLocation,
  currentTimeMinutes,
  selectedPlaces,
  userPreferences,
  transportMode,
  weatherCondition
}) {
  const { travelMinutes, distanceKm } = estimateTravelMinutes(currentLocation, place.coordinates, transportMode);
  const arrivalTime = currentTimeMinutes + travelMinutes;

  // Opening hours check
  if (arrivalTime < place.openingMinutes || arrivalTime > place.closingMinutes) {
    return { feasible: false, reason: 'outside_hours' };
  }

  const visitEnd = arrivalTime + place.recommendedVisitDuration;

  // Variable values
  const { preferenceScore, ratingScore, popularityScore } = calculatePlaceScore(place, userPreferences);
  const P = preferenceScore;
  const T = calculateTimeSuitability(place, arrivalTime);
  const W = calculateWeatherSuitability(place, weatherCondition);
  const R = ratingScore * 0.7 + popularityScore * 0.3;
  const D = calculateCategoryDiversity(selectedPlaces, place.category);
  const V = Math.min(1.0, place.rating / 5.0);
  const C = Math.min(1.0, travelMinutes / 60); // 60 mins travel penalty cap

  // NextScore Formula:
  const nextScore =
    0.3 * P +
    0.2 * T +
    0.15 * W +
    0.15 * R +
    0.1 * D +
    0.1 * V -
    0.1 * C;

  return {
    feasible: true,
    nextScore,
    travelMinutes,
    distanceKm,
    arrivalTime,
    visitEnd,
    scores: { P, T, W, R, D, V, C }
  };
}

/**
 * Apply 2-Opt local search on day itinerary to minimize travel distance
 * while verifying time windows and opening hours
 */
function apply2Opt(dayItinerary, startLocationCoord, dailyStartMinutes, transportMode) {
  if (!dayItinerary || dayItinerary.length <= 2) return dayItinerary;

  let bestRoute = [...dayItinerary];
  let improved = true;
  let iterations = 0;

  const calculateTotalDistance = (route) => {
    let total = 0;
    let curr = startLocationCoord;
    for (const item of route) {
      total += haversineDistanceKm(curr, item.place.coordinates);
      curr = item.place.coordinates;
    }
    return total;
  };

  let bestDistance = calculateTotalDistance(bestRoute);

  while (improved && iterations < 5) {
    improved = false;
    iterations++;

    for (let i = 0; i < bestRoute.length - 1; i++) {
      for (let k = i + 1; k < bestRoute.length; k++) {
        // Swap sub-segment
        const newRoute = [
          ...bestRoute.slice(0, i),
          ...bestRoute.slice(i, k + 1).reverse(),
          ...bestRoute.slice(k + 1)
        ];

        // Verify time feasibility of swapped route
        let valid = true;
        let time = dailyStartMinutes;
        let loc = startLocationCoord;

        for (const item of newRoute) {
          const { travelMinutes } = estimateTravelMinutes(loc, item.place.coordinates, transportMode);
          const arrival = time + travelMinutes;
          if (arrival < item.place.openingMinutes || arrival > item.place.closingMinutes) {
            valid = false;
            break;
          }
          time = arrival + item.place.recommendedVisitDuration;
          loc = item.place.coordinates;
        }

        if (valid) {
          const newDistance = calculateTotalDistance(newRoute);
          if (newDistance < bestDistance - 0.5) {
            bestRoute = newRoute;
            bestDistance = newDistance;
            improved = true;
            break;
          }
        }
      }
      if (improved) break;
    }
  }

  // Recalculate timing for best route
  let currTime = dailyStartMinutes;
  let currLoc = startLocationCoord;

  return bestRoute.map((item) => {
    const { travelMinutes, distanceKm } = estimateTravelMinutes(currLoc, item.place.coordinates, transportMode);
    const arrivalTime = currTime + travelMinutes;
    const visitEnd = arrivalTime + item.place.recommendedVisitDuration;
    currTime = visitEnd;
    currLoc = item.place.coordinates;

    return {
      ...item,
      departureTime: minutesToTime(currTime - visitEnd + arrivalTime - travelMinutes),
      departureMinutes: arrivalTime - travelMinutes,
      travelTimeMinutes: travelMinutes,
      distanceKm,
      arrivalTime: minutesToTime(arrivalTime),
      arrivalMinutes: arrivalTime,
      visitDurationMinutes: item.place.recommendedVisitDuration,
      visitEndTime: minutesToTime(visitEnd),
      visitEndMinutes: visitEnd,
      timeSuitabilityScore: calculateTimeSuitability(item.place, arrivalTime)
    };
  });
}

/* =========================================================================
 * 8. COMPLETE ALGORITHM: DynamicTravelPlanner
 * ========================================================================= */

/**
 * ALGORITHM DynamicTravelPlanner
 *
 * INPUT:
 *   UserPreferences, StartLocation, Destination, TravelDate,
 *   NumberOfDays, DailyStartTime, DailyEndTime, TransportMode
 *
 * OUTPUT:
 *   OptimizedDailyItinerary
 */
async function dynamicTravelPlanner({
  userPreferences = {},
  startLocation = 'City Center',
  destination = 'Goa',
  travelDate = new Date(),
  numberOfDays = 3,
  dailyStartTime = '08:00',
  dailyEndTime = '21:00',
  transportMode = 'car',
  weatherCondition = 'Clear',
  budget = 10000
}) {
  const dailyStartMinutes = timeToMinutes(dailyStartTime);
  const dailyEndMinutes = timeToMinutes(dailyEndTime);
  const daysCount = Math.max(1, Number(numberOfDays) || 1);

  // STEP 1: DISCOVER PLACES (Corridor + Destination)
  const candidatePlaces = await getPlaces(
    destination,
    userPreferences.preferredPlaceType || '',
    40,
    userPreferences,
    startLocation
  );

  // STEP 2: MATCH USER PREFERENCES & SCORE
  const scoredPlaces = candidatePlaces.map((place) => {
    const scores = calculatePlaceScore(place, userPreferences);
    return { ...place, ...scores };
  });

  // STEP 3: REMOVE UNSUITABLE PLACES
  const validPlaces = scoredPlaces.filter((p) => {
    // Keep places with valid coordinates
    if (!p.coordinates || p.coordinates.lat === 0) return false;
    return true;
  });

  // STEP 4: GEOGRAPHIC CLUSTERING FOR MULTI-DAY
  const dayClusters = clusterPlacesByProximity(validPlaces, daysCount);

  const optimizedDailyItinerary = [];
  const startCoord = validPlaces[0]?.coordinates || { lat: 15.2993, lng: 74.1240 };
  let totalTripEstimatedCost = 0;

  // STEP 6, 7 & 8: SCHEDULE EACH DAY
  for (let day = 1; day <= daysCount; day++) {
    const cluster = dayClusters[day - 1] || dayClusters[0] || validPlaces;
    const unvisited = [...cluster];
    const selectedForDay = [];

    let currentLocation = startCoord;
    let currentTime = dailyStartMinutes;

    // Greedy Selection Loop using NextScore Decision Formula
    while (currentTime < dailyEndMinutes && unvisited.length > 0) {
      let bestCandidate = null;
      let bestIdx = -1;
      let highestScore = -Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const place = unvisited[i];
        const evaluation = evaluateNextPlaceCandidate({
          place,
          currentLocation,
          currentTimeMinutes: currentTime,
          selectedPlaces: selectedForDay.map((s) => s.place),
          userPreferences,
          transportMode,
          weatherCondition
        });

        if (evaluation.feasible && evaluation.visitEnd <= dailyEndMinutes) {
          if (evaluation.nextScore > highestScore) {
            highestScore = evaluation.nextScore;
            bestCandidate = { place, evaluation };
            bestIdx = i;
          }
        }
      }

      if (bestCandidate && bestIdx > -1) {
        const { place, evaluation } = bestCandidate;
        selectedForDay.push({
          place,
          departureTime: minutesToTime(currentTime),
          departureMinutes: currentTime,
          travelTimeMinutes: evaluation.travelMinutes,
          distanceKm: evaluation.distanceKm,
          arrivalTime: minutesToTime(evaluation.arrivalTime),
          arrivalMinutes: evaluation.arrivalTime,
          visitDurationMinutes: place.recommendedVisitDuration,
          visitEndTime: minutesToTime(evaluation.visitEnd),
          visitEndMinutes: evaluation.visitEnd,
          timeSuitabilityScore: Math.round(evaluation.scores.T * 100) / 100,
          weatherScore: Math.round(evaluation.scores.W * 100) / 100,
          nextScore: Math.round(evaluation.nextScore * 100) / 100,
          cost: place.entryFee
        });

        totalTripEstimatedCost += place.entryFee;
        currentTime = evaluation.visitEnd;
        currentLocation = place.coordinates;
        unvisited.splice(bestIdx, 1);
      } else {
        // Advance time slightly if no place matches current slot (e.g. lunch/rest window)
        currentTime += 45;
      }
    }

    // STEP 7: APPLY 2-OPT ROUTE OPTIMIZATION
    const optimizedDayStops = apply2Opt(selectedForDay, startCoord, dailyStartMinutes, transportMode);

    // Build structured day object
    const activitiesList = optimizedDayStops.map((stop) => ({
      name: `${stop.place.name} (${formatTime12(stop.arrivalTime)} - ${formatTime12(stop.visitEndTime)})`,
      rawName: stop.place.name,
      placeId: stop.place.placeId,
      category: stop.place.category,
      rating: stop.place.rating,
      cost: stop.place.entryFee,
      travelTimeMinutes: stop.travelTimeMinutes,
      arrivalTime: stop.arrivalTime,
      visitEndTime: stop.visitEndTime,
      timeSuitabilityScore: stop.timeSuitabilityScore,
      weatherScore: stop.weatherScore,
      coordinates: stop.place.coordinates,
      isCustom: false
    }));

    // Build human-friendly plan narrative
    const planNarrative = [
      `**Day ${day} • ${cluster[0]?.category ? cluster[0].category.toUpperCase() : 'EXPLORATION'} CIRCUIT**`,
      `Start at ${formatTime12(dailyStartTime)} from ${startLocation}.`,
      ...optimizedDayStops.map((s, idx) =>
        `${idx + 1}. **${s.place.name}** [${formatTime12(s.arrivalTime)} – ${formatTime12(s.visitEndTime)}] • ${s.distanceKm} km travel (${s.travelTimeMinutes} min) • Time Fit: ${Math.round(s.timeSuitabilityScore * 100)}%`
      ),
      `Return to accommodation by ${formatTime12(optimizedDayStops[optimizedDayStops.length - 1]?.visitEndTime || dailyEndTime)}.`
    ].join('\n\n');

    optimizedDailyItinerary.push({
      day,
      phase: `Day ${day} Circuit`,
      plan: planNarrative,
      activities: activitiesList,
      stops: optimizedDayStops,
      totalDayTravelTimeMinutes: optimizedDayStops.reduce((sum, s) => sum + s.travelTimeMinutes, 0),
      totalDayEntryFees: optimizedDayStops.reduce((sum, s) => sum + s.place.entryFee, 0)
    });
  }

  return {
    success: true,
    destination,
    numberOfDays: daysCount,
    dailyItinerary: optimizedDailyItinerary,
    totalPlacesVisited: optimizedDailyItinerary.reduce((sum, d) => sum + d.activities.length, 0),
    totalEntryFees: totalTripEstimatedCost
  };
}

/* =========================================================================
 * 9. STEP 10: REAL-TIME TRAFFIC RE-OPTIMIZATION ENGINE
 * ========================================================================= */

/**
 * Re-optimizes remaining stops when traffic delays, delays, or missed spots occur
 */
async function reoptimizeItinerary({
  currentItinerary = [],
  currentLocation = null,
  currentTime = '14:00',
  completedPlaceIds = [],
  trafficDelayMinutes = 30,
  destination = 'Goa',
  userPreferences = {},
  transportMode = 'car'
}) {
  const currentMinutes = timeToMinutes(currentTime) + Number(trafficDelayMinutes || 0);

  // Find remaining places across days
  const allCandidatePlaces = await getPlaces(destination);
  const remainingPlaces = allCandidatePlaces.filter((p) => !completedPlaceIds.includes(p.placeId));

  const startCoord = currentLocation || remainingPlaces[0]?.coordinates || { lat: 15.2993, lng: 74.1240 };
  let currLoc = startCoord;
  let currTime = currentMinutes;
  const reoptimizedStops = [];

  const unvisited = [...remainingPlaces];

  while (currTime < timeToMinutes('21:30') && unvisited.length > 0 && reoptimizedStops.length < 4) {
    let best = null;
    let bestIdx = -1;
    let maxScore = -Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const place = unvisited[i];
      const evaluation = evaluateNextPlaceCandidate({
        place,
        currentLocation: currLoc,
        currentTimeMinutes: currTime,
        selectedPlaces: reoptimizedStops.map((s) => s.place),
        userPreferences,
        transportMode,
        weatherCondition: 'Clear'
      });

      if (evaluation.feasible && evaluation.nextScore > maxScore) {
        maxScore = evaluation.nextScore;
        best = { place, evaluation };
        bestIdx = i;
      }
    }

    if (best && bestIdx > -1) {
      reoptimizedStops.push({
        place: best.place,
        arrivalTime: minutesToTime(best.evaluation.arrivalTime),
        visitEndTime: minutesToTime(best.evaluation.visitEnd),
        travelTimeMinutes: best.evaluation.travelMinutes,
        distanceKm: best.evaluation.distanceKm,
        timeSuitabilityScore: Math.round(best.evaluation.scores.T * 100) / 100
      });
      currTime = best.evaluation.visitEnd;
      currLoc = best.place.coordinates;
      unvisited.splice(bestIdx, 1);
    } else {
      currTime += 30;
    }
  }

  return {
    success: true,
    reoptimized: true,
    trafficDelayAppliedMinutes: trafficDelayMinutes,
    adjustedStartTime: minutesToTime(currentMinutes),
    updatedStops: reoptimizedStops.map((s) => ({
      name: `${s.place.name} (${formatTime12(s.arrivalTime)} - ${formatTime12(s.visitEndTime)})`,
      rawName: s.place.name,
      placeId: s.place.placeId,
      category: s.place.category,
      arrivalTime: s.arrivalTime,
      visitEndTime: s.visitEndTime,
      travelTimeMinutes: s.travelTimeMinutes,
      cost: s.place.entryFee
    }))
  };
}

module.exports = {
  dynamicTravelPlanner,
  reoptimizeItinerary,
  calculateTimeSuitability,
  calculateWeatherSuitability,
  calculatePreferenceMatch,
  calculatePlaceScore,
  evaluateNextPlaceCandidate,
  apply2Opt,
  clusterPlacesByProximity,
  getPlaces,
  enrichPlace,
  timeToMinutes,
  minutesToTime,
  formatTime12
};
