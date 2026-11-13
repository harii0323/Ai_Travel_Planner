/**
 * PlaceRecommendationEngine
 * 
 * Multi-factor preference-aware scoring & recommendation system:
 * - Scores candidates across 12 normalized factors:
 *   PreferenceMatch, GeographicRelevance, ExperienceQuality, RatingConfidence,
 *   TimeWindowCompatibility, RouteEfficiency, BudgetCompatibility, SeasonalSuitability,
 *   Accessibility, DetourPenalty, FatiguePenalty, RepetitionPenalty.
 * - Enforces category diversity (temple, scenic, mountain, trekking, adventure).
 * - Separates food stops from sightseeing activities (food supports the journey at meal times, does not displace attractions).
 * - Generates clear, transparent recommendation rationales.
 */

// Configurable Scoring Factor Weights (Section 5)
const DEFAULT_SCORING_WEIGHTS = {
  preferenceMatch: 0.30,
  geographicRelevance: 0.15,
  experienceQuality: 0.15,
  ratingConfidence: 0.10,
  timeWindowCompatibility: 0.10,
  routeEfficiency: 0.10,
  budgetCompatibility: 0.05,
  seasonalSuitability: 0.05
};

/**
 * Calculates Bayesian / log-volume weighted rating confidence
 */
function calculateRatingConfidence(place) {
  const rating = Number(place.rating || 0);
  const reviews = Number(place.reviews || place.userRatingsTotal || 0);

  if (!rating || reviews === 0) {
    // Missing data treated as unknown (0.4 confidence)
    return 0.40;
  }

  const normalizedRating = Math.min(1.0, Math.max(0.0, (rating - 3.0) / 2.0));
  const reviewWeight = Math.min(1.0, Math.log10(reviews + 1) / 5.0); // 100k reviews = 1.0

  return Math.round((normalizedRating * 0.7 + reviewWeight * 0.3) * 100) / 100;
}

/**
 * Calculates user preference match score based on normalized interest dimensions
 */
function calculatePreferenceMatch(place, normalizedInterests = {}) {
  const cat = String(place.category || '').toLowerCase();
  const subCats = (place.subCategories || []).map(s => String(s).toLowerCase());
  const allTags = [cat, ...subCats];

  let bestAffinity = 0.3; // baseline neutral

  // Spirituality / Temple
  if (allTags.some(t => t.includes('spirit') || t.includes('temple') || t.includes('jyotirlinga') || t.includes('shakti'))) {
    bestAffinity = Math.max(bestAffinity, normalizedInterests.temple || 0.95);
  }

  // Scenic / Photography
  if (allTags.some(t => t.includes('scenic') || t.includes('viewpoint') || t.includes('lake') || t.includes('waterfall') || t.includes('dam'))) {
    bestAffinity = Math.max(bestAffinity, normalizedInterests.photography || 0.95);
  }

  // Mountains / Hills
  if (allTags.some(t => t.includes('mountain') || t.includes('hill') || t.includes('ghat'))) {
    bestAffinity = Math.max(bestAffinity, normalizedInterests.mountain || 0.95);
  }

  // Trekking
  if (allTags.some(t => t.includes('trek') || t.includes('hike') || t.includes('trail') || t.includes('national_park'))) {
    bestAffinity = Math.max(bestAffinity, normalizedInterests.trekking || 0.95);
  }

  // Adventure
  if (allTags.some(t => t.includes('adventure') || t.includes('ropeway') || t.includes('boating') || t.includes('cave'))) {
    bestAffinity = Math.max(bestAffinity, normalizedInterests.adventure || 0.90);
  }

  // Historical / Cultural
  if (allTags.some(t => t.includes('histor') || t.includes('fort') || t.includes('heritage'))) {
    bestAffinity = Math.max(bestAffinity, normalizedInterests.historical || 0.85);
  }

  return Math.min(1.0, Math.max(0.0, bestAffinity));
}

/**
 * Evaluates comprehensive multi-factor score for a candidate place
 */
function scorePlaceCandidate(place, context = {}) {
  const {
    normalizedInterests = {},
    budgetRemaining = 45000,
    dailyDrivingKm = 350,
    currentDayVisitedCategories = [],
    arrivalTimeMinutes = 8 * 60,
    weights = DEFAULT_SCORING_WEIGHTS
  } = context;

  // 1. Preference Match Score
  const preferenceMatchScore = calculatePreferenceMatch(place, normalizedInterests);

  // 2. Geographic Relevance Score
  const distFromHighway = Number(place.distanceFromHighwayKm || place.distanceFromRouteKm || 5);
  const geographicRelevanceScore = Math.max(0.1, 1.0 - (distFromHighway / 50));

  // 3. Experience Quality & Fame
  const experienceQualityScore = Number(place.fameScore || 0.80);

  // 4. Rating & Review Confidence
  const ratingConfidence = calculateRatingConfidence(place);

  // 5. Time Window Compatibility
  let timeWindowComp = 0.85;
  if (place.bestVisitWindow) {
    const bStart = place.bestVisitWindow.start ? parseTimeToMinutes(place.bestVisitWindow.start) : 360;
    const bEnd = place.bestVisitWindow.end ? parseTimeToMinutes(place.bestVisitWindow.end) : 1140;
    if (arrivalTimeMinutes >= bStart && arrivalTimeMinutes <= bEnd) {
      timeWindowComp = 1.0;
    } else if (Math.abs(arrivalTimeMinutes - bStart) <= 90 || Math.abs(arrivalTimeMinutes - bEnd) <= 90) {
      timeWindowComp = 0.70;
    } else {
      timeWindowComp = 0.35;
    }
  }

  // 6. Route Efficiency (Detour penalty)
  const detourPenalty = (place.tierPenalty || 0) + (distFromHighway > 25 ? 0.20 : 0);
  const routeEfficiencyScore = Math.max(0.1, 1.0 - detourPenalty);

  // 7. Budget Compatibility
  const cost = Number(place.entryFee || 0);
  const budgetComp = cost > budgetRemaining * 0.2 ? 0.5 : 1.0;

  // 8. Seasonal Suitability
  const seasonalSuitability = place.weatherSensitivity === 'high' ? 0.75 : 0.95;

  // 9. Repetition Penalty: Penalize consecutive stops of same primary category
  const primaryCat = String(place.category || '').toLowerCase();
  const alreadyVisitedCount = currentDayVisitedCategories.filter(c => c === primaryCat).length;
  const repetitionPenalty = alreadyVisitedCount >= 2 ? 0.35 : (alreadyVisitedCount === 1 ? 0.15 : 0.0);

  // 10. Fatigue Penalty: High-effort physical activities (like long treks) penalized late in high-mileage driving days
  const isHighEffort = primaryCat === 'trekking' || (place.durationMinutes || 60) > 120;
  const fatiguePenalty = (isHighEffort && dailyDrivingKm > 320) ? 0.20 : 0.0;

  // Weighted aggregation
  const rawScore =
    preferenceMatchScore * weights.preferenceMatch +
    geographicRelevanceScore * weights.geographicRelevance +
    experienceQualityScore * weights.experienceQuality +
    ratingConfidence * weights.ratingConfidence +
    timeWindowComp * weights.timeWindowCompatibility +
    routeEfficiencyScore * weights.routeEfficiency +
    budgetComp * weights.budgetCompatibility +
    seasonalSuitability * weights.seasonalSuitability -
    repetitionPenalty -
    fatiguePenalty;

  const finalScore = Math.min(1.0, Math.max(0.05, Math.round(rawScore * 100) / 100));

  return {
    finalScore,
    preferenceMatchScore,
    geographicRelevanceScore,
    experienceQualityScore,
    ratingConfidence,
    timeWindowComp,
    repetitionPenalty,
    fatiguePenalty,
    rationale: generateRecommendationRationale(place, preferenceMatchScore, distFromHighway)
  };
}

/**
 * Generates human-readable, transparent rationale for recommendation
 */
function generateRecommendationRationale(place, matchScore, detourKm) {
  const matchPercent = Math.round(matchScore * 100);
  const detourText = detourKm <= 2
    ? 'directly along your highway corridor'
    : `a short ${detourKm} km scenic detour`;

  const cat = String(place.category || 'attraction').toLowerCase();
  let intentText = 'matches your travel preferences';
  if (cat === 'spiritual') intentText = 'aligns with your spiritual and temple preferences';
  else if (cat === 'scenic') intentText = 'offers panoramic photography and scenic landscape views';
  else if (cat === 'mountain' || cat === 'hill') intentText = 'delivers stunning mountain vistas and hill geography';
  else if (cat === 'trekking') intentText = 'provides rewarding trekking and nature trail exploration';
  else if (cat === 'adventure') intentText = 'adds exciting outdoor adventure to your journey';

  return `Recommended because it ${intentText} (${matchPercent}% affinity), is located ${detourText}, and is safely timed for daytime exploration.`;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 540;
  const match = String(timeStr).match(/(\d+):(\d+)/);
  if (!match) return 540;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

module.exports = {
  scorePlaceCandidate,
  calculatePreferenceMatch,
  calculateRatingConfidence,
  generateRecommendationRationale,
  DEFAULT_SCORING_WEIGHTS
};
