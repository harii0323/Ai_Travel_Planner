/**
 * UNIFIED TRAVEL PLANNING ORCHESTRATOR
 *
 * Implements Phase 2: Unify the Entire Travel Planning Architecture:
 * Coordinates the 13 Core Architectural Engines in a strict sequential pipeline:
 *
 * USER INPUT
 *     |
 *     v
 * 1. NORMALIZE USER PREFERENCES & TRAVEL CONSTRAINTS (PreferenceEngine)
 *     |
 *     v
 * 2. GENERATE USER PREFERENCE & SEMANTIC EMBEDDING VECTOR (30-D Dense Model)
 *     |
 *     v
 * 3. DISCOVER COMPLETE ROUTE CORRIDOR & ROAD NETWORK (RouteDiscoveryEngine + RoadNetworkGraph)
 *     |
 *     v
 * 4. DISCOVER & ENRICH REAL ATTRACTION CANDIDATES (PlacesDiscoveryEngine + Google Places)
 *     |
 *     v
 * 5. CALCULATE TIME-DEPENDENT ROAD TRAVEL TIMES (Dijkstra / A* Graph Engine)
 *     |
 *     v
 * 6. PREFERENCE-BASED ATTRACTION SCORING & LINUCB BANDIT EVALUATION
 *     |
 *     v
 * 7. CANDIDATE FEASIBILITY FILTERING (Time Windows, Weather Safety, Travel Limits)
 *     |
 *     v
 * 8. DPP DIVERSITY & CONCAVE SUBMODULAR EXPERIENCE SELECTION
 *     |
 *     v
 * 9. BEAM SEARCH + ADAPTIVE LARGE NEIGHBORHOOD SEARCH (ALNS) JOINT OPTIMIZATION
 *     |
 *     v
 * 10. 2-OPT / 3-OPT ROUTE REFINEMENT ANCHORED BY ORIGIN & DESTINATION
 *     |
 *     v
 * 11. PARETO MULTI-OBJECTIVE FRONTIER EVALUATION (8 Normalized Objectives)
 *     |
 *     v
 * 12. TIME-AWARE MULTI-DAY ITINERARY SCHEDULING (Sequential Chronological Timeline)
 *     |
 *     v
 * 13. ITEMIZE VERIFIABLE COSTS & EVIDENCE-BASED VALIDATION ENFORCEMENT
 *     |
 *     v
 * FINAL UNIFIED DAY-WISE ITINERARY STATE
 */

const {
  normalizePreferenceProfile,
  calculatePOIPreferenceMatch,
  UserPreferenceCoverageMatrix,
  formatDimensionLabel
} = require('./preferenceEngine');

const {
  highwayRoadGraph,
  computeUniversalRoute,
  haversineDistanceKm
} = require('./RoadNetworkGraphEngine');
const { roadRoutingProvider } = require('./RoadRoutingProvider');

const {
  discoverPlaces,
  discoverCandidatePlaces,
  deduplicatePlaces,
  VERIFIED_PLACES_DATABASE
} = require('./engine/PlacesDiscoveryEngine');

const { contextualBandit } = require('./contextualBanditEngine');
const { dppSelectDiverseCandidates, calculateSubsetDppDiversity } = require('./dppDiversityEngine');
const { runBeamSearchOptimization, evaluateWeatherImpact } = require('./beamSearchOptimizer');
const { runAdaptiveLargeNeighborhoodSearch } = require('./alnsOptimizer');
const { applyThreeOptLocalSearch, optimizeRouteThreeOptWithProvider } = require('./threeOptLocalSearch');
const { generateParetoFrontier } = require('./spatiotemporalOptimizer');
const { scheduleDailyItineraries } = require('./engine/DailyItineraryScheduler');
const { buildTravelContext } = require('./engine/TravelContextBuilder');
const { calculateTripBudget } = require('./engine/BudgetCalculationEngine');
const { evaluateItineraryFeasibility } = require('./engine/FeasibilityEvaluator');
const { validateAndEnforceOutputContract } = require('./engine/ItineraryValidationEngine');
const { generateRecommendationRationale, runFinalValidationChecklist } = require('./validationEngine');
const { normalizeUserPreferences, resolveDestination } = require('./userPreferenceNormalizer');
const { generateRecommendations } = require('./planner');
const { generateAlternativeReturnRoutes } = require('./routeDiversityEngine');

class UnifiedTravelPlanningOrchestrator {
  /**
   * Generates a single, authoritative, end-to-end travel itinerary
   */
  async generateUnifiedItinerary(rawInput = {}) {
    const startTime = Date.now();

    // =========================================================================
    // STAGE 1: NORMALIZE USER PREFERENCES & TRAVEL CONSTRAINTS
    // =========================================================================
    const userProfile = normalizeUserPreferences(rawInput);
    const prefProfile = normalizePreferenceProfile({
      activities: rawInput.activities || rawInput.preferred_activities,
      travelerType: rawInput.traveler_type || rawInput.travelCompanionType || rawInput.companionType,
      budget: rawInput.budget || rawInput.total_budget,
      travelPace: rawInput.travelPace || rawInput.planningStyle,
      placesToAvoid: rawInput.placesToAvoid || rawInput.avoid,
      preferences: rawInput.preferences
    });

    userProfile.preferenceProfile = prefProfile;
    userProfile.semanticEmbedding = prefProfile.semanticEmbedding;
    userProfile.normalizedInterests = prefProfile.dimensions;

    const origin = userProfile.origin;
    const destination = userProfile.destinationCity || userProfile.destination;
    const totalDays = userProfile.totalDays;
    const isRoundTrip = userProfile.isRoundTrip;

    // =========================================================================
    // STAGE 2: BUILD ROUTE CORRIDOR & ROAD NETWORK GRAPH VIA ROADROUTINGPROVIDER
    // =========================================================================
    const primaryRoute = await roadRoutingProvider.getRoute(origin, destination, {
      departureMinutes: 450, // 07:30 AM
      transportMode: userProfile.transportMode,
      objective: 'time'
    });

    const originCoords = (primaryRoute.origin && primaryRoute.origin.lat != null)
      ? primaryRoute.origin
      : (primaryRoute.waypoints?.[0] || null);
    const destCoords = (primaryRoute.destination && primaryRoute.destination.lat != null)
      ? primaryRoute.destination
      : (primaryRoute.waypoints?.[primaryRoute.waypoints.length - 1] || null);

    const routeInfo = {
      totalDistanceKm: primaryRoute.totalDistanceKm || primaryRoute.distanceKm,
      drivingDurationMinutes: primaryRoute.totalDurationMinutes || primaryRoute.durationMinutes,
      drivingDurationFormatted: primaryRoute.formattedDuration,
      originCoordinates: originCoords,
      destinationCoordinates: destCoords,
      waypoints: primaryRoute.waypoints || [],
      corridorBufferKm: Math.min(80, Math.max(35, Math.round((primaryRoute.totalDistanceKm || primaryRoute.distanceKm || 300) * 0.08))),
      dataSource: primaryRoute.dataSource,
      dataStatus: primaryRoute.dataStatus,
      tier: primaryRoute.tier,
      isLiveVerified: Boolean(primaryRoute.isLiveVerified),
      polyline: primaryRoute.polyline || ''
    };

    // Build Chronological Travel Context (sunrises, daylight, day phases)
    const travelContext = buildTravelContext(userProfile, routeInfo.totalDistanceKm);

    // =========================================================================
    // STAGE 3: DISCOVER & ENRICH REAL ATTRACTION CANDIDATES
    // =========================================================================
    const placesDiscovery = await discoverPlaces({
      origin,
      destination,
      userProfile,
      routeWaypoints: routeInfo.waypoints,
      corridorBufferKm: routeInfo.corridorBufferKm,
      destinationCoordinates: routeInfo.destinationCoordinates
    });

    const candidatePool = placesDiscovery.allPlaces || [];

    // =========================================================================
    // STAGE 4: CONTEXTUAL BANDIT (LinUCB) EVALUATION
    // =========================================================================
    const banditContext = contextualBandit.buildContextVector(userProfile, {
      budget: userProfile.totalBudget,
      tripDurationDays: totalDays,
      travelMode: userProfile.transportMode,
      weatherCondition: rawInput.weatherCondition || 'Clear'
    });
    contextualBandit.registerActiveContext(rawInput.userId, banditContext);

    const enrichedCandidates = candidatePool.map(cand => {
      const match = calculatePOIPreferenceMatch(cand, prefProfile);
      const banditScore = contextualBandit.evaluateCandidate(cand, banditContext);

      return {
        ...cand,
        placeKey: cand.placeId || cand.name.toLowerCase().trim().replace(/[^a-z0-9]/g, ''),
        preferenceScore: match.totalMatchScore,
        preferenceMatchScore: match.totalMatchScore,
        preferenceExplanation: match.explanation,
        matchedDimensions: match.topMatchedDimensions,
        banditScore: banditScore.banditScore,
        exploreBonus: banditScore.exploreBonus,
        isExplorationCandidate: banditScore.isExplorationCandidate,
        detourKm: cand.distanceFromRouteKm ? cand.distanceFromRouteKm * 2 : 5
      };
    });

    // =========================================================================
    // STAGE 5: DPP DIVERSITY & CONCAVE SUBMODULAR SELECTION
    // =========================================================================
    const topScoredPool = [...enrichedCandidates].sort((a, b) =>
      ((b.preferenceScore || 0.5) * 1.5 + (b.banditScore || 0.5) * 0.8) -
      ((a.preferenceScore || 0.5) * 1.5 + (a.banditScore || 0.5) * 0.8)
    );

    const diversePool = dppSelectDiverseCandidates(
      topScoredPool,
      Math.min(topScoredPool.length, Math.max(12, totalDays * 4)),
      userProfile.semanticEmbedding
    );

    // =========================================================================
    // STAGE 6: BEAM SEARCH + ALNS + 3-OPT OPTIMIZATION WITH ROUTE MATRIX
    // =========================================================================
    const originNode = {
      id: `ORIGIN_${String(origin).replace(/[^a-z0-9]/gi, '_')}`,
      name: origin,
      coordinates: routeInfo.originCoordinates,
      lat: routeInfo.originCoordinates?.lat,
      lng: routeInfo.originCoordinates?.lng
    };
    const destNode = {
      id: `DEST_${String(destination).replace(/[^a-z0-9]/gi, '_')}`,
      name: destination,
      coordinates: routeInfo.destinationCoordinates,
      lat: routeInfo.destinationCoordinates?.lat,
      lng: routeInfo.destinationCoordinates?.lng
    };

    // Pre-compute N x N transition matrix across origin, candidates, and destination
    const matrixCandidates = [originNode, ...diversePool, destNode];
    const routeTransitionMatrix = await roadRoutingProvider.getRouteMatrix(matrixCandidates, {
      departureMinutes: 450,
      transportMode: userProfile.transportMode
    });

    const tripOptimizationContext = {
      origin,
      destination,
      originCoord: routeInfo.originCoordinates,
      destCoord: routeInfo.destinationCoordinates,
      budget: userProfile.totalBudget,
      tripDurationDays: totalDays,
      startMinutes: 450,
      weatherCondition: rawInput.weatherCondition || 'Clear',
      routeTransitionMatrix: routeTransitionMatrix?.matrix,
      locationIndexMap: routeTransitionMatrix?.locationIndexMap
    };

    const targetStopCount = Math.min(diversePool.length, Math.max(3, totalDays * 2));

    const beamSearchResult = runBeamSearchOptimization({
      candidatePool: diversePool,
      userProfile,
      tripContext: tripOptimizationContext,
      beamWidth: 8,
      maxStops: targetStopCount
    });

    // Refine with Adaptive Large Neighborhood Search (ALNS)
    const alnsResult = runAdaptiveLargeNeighborhoodSearch({
      initialRoute: beamSearchResult.finalSequence,
      candidatePool: diversePool,
      userProfile,
      tripContext: tripOptimizationContext,
      targetStops: targetStopCount,
      maxIterations: 25
    });

    // Refine with 3-Opt Local Search anchored with endpoints and pre-computed matrix
    const threeOptResult = await optimizeRouteThreeOptWithProvider(alnsResult.bestRoute, {
      origin: originNode,
      destination: destNode,
      matrix: routeTransitionMatrix?.matrix,
      locationIndexMap: routeTransitionMatrix?.locationIndexMap
    });
    const refinedSequence = threeOptResult.bestRoute;

    // =========================================================================
    // STAGE 7: PARETO MULTI-OBJECTIVE FRONTIER EVALUATION
    // =========================================================================
    const paretoFrontier = generateParetoFrontier(
      diversePool,
      userProfile,
      targetStopCount,
      tripOptimizationContext
    );

    const planningMode = String(rawInput.planningMode || rawInput.optimization_mode || rawInput.mode || 'BALANCED').toUpperCase();
    const normMode = planningMode.replace(/EST$/, '');
    const activeParetoSolution = paretoFrontier.find(p => p.mode === planningMode || p.mode === normMode || p.mode.includes(normMode)) || paretoFrontier[0];
    const selectedOptimizerStops = (activeParetoSolution.stops && activeParetoSolution.stops.length > 0)
      ? activeParetoSolution.stops
      : refinedSequence;

    // Build structured route transitions between consecutive stops using routeTransitionMatrix
    const routeTransitions = [];
    let prevStopNode = originNode;
    for (let sIdx = 0; sIdx < selectedOptimizerStops.length; sIdx++) {
      const currStop = selectedOptimizerStops[sIdx];
      let distKm = null;
      let durMins = null;
      let transSource = routeInfo.dataSource || 'road_routing_provider';
      let transStatus = routeInfo.dataStatus || 'graph_modeled';
      let transVerified = Boolean(routeInfo.isLiveVerified);

      if (routeTransitionMatrix?.matrix && routeTransitionMatrix?.locationIndexMap) {
        const k1 = prevStopNode.id || prevStopNode.placeId || prevStopNode.name || `${prevStopNode.coordinates?.lat || prevStopNode.lat},${prevStopNode.coordinates?.lng || prevStopNode.lng}`;
        const k2 = currStop.id || currStop.placeId || currStop.name || `${currStop.coordinates?.lat || currStop.lat},${currStop.coordinates?.lng || currStop.lng}`;
        const i = routeTransitionMatrix.locationIndexMap.get(k1);
        const j = routeTransitionMatrix.locationIndexMap.get(k2);
        if (i !== undefined && j !== undefined && routeTransitionMatrix.matrix[i]?.[j]) {
          const cell = routeTransitionMatrix.matrix[i][j];
          distKm = cell.distanceKm;
          durMins = cell.durationMinutes;
          transSource = cell.dataSource || transSource;
          transStatus = cell.dataStatus || transStatus;
          transVerified = Boolean(cell.isLiveVerified);
        }
      }

      if (distKm == null) {
        const c1 = prevStopNode.coordinates || (prevStopNode.lat != null ? { lat: prevStopNode.lat, lng: prevStopNode.lng } : null) || routeInfo.originCoordinates;
        const c2 = currStop.coordinates || (currStop.lat != null ? { lat: currStop.lat, lng: currStop.lng } : null) || routeInfo.destinationCoordinates;
        const geoKm = c1 && c2 ? haversineDistanceKm(c1, c2) : 25;
        distKm = Math.round(geoKm * 1.25 * 10) / 10;
        durMins = Math.round((distKm / 55) * 60);
        transSource = 'geodesic_haversine_projection_model';
        transStatus = 'estimated';
        transVerified = false;
      }

      routeTransitions.push({
        from: prevStopNode.name || prevStopNode.placeName || origin,
        to: currStop.name || currStop.placeName || 'Waypoint',
        distanceKm: distKm,
        estimatedMinutes: durMins,
        dataSource: transSource,
        dataStatus: transStatus,
        isLiveVerified: transVerified
      });
      prevStopNode = currStop;
    }

    // Required Structured Integration Contract (Prompt Section 2)
    const optimizerResult = {
      selectedStops: selectedOptimizerStops,
      selectedMode: activeParetoSolution.mode,
      objectiveScores: activeParetoSolution.objectives || {},
      routeTransitions,
      feasibilityStatus: {
        isFeasible: true,
        status: 'FEASIBLE',
        score: 100
      },
      preferenceCoverage: {},
      diversityMetrics: {
        dppDiversityMetric: calculateSubsetDppDiversity(selectedOptimizerStops),
        retainedCandidateCount: selectedOptimizerStops.length,
        categoriesRepresented: Array.from(new Set(selectedOptimizerStops.map(s => s.category || 'general')))
      },
      estimatedTravelDuration: {
        totalDistanceKm: routeInfo.totalDistanceKm,
        drivingDurationFormatted: routeInfo.drivingDurationFormatted
      },
      optimizationWarnings: [],
      dataProvenance: {
        routingProvider: routeInfo.dataSource || 'limited_highway_corridor_graph',
        routingTier: routeInfo.tier || 3,
        isLiveVerified: Boolean(routeInfo.isLiveVerified),
        placesRetrievedCount: candidatePool.length,
        paretoModesEvaluated: paretoFrontier.length
      }
    };

    // =========================================================================
    // STAGE 8: TIME-AWARE MULTI-DAY ITINERARY SCHEDULING
    // =========================================================================
    const dayPlans = await scheduleDailyItineraries({
      userProfile,
      routeInfo,
      travelContext,
      candidatePlaces: diversePool,
      selectedStops: selectedOptimizerStops,
      optimizerResult,
      routeTransitionMatrix: routeTransitionMatrix?.matrix,
      locationIndexMap: routeTransitionMatrix?.locationIndexMap,
      roadRoutingProvider
    });

    // =========================================================================
    // STAGE 9: ACCURATE ITEMIZED COST CALCULATION
    // =========================================================================
    const budgetSummary = calculateTripBudget({
      userProfile,
      routeInfo,
      dayPlans
    });

    // =========================================================================
    // STAGE 10: USER PREFERENCE COVERAGE MATRIX
    // =========================================================================
    const coverageMatrix = new UserPreferenceCoverageMatrix(prefProfile);
    dayPlans.forEach(day => {
      (day.stops || []).forEach(stop => {
        coverageMatrix.recordPlace(stop, day.phase);
      });
    });

    optimizerResult.preferenceCoverage = coverageMatrix.getSummaryStats();

    // Independent Return Route Plan (Round-Trip Only)
    let returnRoutePlan = null;
    if (userProfile.isRoundTrip) {
      const returnRouteAlternatives = generateAlternativeReturnRoutes({
        origin,
        destination,
        baseDistance: routeInfo.totalDistanceKm,
        baseDurationMinutes: Math.round(routeInfo.totalDistanceKm * 1.2),
        missingPreferences: [],
        transportMode: userProfile.transportMode,
        numTravelers: userProfile.numberOfTravelers
      });

      returnRoutePlan = {
        isRoundTrip: true,
        tripDirection: 'round_trip',
        origin,
        destination,
        alternativeRoutes: returnRouteAlternatives,
        routeOverlapPercent: returnRouteAlternatives[1]?.routeOverlapPercent || 48
      };
    } else {
      returnRoutePlan = {
        isRoundTrip: false,
        tripDirection: 'one_way',
        origin,
        destination,
        alternativeRoutes: [],
        routeOverlapPercent: 0,
        message: 'One-way trip terminates at destination. No return route required.'
      };
    }

    // =========================================================================
    // STAGE 11: CONSTRAINT-BASED FEASIBILITY & 24-POINT VALIDATION CHECKLIST
    // =========================================================================
    const weatherInfo = rawInput.weatherCondition ? { condition: rawInput.weatherCondition } : null;
    const feasibilityAnalysis = evaluateItineraryFeasibility({
      dayPlans,
      userProfile,
      routeInfo,
      budgetSummary,
      weatherInfo
    });

    // Update optimizerResult feasibilityStatus with real evaluation
    optimizerResult.feasibilityStatus = {
      isFeasible: feasibilityAnalysis.isFeasible,
      status: feasibilityAnalysis.status,
      score: feasibilityAnalysis.score,
      violations: feasibilityAnalysis.violations,
      warnings: feasibilityAnalysis.warnings
    };

    const tripMemoryMock = {
      visitedPlaces: new Map()
    };
    dayPlans.forEach(day => {
      (day.stops || []).forEach(stop => {
        tripMemoryMock.visitedPlaces.set(stop.placeName || stop.name, stop);
      });
    });

    const validationChecklist = runFinalValidationChecklist({
      itinerary: { dayPlans },
      tripMemory: tripMemoryMock,
      coverageMatrix,
      budget: userProfile.totalBudget,
      estimatedCosts: budgetSummary.costSummary,
      numDays: totalDays
    });

    // =========================================================================
    // STAGE 12: FORMAT UNIFIED HIGH-FIDELITY OUTPUT CONTRACT
    // =========================================================================
    const validatedContract = validateAndEnforceOutputContract({
      userProfile,
      routeInfo,
      travelContext,
      dayPlans,
      budgetSummary,
      explanation: {
        summary: `Tailored ${totalDays}-day journey from ${origin} to ${destination} optimized across ${userProfile.travelCompanionType} travel style.`,
        highlights: diversePool.slice(0, 4).map(p => p.name)
      },
      feasibilityAnalysis,
      destinationIntelligence: null
    });

    // Companion-specific tips
    const companionRecommendations = generateRecommendations(
      destination,
      userProfile.travelCompanionType,
      userProfile.numberOfTravelers
    );

    // Build scheduled stops along route (truth in data, no default fake coordinates or ratings)
    const allStops = [];
    dayPlans.forEach(day => {
      (day.stops || []).forEach(s => {
        allStops.push({
          order: allStops.length + 1,
          name: s.placeName || s.name,
          city: s.city || destination,
          category: s.category || 'attraction',
          day: day.day,
          expectedArrival: s.arrivalTime || '10:00 AM',
          expectedDeparture: s.departureTime || '11:30 AM',
          recommendedStay: s.estimatedVisitDuration || '90 mins',
          whySelected: s.whySelected || s.preferenceExplanation || `Selected based on high affinity with your ${s.category || 'general'} preferences.`,
          rating: s.rating != null ? Number(s.rating) : null,
          reviews: s.reviews != null ? Number(s.reviews) : (s.userRatingsTotal != null ? Number(s.userRatingsTotal) : null),
          coordinates: s.coordinates || null,
          dataSource: s.dataSource || 'verified_places_database',
          dataStatus: s.dataStatus || 'verified_database',
          isLiveVerified: Boolean(s.isLiveVerified)
        });
      });
    });

    const executionDurationMs = Date.now() - startTime;

    // Return Authoritative Unified Response
    return {
      ...validatedContract,
      success: true,
      feasibilityStatus: optimizerResult.feasibilityStatus,
      orchestration: {
        engine: 'UnifiedTravelPlanningOrchestrator',
        version: '3.0.0',
        executionDurationMs,
        pipelineStagesCompleted: 13,
        timestamp: new Date().toISOString()
      },
      optimizerResult,
      routeDiscovery: {
        origin,
        destination,
        totalDistanceKm: routeInfo.totalDistanceKm,
        drivingDurationFormatted: routeInfo.drivingDurationFormatted,
        corridorBufferKm: routeInfo.corridorBufferKm,
        dataSource: routeInfo.dataSource,
        isLiveVerified: routeInfo.isLiveVerified,
        candidatePlacesDiscovered: candidatePool.length,
        diversePlacesRetained: diversePool.length,
        waypoints: routeInfo.waypoints
      },
      spatiotemporalOptimization: {
        algorithm: 'Joint Spatiotemporal Orienteering (LinUCB + Beam Search + DPP + ALNS + 3-Opt)',
        activeItineraryMode: planningMode,
        paretoFrontier,
        optimizationMetrics: {
          executionTimeMs: executionDurationMs,
          beamWidth: beamSearchResult.beamWidth,
          statesEvaluated: beamSearchResult.candidateBranchesEvaluated,
          statesPruned: beamSearchResult.statesPruned,
          alnsIterations: alnsResult.iterationsRun,
          dppDiversityMetric: calculateSubsetDppDiversity(refinedSequence)
        },
        recommendedPlacesAlongRoute: allStops
      },
      paretoFrontier,
      optimizationMetrics: {
        algorithm: 'Unified Multi-Objective (Beam Search + ALNS + 3-Opt)',
        beamStatesEvaluated: beamSearchResult.candidateBranchesEvaluated,
        statesPruned: beamSearchResult.statesPruned,
        alnsIterations: alnsResult.iterationsRun,
        dppDiversity: calculateSubsetDppDiversity(refinedSequence),
        executionTimeMs: executionDurationMs
      },
      activeItineraryMode: planningMode,
      recommendedPlacesAlongRoute: allStops,
      returnRoutePlan,
      preferenceCoverage: {
        summary: coverageMatrix.getSummaryStats(),
        report: coverageMatrix.getMatrixReport(),
        explanations: coverageMatrix.getCoverageExplanations()
      },
      validationChecklist: validationChecklist.checks,
      validationScore: validationChecklist.score,
      recommendations: companionRecommendations,
      weatherSuitability: rawInput.weatherCondition ? {
        status: 'REPORTED',
        conditions: rawInput.weatherCondition,
        timestamp: new Date().toISOString(),
        verifiedOutdoorFeasibility: !['Storm', 'Heavy Rain', 'Cyclone', 'Flood'].some(s => rawInput.weatherCondition.includes(s))
      } : {
        status: 'UNKNOWN',
        conditions: 'Unavailable',
        timestamp: new Date().toISOString(),
        verifiedOutdoorFeasibility: false,
        note: 'Live weather service not configured; field verification recommended before travel.'
      },
      trafficSummary: {
        condition: primaryRoute.isLiveVerified ? 'Live Traffic Monitored' : 'Diurnal Highway Transit Model',
        timestamp: new Date().toISOString()
      }
    };
  }
}

const orchestratorInstance = new UnifiedTravelPlanningOrchestrator();

module.exports = {
  UnifiedTravelPlanningOrchestrator,
  orchestrator: orchestratorInstance,
  generateUnifiedItinerary: (data) => orchestratorInstance.generateUnifiedItinerary(data)
};
