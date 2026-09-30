/**
 * Preference Engine - User Profile & Preference Matching
 * 
 * Normalizes user preferences across 17 distinct travel dimensions,
 * computes multi-category affinity scores for POIs, and maintains
 * the trip-wide Preference Coverage Matrix.
 */

// 17 Comprehensive Travel Preference Dimensions
const PREFERENCE_DIMENSIONS = [
  'nature',
  'photography',
  'beach',
  'mountain',
  'waterfall',
  'wildlife',
  'temple',
  'historical',
  'cultural',
  'trekking',
  'adventure',
  'shopping',
  'nightlife',
  'family',
  'relaxation',
  'local_experience',
  'famous_food'
];

// Mapping of place keywords and Google Place types to dimensions
const CATEGORY_TAG_MAP = {
  nature: ['nature', 'park', 'natural_feature', 'forest', 'botanical_garden', 'greenery', 'valley', 'lake', 'river', 'waterfall', 'beach', 'hill'],
  photography: ['viewpoint', 'scenic', 'sunset', 'sunrise', 'panoramic', 'cliff', 'photo', 'vista', 'landmark', 'landscape'],
  beach: ['beach', 'sea', 'coast', 'cove', 'shore', 'island', 'promenade', 'ocean', 'lighthouse'],
  mountain: ['mountain', 'peak', 'hill', 'ghat', 'pass', 'valley', 'plateau', 'summit', 'ridge'],
  waterfall: ['waterfall', 'falls', 'cascade', 'rapids', 'chute'],
  wildlife: ['wildlife', 'safari', 'national_park', 'zoo', 'sanctuary', 'bird_sanctuary', 'tiger_reserve', 'elephant', 'jungle'],
  temple: ['temple', 'mandir', 'hindu_temple', 'place_of_worship', 'ashram', 'ghat', 'church', 'mosque', 'spiritual', 'pilgrimage', 'shrine'],
  historical: ['historical', 'monument', 'fort', 'palace', 'castle', 'ruins', 'heritage', 'unesco', 'archaeological', 'memorial', 'museum'],
  cultural: ['culture', 'museum', 'art_gallery', 'village', 'craft', 'tradition', 'dance', 'kathakali', 'theatre', 'folklore', 'bazaar'],
  trekking: ['trekking', 'hiking', 'trail', 'climb', 'walk', 'path', 'summit', 'camp'],
  adventure: ['adventure', 'rafting', 'paragliding', 'scuba', 'snorkeling', 'kayaking', 'zipline', 'surfing', 'boating', 'safari', 'biking'],
  shopping: ['shopping', 'market', 'bazaar', 'mall', 'handicraft', 'spice_market', 'silk', 'textiles', 'souvenirs'],
  nightlife: ['nightlife', 'club', 'pub', 'bar', 'live_music', 'night_market', 'brewery'],
  family: ['family', 'amusement_park', 'aquarium', 'garden', 'resort', 'picnic', 'children', 'science_center'],
  relaxation: ['relaxation', 'spa', 'ayurveda', 'wellness', 'resort', 'peaceful', 'quiet', 'meditation', 'tea_garden', 'backwaters'],
  local_experience: ['local_experience', 'village_tour', 'houseboat', 'shikara', 'fishing', 'plantation', 'spice_farm', 'ferry', 'pottery', 'homestay'],
  famous_food: ['food', 'restaurant', 'street_food', 'cafe', 'local_cuisine', 'famous_dish', 'bakery', 'market', 'sweet_shop', 'dining']
};

/**
 * Normalizes user input into a unified preference profile with weights between 0.0 and 1.0.
 * Accepts arrays, comma-delimited strings, or explicit weight objects.
 */
function normalizePreferenceProfile(rawPreferences = {}) {
  const profile = {};
  
  // Default base weights
  PREFERENCE_DIMENSIONS.forEach(dim => {
    profile[dim] = 0.20; // Default neutral baseline
  });

  // 1. If explicit weights provided (e.g. { nature: 0.9, beach: 0.8 } or { preferences: { nature: 0.9 } })
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

  // 2. Parse string/array activities (e.g. "nature, photography, beach" or ['nature', 'temple'])
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

  // Assign high weight (0.85 - 0.95) to explicitly selected activities
  rawList.forEach(item => {
    const norm = item.replace(/[^a-z_]/g, '');
    if (profile[norm] !== undefined) {
      profile[norm] = 0.90;
    } else {
      // Fuzzy matching across synonyms
      if (norm.includes('nature') || norm.includes('scenic')) profile.nature = 0.90;
      if (norm.includes('photo')) profile.photography = 0.90;
      if (norm.includes('beach') || norm.includes('coast')) profile.beach = 0.85;
      if (norm.includes('mountain') || norm.includes('hill')) profile.mountain = 0.85;
      if (norm.includes('waterfall') || norm.includes('falls')) profile.waterfall = 0.90;
      if (norm.includes('wild') || norm.includes('safari')) profile.wildlife = 0.90;
      if (norm.includes('temple') || norm.includes('relig') || norm.includes('spiritual')) profile.temple = 0.85;
      if (norm.includes('history') || norm.includes('heritage') || norm.includes('fort') || norm.includes('palace')) profile.historical = 0.85;
      if (norm.includes('cultur') || norm.includes('art') || norm.includes('tradition')) profile.cultural = 0.85;
      if (norm.includes('trek') || norm.includes('hike')) profile.trekking = 0.85;
      if (norm.includes('adventur')) profile.adventure = 0.85;
      if (norm.includes('shop') || norm.includes('bazaar')) profile.shopping = 0.80;
      if (norm.includes('night') || norm.includes('club')) profile.nightlife = 0.80;
      if (norm.includes('family') || norm.includes('kid')) profile.family = 0.85;
      if (norm.includes('relax') || norm.includes('chill') || norm.includes('spa')) profile.relaxation = 0.85;
      if (norm.includes('local') || norm.includes('village')) profile.local_experience = 0.90;
      if (norm.includes('food') || norm.includes('din') || norm.includes('eat') || norm.includes('culinary')) profile.famous_food = 0.90;
    }
  });

  // 3. User travel pace
  const travelPace = (rawPreferences.travelPace || rawPreferences.pace || 'balanced').toLowerCase();
  
  // 4. Food preferences
  const foodPreference = rawPreferences.foodPreference || rawPreferences.foodPreferences || 'local_famous';

  // 5. Places to avoid
  const rawAvoid = rawPreferences.placesToAvoid || rawPreferences.avoid || rawPreferences.avoidance || [];
  const placesToAvoid = Array.isArray(rawAvoid)
    ? rawAvoid.map(s => String(s).trim()).filter(Boolean)
    : (typeof rawAvoid === 'string' ? rawAvoid.split(',').map(s => s.trim()).filter(Boolean) : []);

  return {
    dimensions: profile,
    travelPace, // 'relaxed' (2-3 stops/day), 'balanced' (3-4 stops/day), 'fast' (4-5 stops/day)
    foodPreference,
    placesToAvoid
  };
}

/**
 * Calculates how strongly a candidate POI matches the user's preference profile.
 * Returns { totalMatchScore, dimensionMatches, topMatchedDimensions }.
 */
function calculatePOIPreferenceMatch(poi, preferenceProfile) {
  if (!poi || !preferenceProfile) {
    return { totalMatchScore: 0.5, dimensionMatches: {}, topMatchedDimensions: [] };
  }

  const userDimensions = preferenceProfile.dimensions || preferenceProfile;
  const poiText = `${poi.name || ''} ${poi.category || ''} ${(poi.types || []).join(' ')} ${poi.description || ''} ${(poi.tags || []).join(' ')}`.toLowerCase();

  const dimensionMatches = {};
  let totalWeightedScore = 0;
  let totalUserWeights = 0;

  PREFERENCE_DIMENSIONS.forEach(dim => {
    const userWeight = userDimensions[dim] !== undefined ? userDimensions[dim] : 0.2;
    const keywords = CATEGORY_TAG_MAP[dim] || [];
    
    // Check keyword affinity
    let matchCount = 0;
    keywords.forEach(kw => {
      if (poiText.includes(kw)) matchCount += 1;
    });

    // Special category match
    if (poi.category === dim || (poi.types && poi.types.includes(dim))) {
      matchCount += 3;
    }

    const affinity = Math.min(1.0, matchCount * 0.35);
    dimensionMatches[dim] = affinity;

    // Weight contribution
    totalWeightedScore += affinity * userWeight;
    totalUserWeights += userWeight;
  });

  const normalizedMatch = totalUserWeights > 0 ? (totalWeightedScore / totalUserWeights) : 0.5;
  
  // Identify top matched dimensions
  const topMatchedDimensions = Object.entries(dimensionMatches)
    .filter(([dim, aff]) => aff > 0.4 && (userDimensions[dim] || 0) >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .map(([dim]) => dim);

  return {
    totalMatchScore: Math.round(normalizedMatch * 100) / 100,
    dimensionMatches,
    topMatchedDimensions
  };
}

/**
 * Creates and maintains the Trip-Wide User Preference Coverage Matrix.
 * Identifies fully covered, partially covered, and missing preference categories.
 */
class UserPreferenceCoverageMatrix {
  constructor(preferenceProfile) {
    this.profile = preferenceProfile;
    this.dimensions = preferenceProfile.dimensions || {};
    this.coverageData = {};

    PREFERENCE_DIMENSIONS.forEach(dim => {
      const weight = this.dimensions[dim] || 0.2;
      let importance = 'Low';
      if (weight >= 0.75) importance = 'High';
      else if (weight >= 0.50) importance = 'Medium';

      this.coverageData[dim] = {
        dimension: dim,
        label: formatDimensionLabel(dim),
        userWeight: weight,
        importance,
        points: 0,
        targetPoints: importance === 'High' ? 100 : (importance === 'Medium' ? 60 : 30),
        visitedPlaces: [],
        coveragePercent: 0,
        status: 'Not Available' // 'Covered' | 'Partially Covered' | 'Not Available'
      };
    });
  }

  /**
   * Records a visited or scheduled POI and updates coverage
   */
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
            name: poi.name,
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

  /**
   * Gets list of important preferences that are still missing or under-covered
   */
  getMissingPreferences() {
    return Object.values(this.coverageData)
      .filter(item => (item.importance === 'High' || item.importance === 'Medium') && item.status !== 'Covered')
      .sort((a, b) => b.userWeight - a.userWeight);
  }

  /**
   * Gets simple array of missing dimension name strings
   */
  getMissingDimensions() {
    return this.getMissingPreferences().map(p => p.dimension);
  }

  /**
   * Generates formatted report of the Preference Coverage Matrix
   */
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

  /**
   * Convenience getter returning array of matrix items for UI table
   */
  getMatrix() {
    return this.getMatrixReport().items;
  }

  /**
   * Convenience getter returning summary statistics
   */
  getSummaryStats() {
    return this.getMatrixReport().stats;
  }

  /**
   * Returns human-readable explanations for preference coverage state
   */
  getCoverageExplanations() {
    const explanations = [];
    const missing = this.getMissingPreferences();

    missing.forEach(item => {
      explanations.push(
        `${item.label} (${item.importance} priority): Currently at ${item.coveragePercent}% coverage. Opportunities along your return corridor were actively prioritized to fulfill this experience.`
      );
    });

    const covered = Object.values(this.coverageData).filter(item => item.status === 'Covered');
    if (covered.length > 0) {
      explanations.push(
        `Successfully covered ${covered.length} core preference categories across your onward journey and destination exploration.`
      );
    }

    return explanations;
  }
}

function formatDimensionLabel(dim) {
  const labels = {
    nature: 'Nature & Scenic',
    photography: 'Photography & Vistas',
    beach: 'Beaches & Coastal',
    mountain: 'Mountains & Hills',
    waterfall: 'Waterfalls',
    wildlife: 'Wildlife & Safari',
    temple: 'Temples & Spiritual',
    historical: 'Historical & Heritage',
    cultural: 'Cultural Experiences',
    trekking: 'Trekking & Trails',
    adventure: 'Adventure Activities',
    shopping: 'Local Markets & Shopping',
    nightlife: 'Nightlife & Evening Culture',
    family: 'Family Activities',
    relaxation: 'Relaxation & Wellness',
    local_experience: 'Authentic Local Experiences',
    famous_food: 'Famous Regional Food'
  };
  return labels[dim] || dim.charAt(0).toUpperCase() + dim.slice(1);
}

module.exports = {
  PREFERENCE_DIMENSIONS,
  CATEGORY_TAG_MAP,
  normalizePreferenceProfile,
  calculatePOIPreferenceMatch,
  UserPreferenceCoverageMatrix,
  formatDimensionLabel
};
