/**
 * Preference Engine - User Profile & Preference Matching
 * 
 * Implements Phase 3: User Preference Intelligence Engine:
 * - 30 Comprehensive Travel Preference Dimensions matching the national taxonomy
 * - Negative preference ingestion and penalty enforcement
 * - Semantic similarity and dense embedding generation with fallback
 * - Multi-category interest balancing (prevents mono-category bias)
 * - Traveler-type suitability modulation (Family, Friends, Couple, Solo)
 * - Trip-wide Preference Coverage Matrix with gap analysis and explanations
 */

const {
  SEMANTIC_DIMENSIONS,
  generateSemanticEmbedding,
  calculateCosineSimilarity
} = require('./spatiotemporalUtils');

// 30 Comprehensive Travel Preference Dimensions
const PREFERENCE_DIMENSIONS = [
  'nature',
  'waterfalls',
  'mountains',
  'hill_stations',
  'sunrise_viewpoints',
  'sunset_viewpoints',
  'lakes',
  'reservoirs',
  'dams',
  'forests',
  'wildlife',
  'beaches',
  'temples',
  'spiritual',
  'historical',
  'forts',
  'palaces',
  'photography',
  'trekking',
  'adventure',
  'camping',
  'scenic_roads',
  'local_culture',
  'culinary',
  'relaxation',
  'caves',
  'architecture',
  'shopping',
  'nightlife',
  'family'
];

// Mapping of place keywords and Google Place types to dimensions
const CATEGORY_TAG_MAP = {
  nature: ['nature', 'park', 'natural_feature', 'forest', 'botanical_garden', 'greenery', 'valley', 'landscape', 'flora', 'scenic_landscape'],
  waterfalls: ['waterfall', 'falls', 'cascade', 'rapids', 'chute', 'stream', 'water_cascades'],
  mountains: ['mountain', 'peak', 'hill', 'ghat', 'pass', 'valley', 'plateau', 'summit', 'ridge', 'highland'],
  hill_stations: ['hill_station', 'hillstation', 'mist', 'tea_estate', 'coffee_plantation', 'high_altitude'],
  sunrise_viewpoints: ['sunrise', 'morning_view', 'dawn', 'first_light', 'sunrise_point', 'east_ridge'],
  sunset_viewpoints: ['sunset', 'dusk', 'evening_vista', 'sunset_point', 'west_ridge', 'coastal_sunset'],
  lakes: ['lake', 'boating', 'backwater', 'lagoon', 'water_body', 'kayaking_lake'],
  reservoirs: ['reservoir', 'barrage', 'catchment', 'water_storage'],
  dams: ['dam', 'hydroelectric', 'spillway', 'reservoir_wall', 'water_project'],
  forests: ['forest', 'woods', 'jungle', 'canopy', 'timber', 'reserve_forest', 'shola_forest'],
  wildlife: ['wildlife', 'safari', 'national_park', 'zoo', 'sanctuary', 'bird_sanctuary', 'tiger_reserve', 'elephant', 'jungle'],
  beaches: ['beach', 'sea', 'coast', 'cove', 'shore', 'island', 'promenade', 'ocean', 'waves'],
  temples: ['temple', 'mandir', 'hindu_temple', 'place_of_worship', 'shrine', 'jyotirlinga', 'shakti_peetham', 'darshan'],
  spiritual: ['spiritual', 'pilgrimage', 'ashram', 'ghat', 'sacred_river', 'meditation', 'holy', 'divine'],
  historical: ['historical', 'monument', 'ancient_structure', 'ruins', 'heritage', 'unesco', 'archaeological', 'memorial'],
  forts: ['fort', 'fortress', 'bastion', 'citadel', 'rampart', 'buruj', 'defense_post'],
  palaces: ['palace', 'mahal', 'royal_residence', 'monolithic_palace', 'castle'],
  photography: ['viewpoint', 'scenic', 'panoramic', 'cliff', 'photo', 'vista', 'landmark', 'landscape', 'vistas'],
  trekking: ['trekking', 'hiking', 'trail', 'climb', 'walk', 'path', 'summit', 'nature_trail'],
  adventure: ['adventure', 'rafting', 'paragliding', 'scuba', 'snorkeling', 'kayaking', 'zipline', 'surfing', 'boating', 'sports'],
  camping: ['camping', 'camp', 'tent', 'bonfire', 'stargazing', 'wilderness_camp'],
  scenic_roads: ['scenic_road', 'ghat_road', 'hairpin_bends', 'coastal_drive', 'scenic_highway', 'mountain_pass'],
  local_culture: ['culture', 'museum', 'art_gallery', 'village', 'craft', 'tradition', 'dance', 'folklore', 'bazaar', 'tribal_culture'],
  culinary: ['food', 'restaurant', 'street_food', 'cafe', 'local_cuisine', 'famous_dish', 'bakery', 'market', 'sweet_shop', 'dining', 'culinary'],
  relaxation: ['relaxation', 'spa', 'ayurveda', 'wellness', 'resort', 'peaceful', 'quiet', 'meditation', 'tea_garden', 'serene'],
  caves: ['cave', 'cavern', 'stalactite', 'limestone', 'grotto', 'underground'],
  architecture: ['architecture', 'carving', 'sculpture', 'monolithic', 'gopuram', 'stone_craft', 'monolithic_architecture'],
  shopping: ['shopping', 'market', 'bazaar', 'mall', 'handicraft', 'spice_market', 'silk', 'textiles', 'souvenirs'],
  nightlife: ['nightlife', 'club', 'pub', 'bar', 'live_music', 'night_market', 'brewery'],
  family: ['family', 'amusement_park', 'aquarium', 'garden', 'resort', 'picnic', 'children', 'science_center', 'safe_outdoors']
};

/**
 * Normalizes user input into a calibrated 30-dimensional preference profile with negative preference handling.
 */
function normalizePreferenceProfile(rawPreferences = {}) {
  const profile = {};
  
  // Default base baseline
  PREFERENCE_DIMENSIONS.forEach(dim => {
    profile[dim] = 0.15;
  });

  // 1. If explicit weights provided
  if (typeof rawPreferences === 'object' && !Array.isArray(rawPreferences)) {
    const sourceWeights = (rawPreferences.preferences && typeof rawPreferences.preferences === 'object' && !Array.isArray(rawPreferences.preferences))
      ? rawPreferences.preferences
      : (rawPreferences.weights || rawPreferences.dimensions || rawPreferences);

    PREFERENCE_DIMENSIONS.forEach(dim => {
      if (sourceWeights && sourceWeights[dim] !== undefined) {
        const val = parseFloat(sourceWeights[dim]);
        if (!isNaN(val)) {
          profile[dim] = Math.max(0.0, Math.min(1.0, val));
        }
      }
    });
  }

  // 2. Parse string/array activities
  let rawList = [];
  if (typeof rawPreferences === 'string') {
    rawList = rawPreferences.split(',').map(s => s.trim().toLowerCase());
  } else if (Array.isArray(rawPreferences)) {
    rawList = rawPreferences.map(s => String(s).trim().toLowerCase());
  } else if (rawPreferences.activities) {
    if (typeof rawPreferences.activities === 'string') {
      rawList = rawPreferences.activities.split(',').map(s => s.trim().toLowerCase());
    } else if (Array.isArray(rawPreferences.activities)) {
      rawList = rawPreferences.activities.map(s => String(s).trim().toLowerCase());
    }
  }

  // Parse preferred_activities, placeType, etc.
  const extraActivities = rawPreferences.preferred_activities || rawPreferences.preferredActivities || rawPreferences.placeType || [];
  if (Array.isArray(extraActivities)) {
    extraActivities.forEach(a => rawList.push(String(a).trim().toLowerCase()));
  } else if (typeof extraActivities === 'string') {
    extraActivities.split(',').forEach(a => rawList.push(a.trim().toLowerCase()));
  }

  // Assign calibrated weights (0.85 - 0.95) to explicitly expressed activities
  rawList.forEach(item => {
    const norm = item.replace(/[^a-z_]/g, '');
    if (profile[norm] !== undefined) {
      profile[norm] = 0.90;
    }

    // Synonym keyword matching
    if (norm.includes('nature') || norm.includes('scenic') || norm.includes('landscape')) profile.nature = 0.90;
    if (norm.includes('waterfall') || norm.includes('falls') || norm.includes('cascade')) profile.waterfalls = 0.95;
    if (norm.includes('mountain') || norm.includes('hill') || norm.includes('ghat')) profile.mountains = 0.90;
    if (norm.includes('hillstation') || norm.includes('hill_station')) profile.hill_stations = 0.90;
    if (norm.includes('sunrise')) { profile.sunrise_viewpoints = 0.95; profile.photography = 0.90; }
    if (norm.includes('sunset')) { profile.sunset_viewpoints = 0.95; profile.photography = 0.90; }
    if (norm.includes('lake') || norm.includes('lagoon')) profile.lakes = 0.85;
    if (norm.includes('reservoir')) profile.reservoirs = 0.85;
    if (norm.includes('dam')) profile.dams = 0.85;
    if (norm.includes('forest') || norm.includes('woods')) profile.forests = 0.90;
    if (norm.includes('wild') || norm.includes('safari') || norm.includes('tiger')) profile.wildlife = 0.90;
    if (norm.includes('beach') || norm.includes('coast') || norm.includes('sea')) profile.beaches = 0.90;
    if (norm.includes('temple') || norm.includes('mandir') || norm.includes('darshan')) profile.temples = 0.92;
    if (norm.includes('spiritual') || norm.includes('pilgrim') || norm.includes('ashram')) profile.spiritual = 0.90;
    if (norm.includes('history') || norm.includes('heritage') || norm.includes('ancient') || norm.includes('unesco')) profile.historical = 0.88;
    if (norm.includes('fort') || norm.includes('bastion')) profile.forts = 0.90;
    if (norm.includes('palace') || norm.includes('mahal')) profile.palaces = 0.90;
    if (norm.includes('photo') || norm.includes('camera') || norm.includes('viewpoint') || norm.includes('vista')) profile.photography = 0.90;
    if (norm.includes('trek') || norm.includes('hike') || norm.includes('trail')) profile.trekking = 0.90;
    if (norm.includes('adventure') || norm.includes('raft') || norm.includes('zipline') || norm.includes('kayak')) profile.adventure = 0.90;
    if (norm.includes('camp') || norm.includes('tent')) profile.camping = 0.85;
    if (norm.includes('road') || norm.includes('drive')) profile.scenic_roads = 0.85;
    if (norm.includes('culture') || norm.includes('tradition') || norm.includes('museum') || norm.includes('art')) profile.local_culture = 0.85;
    if (norm.includes('food') || norm.includes('din') || norm.includes('eat') || norm.includes('culinary')) profile.culinary = 0.90;
    if (norm.includes('relax') || norm.includes('chill') || norm.includes('spa') || norm.includes('peace')) profile.relaxation = 0.88;
    if (norm.includes('cave')) profile.caves = 0.85;
    if (norm.includes('architect') || norm.includes('sculpture')) profile.architecture = 0.85;
    if (norm.includes('shop') || norm.includes('bazaar') || norm.includes('market')) profile.shopping = 0.80;
    if (norm.includes('night') || norm.includes('club') || norm.includes('party')) profile.nightlife = 0.80;
    if (norm.includes('family') || norm.includes('kid')) profile.family = 0.85;
  });

  // 3. Traveler-type suitability modulation
  const travelerType = String(
    rawPreferences.travelerType || rawPreferences.travelCompanionType || rawPreferences.companionType || 'solo'
  ).toLowerCase();

  if (travelerType.includes('family')) {
    profile.family = Math.max(profile.family, 0.90);
    profile.relaxation = Math.min(1.0, profile.relaxation + 0.15);
    profile.nature = Math.min(1.0, profile.nature + 0.10);
    profile.adventure = Math.max(0.1, profile.adventure * 0.70); // reduce intense adventure for family
    profile.nightlife = Math.max(0.05, profile.nightlife * 0.40);
  } else if (travelerType.includes('friend')) {
    profile.adventure = Math.min(1.0, profile.adventure + 0.20);
    profile.trekking = Math.min(1.0, profile.trekking + 0.20);
    profile.photography = Math.min(1.0, profile.photography + 0.15);
    profile.nightlife = Math.min(1.0, profile.nightlife + 0.20);
  } else if (travelerType.includes('couple')) {
    profile.sunset_viewpoints = Math.min(1.0, profile.sunset_viewpoints + 0.25);
    profile.photography = Math.min(1.0, profile.photography + 0.20);
    profile.relaxation = Math.min(1.0, profile.relaxation + 0.25);
    profile.scenic_roads = Math.min(1.0, profile.scenic_roads + 0.20);
  }

  // 4. Negative Preferences & Places to Avoid
  const rawAvoid = [
    ...(Array.isArray(rawPreferences.placesToAvoid) ? rawPreferences.placesToAvoid : []),
    ...(Array.isArray(rawPreferences.avoid) ? rawPreferences.avoid : []),
    ...(Array.isArray(rawPreferences.negativePreferences) ? rawPreferences.negativePreferences : [])
  ];
  if (typeof rawPreferences.placesToAvoid === 'string') rawPreferences.placesToAvoid.split(',').forEach(s => rawAvoid.push(s.trim()));
  if (typeof rawPreferences.avoid === 'string') rawPreferences.avoid.split(',').forEach(s => rawAvoid.push(s.trim()));
  if (typeof rawPreferences.negativePreferences === 'string') rawPreferences.negativePreferences.split(',').forEach(s => rawAvoid.push(s.trim()));

  const placesToAvoid = [];
  const penalizedDimensions = new Set();

  rawAvoid.forEach(item => {
    const clean = String(item).toLowerCase().trim();
    if (!clean) return;
    placesToAvoid.push(clean);

    // Negative dimension matching (e.g. "no temples", "avoid nightlife")
    if (clean.includes('temple') || clean.includes('religious') || clean.includes('spiritual')) {
      profile.temples = 0.0;
      profile.spiritual = 0.0;
      penalizedDimensions.add('temples');
      penalizedDimensions.add('spiritual');
    }
    if (clean.includes('nightlife') || clean.includes('club') || clean.includes('party')) {
      profile.nightlife = 0.0;
      penalizedDimensions.add('nightlife');
    }
    if (clean.includes('trek') || clean.includes('hike') || clean.includes('long walk')) {
      profile.trekking = 0.0;
      penalizedDimensions.add('trekking');
    }
    if (clean.includes('adventure') || clean.includes('extreme')) {
      profile.adventure = 0.0;
      penalizedDimensions.add('adventure');
    }
    if (clean.includes('museum') || clean.includes('art gallery')) {
      profile.local_culture = Math.max(0.1, profile.local_culture * 0.5);
    }
  });

  // 5. Generate Dense 30-D Semantic Vector
  const textSummary = Object.entries(profile)
    .filter(([_, w]) => w >= 0.5)
    .map(([dim, w]) => `${dim} (weight: ${w})`)
    .join(' ');
  const semanticEmbedding = generateSemanticEmbedding(textSummary);

  return {
    dimensions: profile,
    semanticEmbedding,
    travelerType,
    travelPace: (rawPreferences.travelPace || rawPreferences.pace || 'balanced').toLowerCase(),
    foodPreference: rawPreferences.foodPreference || 'local_famous',
    placesToAvoid,
    penalizedDimensions: Array.from(penalizedDimensions)
  };
}

/**
 * Calculates how strongly a candidate POI matches the user's preference profile.
 * Incorporates negative preferences and generates explainable matching details.
 */
function calculatePOIPreferenceMatch(poi, preferenceProfile) {
  if (!poi || !preferenceProfile) {
    return {
      totalMatchScore: 0.5,
      dimensionMatches: {},
      topMatchedDimensions: [],
      explanation: 'General tourist attraction matching standard travel interests.'
    };
  }

  const userDimensions = preferenceProfile.dimensions || preferenceProfile;
  const categoriesList = Array.isArray(poi.categories) ? poi.categories : (poi.category ? [poi.category] : []);
  const poiText = `${poi.name || ''} ${poi.city || ''} ${categoriesList.join(' ')} ${(poi.types || []).join(' ')} ${poi.description || ''} ${(poi.tags || []).join(' ')} ${(poi.subCategories || []).join(' ')}`.toLowerCase();

  // Negative preference check
  const placesToAvoid = preferenceProfile.placesToAvoid || [];
  for (const avoid of placesToAvoid) {
    if (poiText.includes(avoid.toLowerCase())) {
      return {
        totalMatchScore: 0.05,
        dimensionMatches: {},
        topMatchedDimensions: [],
        isAvoided: true,
        explanation: `Excluded because it matches avoided criterion: "${avoid}".`
      };
    }
  }

  const dimensionMatches = {};
  let totalWeightedScore = 0;
  let totalUserWeights = 0;

  PREFERENCE_DIMENSIONS.forEach(dim => {
    const userWeight = userDimensions[dim] !== undefined ? userDimensions[dim] : 0.15;
    const keywords = CATEGORY_TAG_MAP[dim] || [];
    
    let matchCount = 0;
    keywords.forEach(kw => {
      if (poiText.includes(kw)) matchCount += 1;
    });

    if (categoriesList.includes(dim) || poi.category === dim || (poi.types && poi.types.includes(dim)) || (poi.subCategories && poi.subCategories.includes(dim))) {
      matchCount += 3;
    }

    const affinity = Math.min(1.0, matchCount * 0.35);
    dimensionMatches[dim] = affinity;

    totalWeightedScore += affinity * userWeight;
    totalUserWeights += Math.max(0.1, userWeight);
  });

  let normalizedMatch = totalUserWeights > 0 ? (totalWeightedScore / totalUserWeights) : 0.5;

  // Cosine similarity boost if dense embeddings are present
  if (poi.semanticEmbedding && preferenceProfile.semanticEmbedding) {
    const cosSim = calculateCosineSimilarity(preferenceProfile.semanticEmbedding, poi.semanticEmbedding);
    normalizedMatch = normalizedMatch * 0.65 + cosSim * 0.35;
  }

  normalizedMatch = Math.max(0.05, Math.min(1.0, Math.round(normalizedMatch * 100) / 100));

  // Identify top matched dimensions
  const topMatchedDimensions = Object.entries(dimensionMatches)
    .filter(([dim, aff]) => aff >= 0.35 && (userDimensions[dim] || 0) >= 0.4)
    .sort((a, b) => b[1] - a[1])
    .map(([dim]) => dim);

  // Generate transparent AI match explanation
  const topLabels = topMatchedDimensions.slice(0, 3).map(formatDimensionLabel);
  const explanation = topLabels.length > 0
    ? `Matches your travel interests in ${topLabels.join(', ')} (${Math.round(normalizedMatch * 100)}% match score).`
    : `Offers scenic and cultural value compatible with your overall route (${Math.round(normalizedMatch * 100)}% match score).`;

  return {
    totalMatchScore: normalizedMatch,
    dimensionMatches,
    topMatchedDimensions,
    explanation
  };
}

/**
 * Trip-Wide User Preference Coverage Matrix.
 */
class UserPreferenceCoverageMatrix {
  constructor(preferenceProfile = {}) {
    this.profile = preferenceProfile;
    this.dimensions = preferenceProfile.dimensions || {};
    this.coverageData = {};

    PREFERENCE_DIMENSIONS.forEach(dim => {
      const weight = this.dimensions[dim] !== undefined ? this.dimensions[dim] : 0.15;
      let importance = 'Low';
      if (weight >= 0.75) importance = 'High';
      else if (weight >= 0.45) importance = 'Medium';

      this.coverageData[dim] = {
        dimension: dim,
        label: formatDimensionLabel(dim),
        userWeight: Math.round(weight * 100) / 100,
        importance,
        points: 0,
        targetPoints: importance === 'High' ? 100 : (importance === 'Medium' ? 60 : 30),
        visitedPlaces: [],
        coveragePercent: 0,
        status: 'Not Available'
      };
    });
  }

  recordPlace(poi, phase = 'Destination') {
    if (!poi) return;
    const matchResult = calculatePOIPreferenceMatch(poi, this.profile);

    Object.entries(matchResult.dimensionMatches).forEach(([dim, affinity]) => {
      if (affinity >= 0.35) {
        const item = this.coverageData[dim];
        if (item) {
          const addedPoints = Math.round(affinity * 50);
          item.points += addedPoints;
          item.visitedPlaces.push({
            name: poi.name || poi.placeName,
            phase,
            affinity: Math.round(affinity * 100)
          });
          
          item.coveragePercent = Math.min(100, Math.round((item.points / item.targetPoints) * 100));
          if (item.coveragePercent >= 75) {
            item.status = 'Covered';
          } else if (item.coveragePercent >= 30) {
            item.status = 'Partially Covered';
          } else {
            item.status = 'Not Available';
          }
        }
      }
    });
  }

  getMissingPreferences() {
    return Object.values(this.coverageData)
      .filter(item => (item.importance === 'High' || item.importance === 'Medium') && item.status !== 'Covered')
      .sort((a, b) => b.userWeight - a.userWeight);
  }

  getMissingDimensions() {
    return this.getMissingPreferences().map(p => p.dimension);
  }

  getMatrixReport() {
    const list = Object.values(this.coverageData).map(item => ({
      preference: item.label,
      dimension: item.dimension,
      importance: item.importance,
      userWeight: item.userWeight,
      covered: item.status === 'Covered' ? 'Yes' : (item.status === 'Partially Covered' ? 'Partial' : 'No'),
      coveragePercent: `${item.coveragePercent}%`,
      visitedCount: item.visitedPlaces.length,
      contributingPlaces: item.visitedPlaces.map(p => `${p.name} (${p.phase})`).slice(0, 3)
    }));

    const coveredCount = list.filter(i => i.covered === 'Yes').length;
    const partialCount = list.filter(i => i.covered === 'Partial').length;
    const missingCount = list.filter(i => i.importance === 'High' && i.covered === 'No').length;

    return {
      items: list,
      stats: {
        totalTracked: list.length,
        fullyCovered: coveredCount,
        partiallyCovered: partialCount,
        highPriorityMissing: missingCount
      }
    };
  }

  getMatrix() {
    return this.getMatrixReport().items;
  }

  getSummaryStats() {
    return this.getMatrixReport().stats;
  }

  getCoverageExplanations() {
    const explanations = [];
    const missing = this.getMissingPreferences();

    missing.forEach(item => {
      explanations.push(
        `${item.label} (${item.importance} priority): Currently at ${item.coveragePercent}% coverage. Opportunities along your route were actively balanced to fulfill this experience.`
      );
    });

    const covered = Object.values(this.coverageData).filter(item => item.status === 'Covered');
    if (covered.length > 0) {
      explanations.push(
        `Successfully covered ${covered.length} core travel preference categories across your itinerary.`
      );
    }

    return explanations;
  }
}

function formatDimensionLabel(dim) {
  const labels = {
    nature: 'Nature & Landscapes',
    waterfalls: 'Waterfalls & Cascades',
    mountains: 'Mountains & Ridges',
    hill_stations: 'Hill Stations & High Altitude',
    sunrise_viewpoints: 'Sunrise Viewpoints',
    sunset_viewpoints: 'Sunset Viewpoints',
    lakes: 'Lakes & Backwaters',
    reservoirs: 'Reservoirs & Catchments',
    dams: 'Dams & Hydro Projects',
    forests: 'Forests & Woodland Trails',
    wildlife: 'Wildlife & Safari Sanctuaries',
    beaches: 'Beaches & Coastal Shores',
    temples: 'Temples & Sacred Shrines',
    spiritual: 'Spiritual Destinations & Ashrams',
    historical: 'Historical Structures & UNESCO Sites',
    forts: 'Forts & Ancient Citadels',
    palaces: 'Palaces & Royal Heritage',
    photography: 'Photography & Panoramic Vistas',
    trekking: 'Trekking & Hiking Trails',
    adventure: 'Adventure & Dynamic Outdoor Activities',
    camping: 'Camping & Wilderness Stays',
    scenic_roads: 'Scenic Highway & Ghat Corridors',
    local_culture: 'Local Culture & Folklore Museums',
    culinary: 'Authentic Regional Food & Dining',
    relaxation: 'Relaxation & Wellness Retreats',
    caves: 'Caves & Geological Formations',
    architecture: 'Ancient Architecture & Stone Sculptures',
    shopping: 'Traditional Bazaars & Shopping',
    nightlife: 'Nightlife & Evening Entertainment',
    family: 'Family & Multi-Generational Friendly'
  };
  return labels[dim] || dim.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

module.exports = {
  PREFERENCE_DIMENSIONS,
  CATEGORY_TAG_MAP,
  normalizePreferenceProfile,
  calculatePOIPreferenceMatch,
  UserPreferenceCoverageMatrix,
  formatDimensionLabel
};
