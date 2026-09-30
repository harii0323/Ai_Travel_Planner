/**
 * Trip Memory Engine - Non-Repetition, Experience Diversity & Trip-Wide State
 * 
 * Maintains trip-wide memory across Outbound, Destination, and Return journeys:
 * - Prevents visiting the same place twice (placeId, normalized name, coordinates)
 * - Calculates ExperienceSimilarity to avoid monotonous repetition (e.g. 3 waterfalls)
 * - Enforces dynamic category saturation penalties
 * - Records skipped places and reasons for transparent AI explainability
 */

class TripMemory {
  constructor() {
    this.visitedPlaces = new Map(); // normalizedKey -> place details
    this.visitedCategories = new Map(); // category -> count
    this.visitedExperiences = new Map(); // experience tag -> count
    this.skippedPlaces = []; // [{ name, reason, category }]
    this.phaseHistory = {
      outbound: [],
      destination: [],
      return: []
    };
  }

  /**
   * Normalizes place name for robust duplicate detection
   */
  static normalizePlaceName(name) {
    if (!name) return '';
    return String(name)
      .toLowerCase()
      .replace(/^(the|shri|sri|historical|famous|ancient)\s+/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Checks if two geographic points are essentially identical (within 500 meters)
   */
  static isSameLocation(coord1, coord2, thresholdKm = 0.5) {
    if (!coord1 || !coord2) return false;
    const lat1 = coord1.lat || coord1.latitude;
    const lng1 = coord1.lng || coord1.longitude;
    const lat2 = coord2.lat || coord2.latitude;
    const lng2 = coord2.lng || coord2.longitude;
    if (lat1 === undefined || lat2 === undefined) return false;

    const R = 6371; // Earth radius km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    return dist <= thresholdKm;
  }

  /**
   * Checks if candidate place has already been visited in any phase
   */
  hasVisited(candidate) {
    if (!candidate) return false;
    const normKey = TripMemory.normalizePlaceName(candidate.name);

    if (this.visitedPlaces.has(normKey)) {
      return true;
    }

    if (candidate.placeId) {
      for (const visited of this.visitedPlaces.values()) {
        if (visited.placeId && visited.placeId === candidate.placeId) {
          return true;
        }
      }
    }

    const candCoord = candidate.coordinates || candidate.location;
    if (candCoord) {
      for (const visited of this.visitedPlaces.values()) {
        const visCoord = visited.coordinates || visited.location;
        if (visCoord && TripMemory.isSameLocation(candCoord, visCoord)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Records a visited place into trip memory
   */
  recordVisit(poi, phase = 'outbound') {
    if (!poi) return;
    const normKey = TripMemory.normalizePlaceName(poi.name);
    const category = (poi.category || (poi.types && poi.types[0]) || 'attraction').toLowerCase();

    const record = {
      placeId: poi.placeId,
      name: poi.name,
      normKey,
      category,
      location: poi.coordinates || poi.location,
      phase,
      visitedAt: new Date().toISOString()
    };

    this.visitedPlaces.set(normKey, record);

    // Update category frequency
    const currentCatCount = this.visitedCategories.get(category) || 0;
    this.visitedCategories.set(category, currentCatCount + 1);

    // Update specific experience tags
    const tags = [category, ...(poi.tags || []), ...(poi.types || [])];
    tags.forEach(tag => {
      const normTag = tag.toLowerCase().trim();
      const count = this.visitedExperiences.get(normTag) || 0;
      this.visitedExperiences.set(normTag, count + 1);
    });

    if (this.phaseHistory[phase]) {
      this.phaseHistory[phase].push(poi.name);
    }
  }

  /**
   * Records a rejected or skipped place with human-readable rationale
   */
  recordSkipped(candidate, reason) {
    this.skippedPlaces.push({
      name: candidate.name,
      category: candidate.category || 'attraction',
      reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Calculates repetition and experience saturation penalty for a candidate.
   * If place is already visited: returns Infinity (hard constraint failure).
   * If experience type has already been visited multiple times: returns dynamic penalty [0.0 - 0.45].
   */
  calculateRepetitionPenalty(candidate, userPreferences = {}) {
    if (this.hasVisited(candidate)) {
      return {
        penalty: 1000.0, // Hard constraint reject
        isDuplicate: true,
        reason: 'Place has already been included in another phase of your journey.'
      };
    }

    const category = (candidate.category || (candidate.types && candidate.types[0]) || 'attraction').toLowerCase();
    const visitedCount = this.visitedCategories.get(category) || 0;

    // Check specific experience keywords (e.g. 'waterfall', 'fort', 'temple', 'viewpoint')
    let maxSubcategoryCount = visitedCount;
    const candText = `${candidate.name || ''} ${category}`.toLowerCase();
    ['waterfall', 'fort', 'palace', 'temple', 'safari', 'beach', 'museum', 'market', 'lake'].forEach(keyword => {
      if (candText.includes(keyword)) {
        const count = this.visitedExperiences.get(keyword) || 0;
        if (count > maxSubcategoryCount) maxSubcategoryCount = count;
      }
    });

    // Check if user specifically gave very high importance to this category
    const userDim = userPreferences.dimensions || userPreferences;
    const userWeight = userDim[category] || 0.5;

    // If user loves this category (>= 0.90), allow more visits before severe penalty
    const toleranceThreshold = userWeight >= 0.85 ? 3 : (userWeight >= 0.60 ? 2 : 1);

    if (maxSubcategoryCount >= toleranceThreshold) {
      const excess = maxSubcategoryCount - toleranceThreshold + 1;
      const penalty = Math.min(0.40, excess * 0.14);
      return {
        penalty,
        isDuplicate: false,
        reason: `Experience similarity penalty: You already have ${maxSubcategoryCount} ${category} experiences scheduled in your trip. Promoting category diversity.`
      };
    }

    return { penalty: 0.0, isDuplicate: false, reason: null };
  }

  /**
   * Helper returning pure numeric experience penalty for scoring formulas
   */
  calculateExperiencePenalty(candidate, userPreferences = {}) {
    return this.calculateRepetitionPenalty(candidate, userPreferences).penalty || 0;
  }

  /**
   * Returns complete state summary
   */
  getState() {
    return {
      totalVisited: this.visitedPlaces.size,
      visitedPlaces: Array.from(this.visitedPlaces.values()).map(p => p.name),
      categoryCounts: Object.fromEntries(this.visitedCategories.entries()),
      skippedCount: this.skippedPlaces.length,
      skippedSamples: this.skippedPlaces.slice(0, 5)
    };
  }
}

module.exports = { TripMemory };
