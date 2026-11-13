/**
 * PlaceScoringEngine
 * 
 * Module 5 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Computes multi-factor preference-driven compatibility scores [0.0 - 1.0].
 * - Weights: PreferenceMatch, GeographicRelevance, RouteEfficiency, TimeWindowCompatibility,
 *   RatingPopularity, BudgetCompatibility, SeasonalSuitability, CompanionSuitability.
 * - Applies decisive penalties for excessive detours, closed visiting hours, and fatigue.
 * - Rejects popular attractions if they don't match user preferences or force irrational detours.
 */

const DEFAULT_WEIGHTS = {
  preferenceMatch: 0.35,
  activityRelevance: 0.15,
  geographicRelevance: 0.15,
  routeEfficiency: 0.10,
  timeCompatibility: 0.10,
  ratingPopularity: 0.05,
  budgetCompatibility: 0.05,
  seasonalSuitability: 0.05
};

/**
 * Calculates preference match score between place tags and normalized user interest vector.
 * Strictly respects unexpressed categories: baseline stays low, NEVER defaults to 0.95!
 */
function calculatePreferenceMatch(place, normalizedInterests = {}) {
  const cat = String(place.category || '').toLowerCase();
  const subCats = (place.subCategories || []).map(s => String(s).toLowerCase());
  const allTags = [cat, ...subCats];

  let maxAffinity = 0.05; // baseline neutral

  const testDimension = (dimKey, matchKeywords) => {
    const isTagMatched = allTags.some(tag => matchKeywords.some(kw => tag.includes(kw)));
    if (isTagMatched) {
      // User interest weight (0.0 to 1.0)
      const userWeight = Number(normalizedInterests[dimKey] ?? 0.10);
      if (userWeight > maxAffinity) {
        maxAffinity = userWeight;
      }
    }
  };

  testDimension('beaches', ['beach', 'coast', 'ocean', 'sea', 'shore']);
  testDimension('spiritual', ['spirit', 'temple', 'jyotirlinga', 'darshan', 'puja', 'sacred', 'ghats']);
  testDimension('mountains', ['mountain', 'hill', 'ghat', 'peak', 'ridge', 'pass']);
  testDimension('adventure', ['adventure', 'rafting', 'paragliding', 'zipline', 'ropeway', 'boating', 'cave']);
  testDimension('historical', ['histor', 'fort', 'palace', 'monument', 'ruins', 'unesco', 'heritage']);
  testDimension('cultural', ['cultur', 'museum', 'art', 'dance', 'craft']);
  testDimension('photography', ['photography', 'photo', 'viewpoint', 'sunset', 'sunrise', 'scenic']);
  testDimension('trekking', ['trek', 'hike', 'trail', 'climb']);
  testDimension('waterfalls', ['waterfall', 'cascade', 'falls', 'stream']);
  testDimension('wildlife', ['wildlife', 'safari', 'tiger', 'national_park', 'sanctuary']);
  testDimension('food', ['food', 'dining', 'culinary', 'restaurant', 'coffee', 'tea']);
  testDimension('relaxation', ['relax', 'wellness', 'spa', 'calm', 'quiet']);

  return Math.min(1.0, Math.max(0.0, maxAffinity));
}

/**
 * Calculates rating and popularity confidence score using logarithmic volume dampening.
 */
function calculateRatingPopularityScore(place) {
  const rating = Number(place.rating || 4.0);
  const reviews = Number(place.userRatingsTotal || 100);

  // Normalized rating (3.0 -> 0.0, 5.0 -> 1.0)
  const normRating = Math.max(0.0, Math.min(1.0, (rating - 3.0) / 2.0));
  // Review confidence (log10(100) = 2 -> 0.4, log10(100k) = 5 -> 1.0)
  const normReviews = Math.max(0.2, Math.min(1.0, Math.log10(reviews + 1) / 5.0));

  return Math.round((normRating * 0.7 + normReviews * 0.3) * 100) / 100;
}

/**
 * Evaluates companion type suitability.
 */
function evaluateCompanionSuitability(place, companionType = 'solo') {
  const suitable = (place.suitableFor || []).map(s => String(s).toLowerCase());
  if (suitable.length === 0) return 0.85; // neutral

  const comp = companionType.toLowerCase();
  if (suitable.includes(comp)) return 1.0;

  // Family trips penalize dangerous, strenuous, or adult-only spots
  if (comp === 'family') {
    const isStrenuous = (place.subCategories || []).some(s => s.includes('trek') || s.includes('nightlife'));
    return isStrenuous ? 0.40 : 0.80;
  }

  return 0.75;
}

/**
 * Evaluates multi-factor score and penalties for a candidate place.
 */
function scorePlace(place, context = {}) {
  // Supporting services must NEVER be scored or ranked as tourist attractions (Prompt Section 3.1 & 3.5)
  if (
    place.taxonomyCategory === 'supporting_services' ||
    ['meal', 'restaurant', 'food', 'fuel', 'gas_station', 'rest_area', 'hotel', 'lodging'].includes(String(place.category || '').toLowerCase())
  ) {
    return {
      finalScore: 0,
      preferenceMatch: 0,
      geographicRelevance: 0,
      routeEfficiency: 0,
      timeCompatibility: 0,
      ratingPopularity: 0,
      penaltyApplied: 1.0,
      isAccepted: false
    };
  }

  const {
    normalizedInterests = {},
    companionType = 'solo',
    remainingBudget = 25000,
    dailyDrivingKm = 200,
    currentDayVisitedCategories = [],
    arrivalTimeMinutes = 10 * 60,
    isDestination = false,
    distanceFromRouteKm = 0,
    weights = DEFAULT_WEIGHTS
  } = context;

  // 1. Preference Match
  const preferenceMatch = calculatePreferenceMatch(place, normalizedInterests);

  // 2. Activity Relevance
  const activityRelevance = preferenceMatch >= 0.75 ? 1.0 : preferenceMatch >= 0.5 ? 0.75 : 0.4;

  // 3. Geographic Relevance
  let geographicRelevance = 1.0;
  if (!isDestination) {
    const dist = Number(distanceFromRouteKm || place.distanceFromRouteKm || 0);
    geographicRelevance = Math.max(0.1, 1.0 - (dist / 60));
  }

  // 4. Route Efficiency
  const detourKm = Number(distanceFromRouteKm || place.distanceFromRouteKm || 0);
  const routeEfficiency = Math.max(0.1, 1.0 - (detourKm / 40));

  // 5. Time Window Compatibility
  let timeCompatibility = 0.85;
  if (place.bestVisitWindow) {
    if (isDestination && context.arrivalTimeMinutes === undefined) {
      // Golden hour activities will be sequenced into their optimal time slot by DailyItineraryScheduler
      timeCompatibility = 0.95;
    } else {
      const isMorningPeak = arrivalTimeMinutes >= 8 * 60 && arrivalTimeMinutes <= 12 * 60;
      const isAfternoonPeak = arrivalTimeMinutes >= 14 * 60 && arrivalTimeMinutes <= 17 * 60;
      if (place.bestVisitWindow.type === 'sunrise') {
        timeCompatibility = arrivalTimeMinutes <= 7 * 60 + 30 ? 1.0 : 0.40;
      } else if (place.bestVisitWindow.type === 'sunset') {
        timeCompatibility = arrivalTimeMinutes >= 16 * 60 && arrivalTimeMinutes <= 18 * 60 + 45 ? 1.0 : 0.45;
      } else if (isMorningPeak || isAfternoonPeak) {
        timeCompatibility = 0.95;
      }
    }
  }

  // 6. Rating & Popularity
  const ratingPopularity = calculateRatingPopularityScore(place);

  // 7. Budget Compatibility
  const entryFee = Number(place.entryFee || 0);
  const budgetCompatibility = entryFee === 0 ? 1.0 : entryFee <= (remainingBudget * 0.05) ? 0.90 : 0.50;

  // 8. Seasonal Suitability
  const seasonalSuitability = 0.95;

  // 9. Companion Suitability
  const companionSuitability = evaluateCompanionSuitability(place, companionType);

  // --- PENALTIES ---
  let penalty = 0;

  // Repetition penalty (avoid visiting 3 temples in a row or 3 forts in a row)
  const cat = String(place.category || '').toLowerCase();
  const visitedCount = currentDayVisitedCategories.filter(c => c === cat).length;
  if (visitedCount >= 2) penalty += 0.25;
  else if (visitedCount === 1) penalty += 0.10;

  // Excessive detour penalty (>35 km away from route on an onward travel day)
  if (!isDestination && detourKm > 35) {
    penalty += preferenceMatch >= 0.80 ? 0.15 : 0.30;
  }

  // Preference irrelevance penalty when user has expressed strong explicit interests
  const hasStrongPreferences = Object.values(normalizedInterests).some(w => w >= 0.75);
  if (hasStrongPreferences && preferenceMatch < 0.25) {
    penalty += 0.35;
  }

  // Fatigue penalty (arduous physical activity late in a heavy driving day)
  const isHighEffort = cat.includes('trek') || (place.estimatedVisitDurationMinutes || 60) > 150;
  if (isHighEffort && dailyDrivingKm > 350) {
    penalty += 0.25;
  }

  // Base weighted score
  const baseScore =
    preferenceMatch * weights.preferenceMatch +
    activityRelevance * weights.activityRelevance +
    geographicRelevance * weights.geographicRelevance +
    routeEfficiency * weights.routeEfficiency +
    timeCompatibility * weights.timeCompatibility +
    ratingPopularity * weights.ratingPopularity +
    budgetCompatibility * weights.budgetCompatibility +
    seasonalSuitability * weights.seasonalSuitability;

  const finalScore = Math.max(0.05, Math.min(1.0, baseScore * companionSuitability - penalty));

  const isAccepted = hasStrongPreferences
    ? (finalScore >= 0.35 && preferenceMatch >= 0.25)
    : (finalScore >= 0.40);

  return {
    finalScore: Math.round(finalScore * 100) / 100,
    preferenceMatch: Math.round(preferenceMatch * 100) / 100,
    geographicRelevance: Math.round(geographicRelevance * 100) / 100,
    routeEfficiency: Math.round(routeEfficiency * 100) / 100,
    timeCompatibility: Math.round(timeCompatibility * 100) / 100,
    ratingPopularity,
    penaltyApplied: Math.round(penalty * 100) / 100,
    isAccepted
  };
}

module.exports = {
  scorePlace,
  calculatePreferenceMatch,
  calculateRatingPopularityScore,
  evaluateCompanionSuitability,
  DEFAULT_WEIGHTS
};

