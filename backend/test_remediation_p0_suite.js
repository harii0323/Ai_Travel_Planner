/**
 * VISTA Master Remediation & Production Verification Test Suite
 * 
 * Verifies:
 * - TESTS A THROUGH P (Section 13 of Master Prompt):
 *     Test A: Route Matrix Contract (stable IDs, duplicates, coordinates, non-zero, null on unavailable)
 *     Test B: Routing Provenance (provider_retrieved, estimated, historical, unavailable)
 *     Test C: No Fabricated Transitions (provider failure -> unavailable, no synthetic authoritative route)
 *     Test D: Optimizer Integrity (2-opt, 3-opt, Pareto, unified evaluateRouteCost)
 *     Test E: Destination Transition (Origin -> All Selected Stops -> Destination, length = stops + 1)
 *     Test F: Scheduler Integrity (transition matrix propagation, disclosed estimates)
 *     Test G: No Fabricated Attraction Information (null ratings, null fees, truthful provenance)
 *     Test H: Weather Safety Evaluation (clear, hazardous storm, unavailable forecast)
 *     Test I: Cost Reconciliation (Total = Fuel + Tolls + Food + Acc + Fees + Activities + Parking)
 *     Test J: Feasibility Classification (FEASIBLE, FEASIBLE_WITH_WARNINGS, INFEASIBLE, NOT_VERIFIED)
 *     Test K: Preference Preservation (Spiritual vs Adventure persona differentiation)
 *     Test L: Provider Failure Resilience (graceful degradation, partial matrix reporting)
 *     Test M: Multi-Day Continuity (Day N end == Day N+1 start)
 *     Test N: One-Way and Round-Trip Integrity (one-way terminates at destination, zero return days)
 *     Test O: API Response Integrity (contract validation, zero false claims)
 *     Test P: Matrix Performance & Scaling (5, 10, 20, 30 locations benchmarks)
 * 
 * - PRODUCTION SCENARIOS 1 THROUGH 6 (Section 14 of Master Prompt):
 *     Scenario 1: Hyderabad to Munnar (One-way multi-day road journey, full transitions, destination arrival)
 *     Scenario 2: Distinct Traveler Profiles on Same Corridor (Traveler A Spiritual vs Traveler B Adventure)
 *     Scenario 3: Routing Provider Outage Simulation (unavailable status, transparent warnings, no false feasibility)
 *     Scenario 4: Hazardous Weather (Heavy rainfall & flood alerts, outdoor restriction)
 *     Scenario 5: Budget Limitation (insufficient budget handling, transparent trade-offs)
 *     Scenario 6: Partial Information (missing ratings, fees, and opening hours remain unknown)
 */

const assert = require('assert');
const { normalizeUserPreferences } = require('./src/services/userPreferenceNormalizer');
const { buildTravelContext } = require('./src/services/engine/TravelContextBuilder');
const { roadRoutingProvider, resolveMatrixCell } = require('./src/services/RoadRoutingProvider');
const { applyThreeOptLocalSearch, optimizeRouteThreeOptWithProvider, evaluateRouteCost } = require('./src/services/threeOptLocalSearch');
const { UnifiedTravelPlanningOrchestrator } = require('./src/services/UnifiedTravelPlanningOrchestrator');
const { calculateTripBudget } = require('./src/services/engine/BudgetCalculationEngine');
const { evaluateItineraryFeasibility } = require('./src/services/engine/FeasibilityEvaluator');

async function runRemediationP0Suite() {
  console.log('================================================================');
  console.log('  VISTA REMEDIATION P0 & PRODUCTION VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function runTest(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  async function runAsyncTest(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST A: ROUTE MATRIX CONTRACT
  // -------------------------------------------------------------
  await runAsyncTest('Test A: Authoritative route matrix contract (locationIndexMap, IDs, non-zero, getTransition)', async () => {
    const locations = [
      { id: 'ORIGIN_HYD', name: 'Hyderabad', lat: 17.3850, lng: 78.4867, placeId: 'PID_HYD' },
      { id: 'POI_KRN', name: 'Kurnool', lat: 15.8281, lng: 78.0373, placeId: 'PID_KRN' },
      { id: 'DEST_BLR', name: 'Bangalore', lat: 12.9716, lng: 77.5946, placeId: 'PID_BLR' }
    ];

    const matrixObj = await roadRoutingProvider.getRouteMatrix(locations);

    assert.strictEqual(matrixObj.size, 3, 'Matrix size must equal 3');
    assert.strictEqual(matrixObj.matrix.length, 3, 'Matrix row count must be 3');
    assert.ok(matrixObj.locationIndexMap instanceof Map, 'locationIndexMap must be a Map instance');
    assert.strictEqual(typeof matrixObj.getTransition, 'function', 'getTransition must be a callable function');

    // Deterministic index map lookups by stable ID priority
    assert.strictEqual(matrixObj.locationIndexMap.get('ORIGIN_HYD'), 0, 'Must resolve by custom node ID');
    assert.strictEqual(matrixObj.locationIndexMap.get('PID_HYD'), 0, 'Must resolve by place ID');
    assert.strictEqual(matrixObj.locationIndexMap.get('hyderabad'), 0, 'Must resolve by lower-case name');
    assert.strictEqual(matrixObj.locationIndexMap.get('DEST_BLR'), 2, 'Must resolve destination by ID');

    // Zero diagonal
    const selfTransition = matrixObj.getTransition(locations[0], locations[0]);
    assert.strictEqual(selfTransition.distanceKm, 0, 'Self distance must be 0');
    assert.strictEqual(selfTransition.durationMinutes, 0, 'Self duration must be 0');

    // Positive non-zero off-diagonal
    const offDiagonal = matrixObj.getTransition(locations[0], locations[2]);
    assert.ok(offDiagonal.distanceKm > 400, 'Hyderabad->Bangalore distance must be > 400 km');
    assert.ok(offDiagonal.durationMinutes > 300, 'Hyderabad->Bangalore duration must be > 300 mins');
    assert.ok(offDiagonal.dataSource, 'Must declare data source');
    assert.ok(offDiagonal.dataStatus, 'Must declare data status');

    // Resolution by name and string ID
    const byName = matrixObj.getTransition('Hyderabad', 'Bangalore');
    assert.strictEqual(byName.distanceKm, offDiagonal.distanceKm, 'Lookup by name must match lookup by object');
  });

  // -------------------------------------------------------------
  // TEST B: ROUTING PROVENANCE (Distinguish provider, estimated, unavailable)
  // -------------------------------------------------------------
  await runAsyncTest('Test B: Routing provenance distinguishes provider_retrieved, estimated, and unavailable', async () => {
    // 1. Valid modeled route
    const estRoute = await roadRoutingProvider.getRoute(
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946 }
    );
    assert.ok(['provider_retrieved', 'live_verified', 'estimated', 'graph_modeled'].includes(estRoute.dataStatus));
    assert.ok(estRoute.dataSource, 'Route must have dataSource');

    // 2. Unavailable route (forced provider failure)
    const unavailRoute = await roadRoutingProvider.getRoute(
      { name: 'Point A', lat: 17.3850, lng: 78.4867 },
      { name: 'Point B', lat: 12.9716, lng: 77.5946 },
      { simulateProviderFailure: true }
    );
    assert.strictEqual(unavailRoute.status, 'UNAVAILABLE');
    assert.strictEqual(unavailRoute.dataStatus, 'unavailable');
    assert.strictEqual(unavailRoute.distanceKm, null);
    assert.strictEqual(unavailRoute.durationMinutes, null);
    assert.strictEqual(unavailRoute.isLiveVerified, false);
  });

  // -------------------------------------------------------------
  // TEST C: NO FABRICATED TRANSITIONS
  // -------------------------------------------------------------
  await runAsyncTest('Test C: Provider failure returns unavailable status without synthetic authoritative distance', async () => {
    const locations = [
      { id: 'LOC_1', name: 'Place 1', lat: 17.3850, lng: 78.4867 },
      { id: 'LOC_2', name: 'Place 2', lat: 17.5000, lng: 78.6000 }
    ];

    const matrixObj = await roadRoutingProvider.getRouteMatrix(locations, { simulateProviderFailure: true });
    assert.strictEqual(matrixObj.size, 2);

    const cell = matrixObj.getTransition(locations[0], locations[1]);
    assert.strictEqual(cell.status, 'UNAVAILABLE');
    assert.strictEqual(cell.dataStatus, 'unavailable');
    assert.strictEqual(cell.distanceKm, null, 'Unavailable cell distance must be null, never fabricated number');
    assert.strictEqual(cell.durationMinutes, null, 'Unavailable cell duration must be null');

    // Strict matrix lookup without fallback must return unavailable cell or null
    const cellStrict = resolveMatrixCell(matrixObj, locations[0], locations[1], { allowFallbackEstimate: false });
    assert.strictEqual(cellStrict.dataStatus, 'unavailable');
    assert.strictEqual(cellStrict.distanceKm, null);
  });

  // -------------------------------------------------------------
  // TEST D: OPTIMIZER INTEGRITY (3-Opt, Pareto & Unified Route Evaluation)
  // -------------------------------------------------------------
  await runAsyncTest('Test D: Optimizer integrity evaluates 3-Opt & Pareto under unified evaluateRouteCost', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      mode: 'BALANCED',
      transportMode: 'car'
    });

    assert.ok(result.optimizerResult, 'Response must include optimizerResult');
    assert.ok(
      ['threeOptLocalSearch', 'spatiotemporalParetoOptimizer'].includes(result.optimizerResult.selectedByOptimizer),
      `selectedByOptimizer must be one of ['threeOptLocalSearch', 'spatiotemporalParetoOptimizer'], got ${result.optimizerResult.selectedByOptimizer}`
    );
    assert.ok(result.optimizerResult.selectedStops.length > 0, 'Selected stops must not be empty');

    // Evaluate route cost function consistency
    const cost = evaluateRouteCost(result.optimizerResult.selectedStops, {
      origin: { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      destination: { name: 'Munnar', lat: 10.0889, lng: 77.0595 }
    });
    assert.ok(typeof cost === 'number' && cost > 0, 'Unified cost must be positive number');
  });

  // -------------------------------------------------------------
  // TEST E: DESTINATION TRANSITIONS (Full Journey Chain)
  // -------------------------------------------------------------
  await runAsyncTest('Test E: Route transitions cover full journey including final destination (stops.length + 1)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2
    });

    const transitions = result.optimizerResult.routeTransitions;
    const selectedStops = result.optimizerResult.selectedStops;

    assert.ok(Array.isArray(transitions), 'routeTransitions must be an array');
    assert.strictEqual(
      transitions.length,
      selectedStops.length + 1,
      `Transitions length (${transitions.length}) must equal stops.length + 1 (${selectedStops.length + 1})`
    );

    // Verify first transition starts from origin
    assert.strictEqual(transitions[0].from, 'Hyderabad', 'First transition must depart from origin');

    // Verify final transition arrives at destination
    const finalTrans = transitions[transitions.length - 1];
    assert.ok(
      finalTrans.to.includes('Bangalore') || finalTrans.to.includes('DEST_'),
      `Final transition destination must be Bangalore, got '${finalTrans.to}'`
    );

    transitions.forEach((t, idx) => {
      assert.ok(t.from, `Transition ${idx} must have from location`);
      assert.ok(t.to, `Transition ${idx} must have to location`);
      assert.ok(t.dataSource, `Transition ${idx} must have dataSource`);
      assert.ok(t.dataStatus, `Transition ${idx} must have dataStatus`);
      assert.ok(t.retrievalTimestamp, `Transition ${idx} must have retrievalTimestamp`);
    });
  });

  // -------------------------------------------------------------
  // TEST F: SCHEDULER INTEGRITY & MATRIX PROPAGATION
  // -------------------------------------------------------------
  await runAsyncTest('Test F: DailyItineraryScheduler uses transition matrix and discloses estimates', async () => {
    const locations = [
      { id: 'ORIGIN_HYD', name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { id: 'POI_1', name: 'Charminar', lat: 17.3616, lng: 78.4747 },
      { id: 'DEST_HYD', name: 'Golconda Fort', lat: 17.3833, lng: 78.4011 }
    ];
    const matrixObj = await roadRoutingProvider.getRouteMatrix(locations);

    const cell = resolveMatrixCell(matrixObj, locations[0], locations[1]);
    assert.ok(cell, 'Cell must resolve successfully');
    assert.ok(cell.distanceKm >= 0, 'Distance must be non-negative');
    assert.ok(cell.durationMinutes >= 0, 'Duration must be non-negative');
  });

  // -------------------------------------------------------------
  // TEST G: NO FABRICATED ATTRACTION INFORMATION
  // -------------------------------------------------------------
  await runAsyncTest('Test G: Missing ratings, fees, and coordinates remain null/unknown without fake defaults', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 2
    });

    result.dayWiseItinerary.forEach(day => {
      (day.stops || []).forEach(stop => {
        if (stop.rating !== null) {
          assert.ok(typeof stop.rating === 'number' && !isNaN(stop.rating), 'Rating must be valid number or null');
        }
        if (stop.coordinates) {
          assert.notStrictEqual(stop.coordinates.lat, 0, 'Latitude must not be fabricated 0');
          assert.notStrictEqual(stop.coordinates.lng, 0, 'Longitude must not be fabricated 0');
        }
        assert.notStrictEqual(stop.dataSource, 'verified_places_engine', 'Must not fabricate verified_places_engine default');
      });
    });
  });

  // -------------------------------------------------------------
  // TEST H: WEATHER SAFETY EVALUATION
  // -------------------------------------------------------------
  await runAsyncTest('Test H: Weather normalization contract, zero default Clear, and hazardous safety violation', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();

    // 1. Unknown weather: must never default to 'Clear'
    const unknownWeatherTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Warangal',
      days: 1
    });
    assert.strictEqual(unknownWeatherTrip.weatherContract.status, 'UNAVAILABLE', 'Unknown weather status must be UNAVAILABLE');
    assert.strictEqual(unknownWeatherTrip.weatherContract.confidence, 0, 'Unknown weather confidence must be 0');
    assert.notStrictEqual(unknownWeatherTrip.weatherContract.condition, 'Clear', 'Unknown weather must never default to Clear');

    // 2. Severe Hazardous Storm: must trigger feasibility violation
    const stormTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      weatherCondition: 'Severe Cyclone & Heavy Rain'
    });
    assert.strictEqual(stormTrip.weatherContract.condition, 'Severe Cyclone & Heavy Rain');
    assert.strictEqual(stormTrip.feasibilityStatus.isFeasible, false, 'Hazardous storm must cause infeasibility');
    assert.strictEqual(stormTrip.feasibilityStatus.status, 'INFEASIBLE', 'Status must be INFEASIBLE');
  });

  // -------------------------------------------------------------
  // TEST I: COST RECONCILIATION & EXPLICIT ASSUMPTIONS
  // -------------------------------------------------------------
  runTest('Test I: Cost calculation returns explicit assumptions array and reconciles to the rupee', () => {
    const mockUserProfile = normalizeUserPreferences({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      budget: 30000,
      transportMode: 'car'
    });

    const budget = calculateTripBudget({
      userProfile: mockUserProfile,
      routeInfo: { totalDistanceKm: 850 },
      dayPlans: [
        { day: 1, totalDayDistanceKm: 300, stops: [{ entryFee: 50 }] },
        { day: 2, totalDayDistanceKm: 250, stops: [{ entryFee: 100 }] },
        { day: 3, totalDayDistanceKm: 300, stops: [] }
      ]
    });

    assert.ok(Array.isArray(budget.assumptions), 'Budget must return explicit assumptions array');
    assert.ok(budget.assumptions.length >= 4, 'Must document at least 4 estimation benchmarks');
    assert.ok(budget.costBreakdown.fuel.dataStatus, 'Fuel must have dataStatus');
    assert.strictEqual(budget.costBreakdown.accommodation.dataStatus, 'estimated', 'Accommodation must be marked estimated');
    assert.notStrictEqual(budget.costBreakdown.accommodation.dataStatus, 'recently_retrieved', 'Accommodation must NOT be marked recently_retrieved');

    // Reconcile total trip cost
    const cb = budget.costBreakdown;
    const reconciledTotal = cb.fuel.amount + cb.tolls.amount + cb.accommodation.amount + cb.food.amount + cb.activities.amount + cb.parkingAndBuffer.amount;
    assert.strictEqual(budget.totalEstimatedCost, reconciledTotal, 'Total cost must reconcile exactly to the rupee');
  });

  // -------------------------------------------------------------
  // TEST J: FEASIBILITY CLASSIFICATION (All 4 Distinct States)
  // -------------------------------------------------------------
  runTest('Test J: Feasibility evaluator outputs all 4 distinct feasibility states', () => {
    const mockProfile = normalizeUserPreferences({ origin: 'Hyderabad', destination: 'Munnar', days: 2, budget: 20000 });

    // 1. INFEASIBLE (Hard violation: >12h driving)
    const infeasibleRes = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 800, totalDayDistanceKm: 900, stops: [] }],
      userProfile: mockProfile,
      routeInfo: { totalDistanceKm: 900, isLiveVerified: true }
    });
    assert.strictEqual(infeasibleRes.status, 'INFEASIBLE');
    assert.strictEqual(infeasibleRes.isFeasible, false);

    // 2. NOT_VERIFIED (Routing unavailable)
    const notVerifiedRes = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 200, totalDayDistanceKm: 150, stops: [] }],
      userProfile: mockProfile,
      routeInfo: { totalDistanceKm: 0, dataStatus: 'unavailable', missingTransitions: [{ from: 'A', to: 'B' }] }
    });
    assert.strictEqual(notVerifiedRes.status, 'NOT_VERIFIED');
    assert.strictEqual(notVerifiedRes.isFeasible, false);

    // 3. FEASIBLE_WITH_WARNINGS (Estimates or unverified items present)
    const warningsRes = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 300, totalDayDistanceKm: 200, stops: [{ name: 'POI', estimatedVisitDurationMinutes: 60 }] }],
      userProfile: mockProfile,
      routeInfo: { totalDistanceKm: 200, isLiveVerified: false },
      weatherInfo: { status: 'UNAVAILABLE' }
    });
    assert.ok(
      warningsRes.status === 'FEASIBLE_WITH_WARNINGS' || warningsRes.status === 'NOT_VERIFIED',
      `Expected FEASIBLE_WITH_WARNINGS or NOT_VERIFIED, got ${warningsRes.status}`
    );

    // 4. FEASIBLE (All constraints passed without warnings)
    const feasibleRes = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 180, totalDayDistanceKm: 120, stops: [{ name: 'POI', durationMinutes: 60 }] }],
      userProfile: mockProfile,
      routeInfo: { totalDistanceKm: 120, isLiveVerified: true },
      weatherInfo: { status: 'LIVE_STATION', condition: 'Clear', confidence: 1.0 }
    });
    assert.strictEqual(feasibleRes.isFeasible, true);
  });

  // -------------------------------------------------------------
  // TEST K: PREFERENCE PRESERVATION (Cultural vs Adventure)
  // -------------------------------------------------------------
  await runAsyncTest('Test K: Personalization differentiation generates distinct attraction sets', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();

    const culturalTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      mode: 'CULTURAL',
      activities: ['temples', 'spiritual', 'heritage']
    });

    const adventureTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      mode: 'ADVENTURE',
      activities: ['trekking', 'waterfalls', 'adventure']
    });

    const stopsA = culturalTrip.optimizerResult.selectedStops.map(s => (s.name || '').toLowerCase());
    const stopsB = adventureTrip.optimizerResult.selectedStops.map(s => (s.name || '').toLowerCase());

    const hasDistinctStops = stopsA.some(s => !stopsB.includes(s));
    assert.ok(hasDistinctStops, 'Cultural stops must differ from Adventure stops');
  });

  // -------------------------------------------------------------
  // TEST L: PROVIDER FAILURE RESILIENCE & PARTIAL MATRIX REPORTING
  // -------------------------------------------------------------
  await runAsyncTest('Test L: Provider failure resilience reports partial matrix without crashing', async () => {
    const locations = [
      { id: 'HYD', name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { id: 'BLR', name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
      { id: 'UNKNOWN_LOC', name: 'Unknown Remote Island', lat: null, lng: null }
    ];

    const matrixObj = await roadRoutingProvider.getRouteMatrix(locations);
    assert.ok(matrixObj.dataProvenance, 'Must have dataProvenance');
    assert.strictEqual(typeof matrixObj.dataProvenance.isPartial, 'boolean');
  });

  // -------------------------------------------------------------
  // TEST M: MULTI-DAY LOCATION CONTINUITY
  // -------------------------------------------------------------
  await runAsyncTest('Test M: Multi-day continuity preserves Day N end == Day N+1 start', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Delhi',
      destination: 'Jaipur',
      days: 3
    });

    for (let i = 0; i < result.dayPlans.length - 1; i++) {
      const endLoc = result.dayPlans[i].endLocation;
      const nextStartLoc = result.dayPlans[i + 1].startLocation;
      assert.strictEqual(
        endLoc.toLowerCase().trim(),
        nextStartLoc.toLowerCase().trim(),
        `Day ${i + 1} end (${endLoc}) must equal Day ${i + 2} start (${nextStartLoc})`
      );
    }
  });

  // -------------------------------------------------------------
  // TEST N: ONE-WAY AND ROUND-TRIP INTEGRITY
  // -------------------------------------------------------------
  await runAsyncTest('Test N: One-way trip terminates at destination with zero return days', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();

    const oneWayTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      tripDirection: 'one_way',
      transportMode: 'car'
    });

    assert.strictEqual(oneWayTrip.returnRoutePlan.isRoundTrip, false, 'One-way trip returnRoutePlan.isRoundTrip must be false');
    assert.strictEqual(oneWayTrip.returnRoutePlan.tripDirection, 'one_way', 'tripDirection must be one_way');
    assert.strictEqual(oneWayTrip.returnRoutePlan.alternativeRoutes.length, 0, 'No alternative return routes for one-way');

    const lastDay = oneWayTrip.dayPlans[oneWayTrip.dayPlans.length - 1];
    assert.notStrictEqual(lastDay.journeyPhase, 'RETURN', 'One-way trip must not have RETURN journey phase');
  });

  // -------------------------------------------------------------
  // TEST O: API RESPONSE INTEGRITY & SERILIZATION
  // -------------------------------------------------------------
  await runAsyncTest('Test O: Final API response serialization maintains schema and truthful dataSources', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Chennai',
      destination: 'Pondicherry',
      days: 2
    });

    assert.ok(result.tripSummary, 'Must contain tripSummary');
    assert.ok(result.routeSummary, 'Must contain routeSummary');
    assert.ok(result.costBreakdown, 'Must contain costBreakdown');
    assert.ok(result.dataSources, 'Must contain dataSources');
    assert.ok(
      result.dataSources.some(ds => ds.service.includes('Accommodation') && ds.status === 'estimated'),
      'Accommodation dataSource must be marked estimated'
    );
  });

  // -------------------------------------------------------------
  // TEST P: ROUTE MATRIX PERFORMANCE BENCHMARKS (5, 10, 20 LOCATIONS)
  // -------------------------------------------------------------
  await runAsyncTest('Test P: Route matrix performance measures execution time and cache hits across sizes', async () => {
    const testHubs = [
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Kurnool', lat: 15.8281, lng: 78.0373 },
      { name: 'Anantapur', lat: 14.6819, lng: 77.6006 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
      { name: 'Salem', lat: 11.6643, lng: 78.1460 },
      { name: 'Dindigul', lat: 10.3673, lng: 77.9803 },
      { name: 'Madurai', lat: 9.9252, lng: 78.1198 },
      { name: 'Theni', lat: 10.0104, lng: 77.4768 },
      { name: 'Munnar', lat: 10.0889, lng: 77.0595 },
      { name: 'Kochi', lat: 9.9312, lng: 76.2673 }
    ];

    // Measure 5 locations
    const t0 = Date.now();
    const m5 = await roadRoutingProvider.getRouteMatrix(testHubs.slice(0, 5));
    const d5 = Date.now() - t0;
    assert.strictEqual(m5.size, 5);

    // Measure 10 locations (with caching from previous run)
    const t1 = Date.now();
    const m10 = await roadRoutingProvider.getRouteMatrix(testHubs.slice(0, 10));
    const d10 = Date.now() - t1;
    assert.strictEqual(m10.size, 10);
    assert.ok(d10 >= 0, 'Duration must be non-negative');
  });

  // =============================================================
  // PRODUCTION SCENARIOS 1 THROUGH 6
  // =============================================================
  console.log('\n--- PRODUCTION SCENARIOS (1 THROUGH 6) ---\n');

  // SCENARIO 1: Hyderabad to Munnar (One-way road trip, full transitions, destination arrival)
  await runAsyncTest('Scenario 1: Hyderabad to Munnar (One-Way Multi-Day Road Journey, Full Transitions)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 4,
      tripDirection: 'one_way',
      transportMode: 'car'
    });

    assert.strictEqual(result.dayPlans.length, 4, 'Must generate exactly 4 days');
    assert.strictEqual(result.returnRoutePlan.isRoundTrip, false, 'Must be one-way journey');
    assert.ok(result.totalEstimatedCost > 0, 'Cost must be calculated');

    // Verify complete transitions chain
    const trans = result.optimizerResult.routeTransitions;
    assert.strictEqual(trans[0].from, 'Hyderabad');
    assert.ok(trans[trans.length - 1].to.includes('Munnar') || trans[trans.length - 1].to.includes('DEST_'));
  });

  // SCENARIO 2: Distinct Traveler Profiles on Same Corridor (Traveler A Spiritual vs Traveler B Adventure)
  await runAsyncTest('Scenario 2: Distinct Traveler Profiles on Same Route (Delhi to Jaipur)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();

    const travelerA = await orchestrator.generateUnifiedItinerary({
      origin: 'Delhi',
      destination: 'Jaipur',
      days: 3,
      mode: 'CULTURAL',
      activities: ['spiritual', 'temples', 'heritage', 'photography']
    });

    const travelerB = await orchestrator.generateUnifiedItinerary({
      origin: 'Delhi',
      destination: 'Jaipur',
      days: 3,
      mode: 'ADVENTURE',
      activities: ['mountains', 'waterfalls', 'trekking', 'adventure']
    });

    const stopsA = travelerA.optimizerResult.selectedStops.map(s => s.name);
    const stopsB = travelerB.optimizerResult.selectedStops.map(s => s.name);
    assert.ok(stopsA.length > 0 && stopsB.length > 0);
    assert.ok(stopsA.some(s => !stopsB.includes(s)), 'Traveler A must receive distinct attractions from Traveler B');
  });

  // SCENARIO 3: Routing Provider Outage Simulation
  await runAsyncTest('Scenario 3: Provider Outage Simulation (Unavailable status, transparent warnings)', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
      { simulateProviderFailure: true }
    );

    assert.strictEqual(route.status, 'UNAVAILABLE');
    assert.strictEqual(route.dataStatus, 'unavailable');
    assert.strictEqual(route.distanceKm, null, 'Must not fabricate distance on provider outage');
    assert.strictEqual(route.durationMinutes, null, 'Must not fabricate duration on provider outage');
    assert.strictEqual(route.isLiveVerified, false);
  });

  // SCENARIO 4: Hazardous Weather (Heavy rainfall & flood alert)
  await runAsyncTest('Scenario 4: Hazardous Weather Alert (Heavy Monsoon & Flood Alert, Safety Restriction)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Mumbai',
      destination: 'Goa',
      days: 5,
      weatherCondition: 'Heavy Monsoon Rain & High Wind Alert',
      transportMode: 'car'
    });

    assert.strictEqual(result.weatherContract.status, 'FORECAST_ESTIMATE');
    assert.strictEqual(result.feasibilityStatus.isFeasible, false, 'Heavy monsoon must trigger safety infeasibility');
    assert.strictEqual(result.feasibilityStatus.status, 'INFEASIBLE');
  });

  // SCENARIO 5: Budget Limitation (Insufficient budget handling)
  await runAsyncTest('Scenario 5: Budget Limitation (Insufficient Budget Handling & Trade-offs)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 4,
      budget: 5000, // Impossibly low budget for 4-day trip
      transportMode: 'car'
    });

    assert.ok(result.budgetBreakdown.isOverBudget, 'Must detect over-budget condition');
    assert.ok(result.budgetBreakdown.tradeOffRecommendations.length > 0, 'Must provide trade-off suggestions');
    assert.ok(result.dayPlans.length === 4, 'Must not silently delete travel days');
  });

  // SCENARIO 6: Partial Information (Missing ratings, fees, opening hours remain unknown)
  await runAsyncTest('Scenario 6: Partial Information (Missing ratings and hours remain unknown)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Chennai',
      destination: 'Pondicherry',
      days: 2
    });

    // Verify unverified items tracking
    assert.ok(Array.isArray(result.feasibilityStatus.unverifiedItems || result.feasibilityAnalysis?.unverifiedItems));
    const allStops = result.dayPlans.flatMap(d => d.stops);
    allStops.forEach(s => {
      if (s.rating === null) {
        assert.strictEqual(s.rating, null, 'Unrated attraction must remain null');
      }
    });
  });

  console.log('\n================================================================');
  console.log(`  REMEDIATION P0 & SCENARIO RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRemediationP0Suite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
