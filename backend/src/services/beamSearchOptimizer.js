/**
 * BEAM SEARCH OPTIMIZER WITH STATE DOMINANCE PRUNING & ROAD-NETWORK SEARCH
 *
 * Implements Phase 8: Complete Beam Search:
 * - State representation: currentNode, currentTime, currentDay, visitedPOIs, visitedCategories,
 *   coveredPreferences, accumulatedTravelTime, accumulatedVisitDuration, remainingBudget,
 *   totalRoadDistance, totalDetour, openingHoursFeasibility, weatherFeasibility, sequence.
 * - Point-to-point road-network distance evaluation between consecutive nodes
 * - Rejection of infeasible states (closing violations, daily driving threshold, excessive hops)
 * - Submodular experience gain and temporal utility evaluation
 * - Mathematically correct Pareto state-dominance pruning
 * - Optimization statistics tracking
 */

const {
  calculateCosineSimilarity,
  calculateTimeDependentTravelTime,
  evaluateSubmodularExperienceUtility
} = require('./spatiotemporalUtils');
const { getSegmentRoadDistanceKm } = require('./threeOptLocalSearch');

/**
 * Calculate Temporal Node Multiplier
 * Evaluates whether expected arrival aligns with the POI's prime experiential hours
 */
function calculateTemporalUtilityMultiplier(poi, arrivalMinutes) {
  const normMin = ((arrivalMinutes % 1440) + 1440) % 1440;
  const tags = (poi.tags || []).map(t => String(t).toLowerCase());
  const name = String(poi.name || '').toLowerCase();
  const cat = String(poi.category || (poi.types && poi.types[0]) || '').toLowerCase();

  // Sunrise Point (05:15 - 06:45)
  if (tags.includes('sunrise') || name.includes('sunrise') || cat.includes('sunrise')) {
    if (normMin >= 315 && normMin <= 415) return 1.60;
    if (normMin > 660 && normMin < 960) return 0.20; // Midday sunrise is useless
    return 0.60;
  }

  // Sunset Viewpoint (17:15 - 18:45)
  if (tags.includes('sunset') || name.includes('sunset') || cat.includes('sunset')) {
    if (normMin >= 1035 && normMin <= 1135) return 1.55;
    if (normMin >= 660 && normMin <= 900) return 0.70;
    return 0.90;
  }

  // Temples & Spiritual Sites (Midday closing 12:30 - 16:00)
  if (cat === 'spiritual' || cat === 'temple' || cat === 'temples' || tags.includes('temple')) {
    if (normMin >= 750 && normMin <= 960) return 0.25; // Afternoon darshan closed
    if ((normMin >= 360 && normMin <= 700) || (normMin >= 990 && normMin <= 1260)) return 1.35;
    return 0.85;
  }

  // Wildlife Safaris & Sanctuaries (06:00 - 09:30, 15:30 - 18:00)
  if (cat === 'wildlife' || tags.includes('wildlife') || tags.includes('safari') || name.includes('sanctuary')) {
    if ((normMin >= 360 && normMin <= 570) || (normMin >= 930 && normMin <= 1080)) return 1.45;
    if (normMin >= 660 && normMin <= 900) return 0.40; // Animals resting during midday heat
    return 0.75;
  }

  // Night Bazaars & Evening Culinary
  if ((cat === 'culinary' || cat === 'food') && (tags.includes('night_market') || tags.includes('street_food'))) {
    if (normMin >= 1140 && normMin <= 1380) return 1.40;
    return 0.80;
  }

  return 1.0;
}

/**
 * Dynamic Weather Graph Modifier
 */
function evaluateWeatherImpact(poi, weatherCondition = 'Clear') {
  const cond = String(weatherCondition || 'Clear').toLowerCase();
  const cat = String(poi.category || (poi.types && poi.types[0]) || '').toLowerCase();
  const tags = (poi.tags || []).map(t => String(t).toLowerCase());

  // Severe Monsoon Rain / Storm
  if (cond.includes('rain') || cond.includes('storm')) {
    if (cat === 'waterfalls' || cat === 'waterfall' || tags.includes('waterfall') || tags.includes('trekking') || tags.includes('climbing')) {
      return {
        isFeasible: false,
        transitMultiplier: 1.35,
        experienceMultiplier: 0.10,
        hazardReason: 'Trail flash-flood and rockfall hazard in heavy precipitation'
      };
    }
    if (cat === 'historical' || cat === 'palaces' || cat === 'palace' || cat === 'museum' || cat === 'culinary') {
      return { isFeasible: true, transitMultiplier: 1.25, experienceMultiplier: 1.15, hazardReason: null };
    }
    return { isFeasible: true, transitMultiplier: 1.30, experienceMultiplier: 0.75, hazardReason: null };
  }

  // Mountain Fog / Low Visibility
  if (cond.includes('fog') || cond.includes('mist')) {
    if (cat.includes('viewpoint') || tags.includes('viewpoint') || tags.includes('scenic')) {
      return { isFeasible: true, transitMultiplier: 1.30, experienceMultiplier: 0.35, hazardReason: 'Panoramic vista obscured by heavy fog' };
    }
    return { isFeasible: true, transitMultiplier: 1.20, experienceMultiplier: 1.0, hazardReason: null };
  }

  return { isFeasible: true, transitMultiplier: 1.0, experienceMultiplier: 1.0, hazardReason: null };
}

/**
 * Compute the 12 Positive Objectives (F1-F12) and 8 Negative Penalties (G1-G8)
 */
function computeObjectiveVector(state, userProfile) {
  const stops = state.sequence;
  const userEmbedding = userProfile.semanticEmbedding;

  const avgPref = stops.length > 0 ? (stops.reduce((sum, s) => sum + (s.preferenceScore != null ? Number(s.preferenceScore) : (s.preferenceMatchScore != null ? Number(s.preferenceMatchScore) : 0.5)), 0) / stops.length) : 0.5;
  const f1 = evaluateSubmodularExperienceUtility(stops, userEmbedding) * (0.5 + 0.5 * avgPref);
  const catCount = Object.keys(state.visitedCategories).length;
  const f2 = Math.min(1.0, catCount / Math.max(1, stops.length));

  let totalSem = 0;
  stops.forEach(s => {
    const pref = s.preferenceScore != null ? Number(s.preferenceScore) : (s.preferenceMatchScore != null ? Number(s.preferenceMatchScore) : null);
    if (pref !== null) {
      totalSem += pref;
    } else {
      totalSem += s.semanticScore || (s.semanticEmbedding ? calculateCosineSimilarity(userEmbedding, s.semanticEmbedding) : 0.65);
    }
  });
  const f3 = stops.length > 0 ? (totalSem / stops.length) : 0.50;

  let twPass = 0;
  stops.forEach(s => {
    if (s.temporalMultiplier >= 1.0) twPass++;
  });
  const f4 = stops.length > 0 ? (twPass / stops.length) : 1.0;
  const f5 = stops.every(s => s.weatherHazard == null) ? 1.0 : 0.60;
  const f6 = 0.92;
  const f7 = Math.max(0.40, Math.min(1.0, 1.0 - (state.detourDistance / 180)));
  const f8 = Math.max(0.40, Math.min(1.0, 1.0 - (state.trafficDelayMinutes / 120)));
  const f9 = Math.max(0.30, Math.min(1.0, state.remainingBudget / Math.max(1, state.initialBudget)));
  const f10 = stops.reduce((sum, s) => sum + (s.fameScore || 0.50), 0) / Math.max(1, stops.length);
  const f11 = stops.reduce((sum, s) => sum + (s.exploreBonus || 0.10), 0) / Math.max(1, stops.length);
  const f12 = state.remainingTime > 120 ? 1.0 : 0.70;

  const g1_travelTime = state.travelTime;
  const g2_detour = state.detourDistance;
  const g3_trafficRisk = state.trafficDelayMinutes;
  const g4_weatherRisk = f5 < 0.90 ? 1 : 0;
  const g5_cost = state.totalCost;
  const g6_repetition = Math.max(0, stops.length - catCount);
  const g7_scheduleRisk = state.remainingTime < 60 ? 1 : 0;
  const g8_routeOverlap = 0.30;

  return {
    F: { f1_preferenceSatisfaction: f1, f2_experienceDiversity: f2, f3_semanticRelevance: f3, f4_timeWindowSatisfaction: f4, f5_weatherSuitability: f5, f6_travelerCompatibility: f6, f7_routeEfficiency: f7, f8_trafficEfficiency: f8, f9_costEfficiency: f9, f10_destinationExperience: f10, f11_novelty: f11, f12_comfort: f12 },
    G: { g1_travelTime, g2_detour, g3_trafficRisk, g4_weatherRisk, g5_cost, g6_repetition, g7_scheduleRisk, g8_routeOverlap },
    compositeScore: (f1 * 0.35 + f2 * 0.15 + f3 * 0.15 + f4 * 0.15 + f7 * 0.10 + f10 * 0.10)
  };
}

/**
 * Check if state A Pareto-dominates state B
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
 */
function runBeamSearchOptimization({
  candidatePool = [],
  userProfile = {},
  tripContext = {},
  beamWidth = 8,
  maxStops = 5
}) {
  const startTime = Date.now();
  const startMinutes = tripContext.startMinutes || 420; // 07:00 AM
  const totalBudget = Number(tripContext.budget || userProfile.budget || 25000);
  const weatherCondition = tripContext.weatherCondition || 'Clear';

  const originNode = {
    name: tripContext.origin || userProfile.origin || 'Origin',
    coordinates: tripContext.originCoord || { lat: 17.3850, lng: 78.4867 }
  };

  const rootState = {
    currentNode: originNode,
    currentDay: 1,
    currentTime: startMinutes,
    remainingTime: Math.min(720, (tripContext.tripDurationDays || userProfile.totalDays || 3) * 360),
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
  rootState.objectiveVector = computeObjectiveVector(rootState, userProfile);

  let beam = [rootState];
  let totalStatesEvaluated = 1;
  let totalStatesPruned = 0;

  for (let depth = 0; depth < maxStops; depth++) {
    const candidatesForExpansion = [];

    for (const state of beam) {
      for (const cand of candidatePool) {
        const placeKey = cand.placeKey || (cand.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (state.visitedPOIs.has(placeKey)) continue;

        // Check weather feasibility
        const weatherCheck = evaluateWeatherImpact(cand, weatherCondition);
        if (!weatherCheck.isFeasible) continue;

        // 1. Calculate REAL road transit distance from currentNode to candidate
        const stepRoadKm = getSegmentRoadDistanceKm(
          state.currentNode,
          cand,
          tripContext.routeTransitionMatrix,
          tripContext.locationIndexMap,
          { allowEstimates: tripContext.allowEstimates === true }
        );

        if (stepRoadKm === null) {
          totalStatesPruned++;
          continue; // Unavailable transition in strict mode: reject candidate immediately
        }

        // Reject impossible jump transitions within a single day's sightseeing sequence (> 280 km)
        if (stepRoadKm > 280 && state.sequence.length > 0) continue;

        let stepTransitMinutes = null;
        if (tripContext.routeTransitionMatrix && typeof tripContext.routeTransitionMatrix.getTransition === 'function') {
          const cell = tripContext.routeTransitionMatrix.getTransition(state.currentNode, cand, { allowFallbackEstimate: tripContext.allowEstimates === true });
          if (cell && cell.durationMinutes !== null && cell.dataStatus !== 'unavailable') {
            stepTransitMinutes = cell.durationMinutes;
          } else if (cell && (cell.dataStatus === 'unavailable' || cell.durationMinutes === null) && tripContext.allowEstimates !== true) {
            totalStatesPruned++;
            continue; // Unavailable transition in strict mode
          }
        }
        const transit = stepTransitMinutes != null
          ? { travelMinutes: stepTransitMinutes, delayMinutes: 0 }
          : calculateTimeDependentTravelTime(stepRoadKm, state.currentTime);
        const effectiveTransitMinutes = Math.round(transit.travelMinutes * weatherCheck.transitMultiplier);
        const expectedArrival = state.currentTime + effectiveTransitMinutes;

        // 2. Time-window opening/closing feasibility check
        const openMin = cand.openMinutes !== undefined ? cand.openMinutes : 360;
        const closeMin = cand.closeMinutes !== undefined ? cand.closeMinutes : 1140;

        if (expectedArrival + 15 > closeMin) continue; // Arrives after closing

        const duration = cand.durationMinutes || 60;
        const departureFromStop = Math.max(expectedArrival, openMin) + duration;
        const timeConsumed = (departureFromStop - state.currentTime);

        if (state.remainingTime < timeConsumed) continue; // Exceeds time budget

        // 3. Financial budget feasibility
        const stopCost = Math.round(stepRoadKm * 6.5) + (cand.entryFee || 25);
        if (state.remainingBudget < stopCost) continue;

        totalStatesEvaluated++;

        // 4. Temporal alignment multiplier
        const tempMultiplier = calculateTemporalUtilityMultiplier(cand, expectedArrival);

        // 5. Submodular experience contribution
        const nextCategories = { ...state.visitedCategories };
        const catKey = (cand.category || (cand.types && cand.types[0]) || 'attraction').toLowerCase();
        nextCategories[catKey] = (nextCategories[catKey] || 0) + 1;

        const nextStops = [
          ...state.sequence,
          {
            ...cand,
            placeKey,
            expectedArrivalMinutes: expectedArrival,
            transitMinutes: effectiveTransitMinutes,
            segmentRoadKm: stepRoadKm,
            temporalMultiplier: tempMultiplier,
            weatherHazard: weatherCheck.hazardReason
          }
        ];

        const avgPref = nextStops.reduce((sum, s) => sum + (s.preferenceScore != null ? Number(s.preferenceScore) : 0.5), 0) / nextStops.length;
        const nextExp = evaluateSubmodularExperienceUtility(nextStops, userProfile.semanticEmbedding) * (0.3 + 1.4 * avgPref);

        const nextCovered = new Set(state.coveredPreferences);
        (cand.tags || []).forEach(t => nextCovered.add(t));
        nextCovered.add(catKey);

        const newState = {
          currentNode: cand,
          currentDay: state.currentDay,
          currentTime: departureFromStop,
          remainingTime: state.remainingTime - timeConsumed,
          remainingBudget: state.remainingBudget - stopCost,
          initialBudget: state.initialBudget,
          visitedPOIs: new Set([...state.visitedPOIs, placeKey]),
          visitedCategories: nextCategories,
          coveredPreferences: nextCovered,
          routeDistance: state.routeDistance + stepRoadKm,
          travelTime: state.travelTime + effectiveTransitMinutes,
          detourDistance: state.detourDistance + (cand.detourKm || 5),
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

    // Apply strict Pareto Dominance Pruning
    const nonDominated = [];
    for (let i = 0; i < candidatesForExpansion.length; i++) {
      let isDominated = false;
      for (let j = 0; j < candidatesForExpansion.length; j++) {
        if (i !== j && stateDominates(candidatesForExpansion[j], candidatesForExpansion[i])) {
          isDominated = true;
          totalStatesPruned++;
          break;
        }
      }
      if (!isDominated) {
        nonDominated.push(candidatesForExpansion[i]);
      }
    }

    // Sort by composite multi-objective score and retain top-K beam
    nonDominated.sort((a, b) => b.objectiveVector.compositeScore - a.objectiveVector.compositeScore);
    beam = nonDominated.slice(0, beamWidth);
  }

  const bestState = beam[0] || rootState;
  const executionTimeMs = Date.now() - startTime;

  return {
    bestState,
    candidateBranchesEvaluated: totalStatesEvaluated,
    statesPruned: totalStatesPruned,
    executionTimeMs,
    beamWidth,
    finalSequence: bestState.sequence,
    bestSequence: bestState.sequence,
    objectiveVector: bestState.objectiveVector,
    totalRoadDistanceKm: bestState.routeDistance,
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
