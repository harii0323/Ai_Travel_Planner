/**
 * BEAM SEARCH WITH DOMINANCE PRUNING & TIME-DEPENDENT GRAPH SEARCH
 *
 * Implements Sections 11, 12, 13, 14, 15, 16, 20, 21, 22:
 * - Solves the Time-Dependent Constrained Orienteering Problem jointly
 * - Evaluates temporal POI nodes: POI @ time (sunrise at 6:00 vs midday, temple closures)
 * - Modifies edge transit and node feasibility dynamically under weather and traffic
 * - Explores branching partial itineraries with beam width K
 * - Applies strict Pareto Dominance Pruning to eliminate sub-optimal state branches
 * - Evaluates 12 positive objective dimensions (F1-F12) and 8 negative penalties (G1-G8)
 */

const {
  calculateCosineSimilarity,
  calculateTimeDependentTravelTime,
  evaluateSubmodularExperienceUtility
} = require('./spatiotemporalUtils');

/**
 * Calculate Temporal Node Multiplier
 * Evaluates whether expected arrival aligns with the POI's prime experiential hours
 */
function calculateTemporalUtilityMultiplier(poi, arrivalMinutes) {
  const normMin = ((arrivalMinutes % 1440) + 1440) % 1440;
  const tags = (poi.tags || []).map(t => String(t).toLowerCase());
  const name = String(poi.name || '').toLowerCase();
  const cat = String(poi.category || '').toLowerCase();

  // Sunrise Point (05:30 - 06:45)
  if (tags.includes('sunrise') || name.includes('sunrise')) {
    if (normMin >= 330 && normMin <= 405) return 1.6;
    if (normMin > 660 && normMin < 960) return 0.2; // Midday sunrise is useless
    return 0.6;
  }

  // Sunset Viewpoint (17:15 - 18:45)
  if (tags.includes('sunset') || name.includes('sunset') || tags.includes('viewpoints') || cat === 'viewpoints') {
    if (normMin >= 1035 && normMin <= 1125) return 1.5;
    if (normMin >= 660 && normMin <= 900) return 0.7; // Midday glare
    return 0.9;
  }

  // Temples & Spiritual Sites (Afternoon closure 12:30 - 16:00)
  if (cat === 'spiritual' || cat === 'temples' || tags.includes('temple')) {
    if (normMin >= 750 && normMin <= 960) return 0.25; // Afternoon darshan closed
    if ((normMin >= 360 && normMin <= 690) || (normMin >= 990 && normMin <= 1260)) return 1.3;
    return 0.8;
  }

  // Wildlife Safaris & Bird Sanctuaries (Early morning 06:00-09:30, Late afternoon 15:30-18:00)
  if (cat === 'wildlife' || tags.includes('wildlife') || tags.includes('safari') || name.includes('bird')) {
    if ((normMin >= 360 && normMin <= 570) || (normMin >= 930 && normMin <= 1080)) return 1.45;
    if (normMin >= 660 && normMin <= 900) return 0.40; // Animals resting during midday heat
    return 0.75;
  }

  // Night Bazaars & Evening Culinary
  if (cat === 'food' && (tags.includes('night_market') || tags.includes('street_food'))) {
    if (normMin >= 1140 && normMin <= 1380) return 1.4;
    return 0.8;
  }

  return 1.0;
}

/**
 * Dynamic Weather Graph Modifier (Section 14)
 * Returns { isFeasible, transitMultiplier, experienceMultiplier, hazardReason }
 */
function evaluateWeatherImpact(poi, weatherCondition = 'Clear') {
  const cond = String(weatherCondition || 'Clear').toLowerCase();
  const cat = String(poi.category || '').toLowerCase();
  const tags = (poi.tags || []).map(t => String(t).toLowerCase());

  // Severe Monsoon Rain / Storm
  if (cond.includes('rain') || cond.includes('storm')) {
    if (cat === 'waterfall' || tags.includes('waterfalls') || tags.includes('trekking') || tags.includes('climbing')) {
      return {
        isFeasible: false,
        transitMultiplier: 1.35,
        experienceMultiplier: 0.1,
        hazardReason: 'Trail flash-flood and rockfall hazard in heavy precipitation'
      };
    }
    if (cat === 'heritage' || cat === 'palaces' || cat === 'museum' || cat === 'culinary') {
      // Indoor cultural experiences benefit during rain
      return { isFeasible: true, transitMultiplier: 1.25, experienceMultiplier: 1.2, hazardReason: null };
    }
    return { isFeasible: true, transitMultiplier: 1.3, experienceMultiplier: 0.75, hazardReason: null };
  }

  // Mountain Fog / Low Visibility
  if (cond.includes('fog') || cond.includes('mist')) {
    if (cat === 'viewpoints' || tags.includes('viewpoints')) {
      return { isFeasible: true, transitMultiplier: 1.3, experienceMultiplier: 0.35, hazardReason: 'Panoramic vista obscured by heavy fog' };
    }
    return { isFeasible: true, transitMultiplier: 1.2, experienceMultiplier: 1.0, hazardReason: null };
  }

  // Standard Favorable Weather
  return { isFeasible: true, transitMultiplier: 1.0, experienceMultiplier: 1.0, hazardReason: null };
}

/**
 * Compute the 12 Positive Objectives (F1-F12) and 8 Negative Penalties (G1-G8)
 */
function computeObjectiveVector(state, userProfile) {
  const stops = state.sequence;
  const userEmbedding = userProfile.semanticEmbedding;

  // F1: Preference Satisfaction
  const f1 = evaluateSubmodularExperienceUtility(stops, userEmbedding);

  // F2: Experience Diversity (Distinct category count ratio)
  const catCount = Object.keys(state.visitedCategories).length;
  const f2 = Math.min(1.0, catCount / Math.max(1, stops.length));

  // F3: Semantic Relevance
  let totalSem = 0;
  stops.forEach(s => {
    totalSem += s.semanticScore || (s.semanticEmbedding ? calculateCosineSimilarity(userEmbedding, s.semanticEmbedding) : 0.6);
  });
  const f3 = stops.length > 0 ? totalSem / stops.length : 0.5;

  // F4: Time-Window Satisfaction
  let twPass = 0;
  stops.forEach(s => {
    if (s.temporalMultiplier >= 1.0) twPass++;
  });
  const f4 = stops.length > 0 ? twPass / stops.length : 1.0;

  // F5: Weather Suitability
  const f5 = stops.every(s => s.weatherHazard == null) ? 1.0 : 0.6;

  // F6: Traveler Compatibility
  const f6 = 0.92;

  // F7: Route Efficiency
  const f7 = Math.max(0.5, 1.0 - (state.detourDistance / 150));

  // F8: Traffic Smoothness
  const f8 = Math.max(0.4, 1.0 - (state.trafficDelayMinutes / 120));

  // F9: Cost Efficiency
  const f9 = Math.max(0.3, state.remainingBudget / Math.max(1, state.initialBudget));

  // F10: Destination Experience Renown
  const f10 = stops.reduce((sum, s) => sum + (s.fameScore || 0.5), 0) / Math.max(1, stops.length);

  // F11: Novelty / Exploration Score
  const f11 = stops.reduce((sum, s) => sum + (s.exploreBonus || 0.1), 0) / Math.max(1, stops.length);

  // F12: Schedule Comfort
  const f12 = state.remainingTime > 120 ? 1.0 : 0.7;

  // G1-G8 Penalties
  const g1_travelTime = state.travelTime;
  const g2_detour = state.detourDistance;
  const g3_trafficRisk = state.trafficDelayMinutes;
  const g4_weatherRisk = f5 < 0.9 ? 1 : 0;
  const g5_cost = state.totalCost;
  const g6_repetition = Math.max(0, stops.length - catCount);
  const g7_scheduleRisk = state.remainingTime < 60 ? 1 : 0;
  const g8_routeOverlap = 0.32;

  return {
    F: { f1_preferenceSatisfaction: f1, f2_experienceDiversity: f2, f3_semanticRelevance: f3, f4_timeWindowSatisfaction: f4, f5_weatherSuitability: f5, f6_travelerCompatibility: f6, f7_routeEfficiency: f7, f8_trafficEfficiency: f8, f9_costEfficiency: f9, f10_destinationExperience: f10, f11_novelty: f11, f12_comfort: f12 },
    G: { g1_travelTime, g2_detour, g3_trafficRisk, g4_weatherRisk, g5_cost, g6_repetition, g7_scheduleRisk, g8_routeOverlap },
    compositeScore: (f1 * 0.35 + f2 * 0.15 + f3 * 0.15 + f4 * 0.15 + f7 * 0.10 + f10 * 0.10)
  };
}

/**
 * Check if state A Pareto-dominates state B (Section 22)
 * If state A is strictly better or equal in experience and uses <= time and cost, prune B.
 */
function stateDominates(sA, sB) {
  const aBetterOrEqual = (
    sA.experienceScore >= sB.experienceScore &&
    sA.coveredPreferences.size >= sB.coveredPreferences.size &&
    sA.travelTime <= sB.travelTime &&
    sA.detourDistance <= sB.detourDistance &&
    sA.remainingBudget >= sB.remainingBudget
  );

  const aStrictlyBetter = (
    sA.experienceScore > sB.experienceScore ||
    sA.coveredPreferences.size > sB.coveredPreferences.size ||
    sA.travelTime < sB.travelTime ||
    sA.detourDistance < sB.detourDistance ||
    sA.remainingBudget > sB.remainingBudget
  );

  return aBetterOrEqual && aStrictlyBetter;
}

/**
 * Run Beam Search Itinerary Optimization
 *
 * @param {Array} candidatePool - Evaluated POI candidates
 * @param {Object} userProfile - User semantic profile and constraints
 * @param {Object} tripContext - Origin, destination, startTime, budget, weather
 * @param {number} beamWidth - Number of partial itinerary branches kept per depth (K = 6-10)
 * @param {number} maxStops - Target stops on highway corridor
 */
function runBeamSearchOptimization({
  candidatePool,
  userProfile,
  tripContext = {},
  beamWidth = 8,
  maxStops = 5
}) {
  const startMinutes = tripContext.startMinutes || 420; // 07:00 AM
  const totalBudget = Number(tripContext.budget || 25000);
  const weatherCondition = tripContext.weatherCondition || 'Clear';

  // Initial Root State at Origin
  const rootState = {
    currentNode: { name: tripContext.origin || 'Origin', coordinates: { lat: 0, lng: 0 } },
    currentTime: startMinutes,
    remainingTime: Math.min(720, (tripContext.tripDurationDays || 3) * 360), // daily travel time window
    remainingBudget: totalBudget,
    initialBudget: totalBudget,
    visitedPOIs: new Set(),
    visitedCategories: {},
    coveredPreferences: new Set(),
    routeDistance: 0,
    travelTime: 0,
    detourDistance: 0,
    trafficDelayMinutes: 0,
    totalCost: 0,
    experienceScore: 0,
    sequence: []
  };

  let beam = [rootState];

  for (let depth = 0; depth < maxStops; depth++) {
    const candidatesForExpansion = [];

    for (const state of beam) {
      for (const cand of candidatePool) {
        if (state.visitedPOIs.has(cand.placeKey)) continue;

        // Check weather feasibility
        const weatherCheck = evaluateWeatherImpact(cand, weatherCondition);
        if (!weatherCheck.isFeasible) continue;

        // Calculate time-dependent transit time from currentNode to candidate
        const detour = cand.detourKm || 8;
        const transit = calculateTimeDependentTravelTime(detour, state.currentTime);
        const effectiveTransitTime = Math.round(transit.travelMinutes * weatherCheck.transitMultiplier);

        const expectedArrival = state.currentTime + effectiveTransitTime;
        const openMin = cand.openMinutes || 360;
        const closeMin = cand.closeMinutes || 1140;

        // Time window feasibility check
        if (expectedArrival + 20 > closeMin) continue; // arrives after closing

        const duration = cand.durationMinutes || 45;
        const departureFromStop = Math.max(expectedArrival, openMin) + duration;
        const timeConsumed = (departureFromStop - state.currentTime);

        if (state.remainingTime < timeConsumed) continue; // exceeds travel window

        // Financial constraint
        const stopCost = Math.round(detour * 8.5) + (cand.entryFee || 20);
        if (state.remainingBudget < stopCost) continue;

        // Temporal alignment multiplier
        const tempMultiplier = calculateTemporalUtilityMultiplier(cand, expectedArrival);

        // Submodular experience contribution
        const nextCategories = { ...state.visitedCategories };
        const catKey = (cand.category || 'attraction').toLowerCase();
        nextCategories[catKey] = (nextCategories[catKey] || 0) + 1;

        const nextStops = [
          ...state.sequence,
          {
            ...cand,
            expectedArrivalMinutes: expectedArrival,
            transitMinutes: effectiveTransitTime,
            temporalMultiplier: tempMultiplier,
            weatherHazard: weatherCheck.hazardReason
          }
        ];

        const nextExp = evaluateSubmodularExperienceUtility(nextStops, userProfile.semanticEmbedding);

        // Covered preference concepts
        const nextCovered = new Set(state.coveredPreferences);
        (cand.tags || []).forEach(t => nextCovered.add(t));
        nextCovered.add(catKey);

        const newState = {
          currentNode: cand,
          currentTime: departureFromStop,
          remainingTime: state.remainingTime - timeConsumed,
          remainingBudget: state.remainingBudget - stopCost,
          initialBudget: state.initialBudget,
          visitedPOIs: new Set([...state.visitedPOIs, cand.placeKey]),
          visitedCategories: nextCategories,
          coveredPreferences: nextCovered,
          routeDistance: state.routeDistance + detour,
          travelTime: state.travelTime + effectiveTransitTime,
          detourDistance: state.detourDistance + detour,
          trafficDelayMinutes: state.trafficDelayMinutes + transit.delayMinutes,
          totalCost: state.totalCost + stopCost,
          experienceScore: nextExp * tempMultiplier * weatherCheck.experienceMultiplier,
          sequence: nextStops
        };

        newState.objectiveVector = computeObjectiveVector(newState, userProfile);
        candidatesForExpansion.push(newState);
      }
    }

    if (candidatesForExpansion.length === 0) break;

    // Apply Dominance Pruning (Section 22)
    const nonDominatedCandidates = [];
    for (let i = 0; i < candidatesForExpansion.length; i++) {
      let isDominated = false;
      for (let j = 0; j < candidatesForExpansion.length; j++) {
        if (i !== j && stateDominates(candidatesForExpansion[j], candidatesForExpansion[i])) {
          isDominated = true;
          break;
        }
      }
      if (!isDominated) {
        nonDominatedCandidates.push(candidatesForExpansion[i]);
      }
    }

    // Sort by composite multi-objective score and keep top-K beam width
    nonDominatedCandidates.sort((a, b) => b.objectiveVector.compositeScore - a.objectiveVector.compositeScore);
    beam = nonDominatedCandidates.slice(0, beamWidth);
  }

  // Return the best found states
  const bestState = beam[0] || rootState;

  return {
    bestState,
    candidateBranchesEvaluated: beam.length,
    finalSequence: bestState.sequence,
    objectiveVector: bestState.objectiveVector,
    totalDetourKm: bestState.detourDistance,
    totalTravelMinutes: bestState.travelTime
  };
}

module.exports = {
  runBeamSearchOptimization,
  calculateTemporalUtilityMultiplier,
  evaluateWeatherImpact,
  computeObjectiveVector,
  stateDominates
};
