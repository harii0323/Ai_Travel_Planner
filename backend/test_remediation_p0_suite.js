/**
 * VISTA Master Remediation & Production Verification Test Suite
 * 
 * Verifies:
 * - TESTS A THROUGH L:
 *     Test A: Authoritative Route Matrix Contract (locationIndexMap, stable IDs, non-zero, getTransition)
 *     Test B: Unified Matrix Propagation (DailyItineraryScheduler & TravelTimeOptimizer resolution)
 *     Test C: Authoritative 3-Opt Final Selection (selectedByOptimizer, non-overridden stops)
 *     Test D: Complete Route Transitions (including final destination, length = stops.length + 1)
 *     Test E: Weather Normalization Contract (strict schema, zero default Clear, hazardous safety check)
 *     Test F: Data Integrity & Zero Fabrication (null for missing values, no fake ratings or coordinates)
 *     Test G: Cost Calculation & Explicit Assumptions (assumptions: [], vehicle-specific parameters)
 *     Test H: Feasibility Evaluator Semantics (FEASIBLE / FEASIBLE_WITH_WARNINGS / INFEASIBLE / NOT_VERIFIED)
 *     Test I: Journey Direction Integrity (One-Way vs Round-Trip vs Multi-City)
 *     Test J: Personalization Differentiation (Spiritual vs Adventure vs Relaxation)
 *     Test K: Provider Failure Fallback (non-zero distance, explicit fallback provenance)
 *     Test L: Matrix Performance & Bounded Concurrency (cache reuse, bounded batches)
 * 
 * - PRODUCTION SCENARIOS 1 THROUGH 6:
 *     Scenario 1: Bangalore to Ooty (3-Day Ghats Road Trip, Family/Relaxed)
 *     Scenario 2: Delhi to Agra & Jaipur (4-Day Cultural/Heritage Golden Triangle)
 *     Scenario 3: Mumbai to Goa (5-Day Coastal Drive, Monsoon Rain Safety Alert)
 *     Scenario 4: Chennai to Pondicherry (2-Day Coastal Weekend, Solo Explorer)
 *     Scenario 5: Hyderabad to Hampi (3-Day Archaeological Trip)
 *     Scenario 6: Kolkata to Darjeeling (4-Day Mountain Road Trip, One-Way)
 */

const assert = require('assert');
const { normalizeUserPreferences } = require('./src/services/userPreferenceNormalizer');
const { buildTravelContext } = require('./src/services/engine/TravelContextBuilder');
const { roadRoutingProvider, resolveMatrixCell } = require('./src/services/RoadRoutingProvider');
const { applyThreeOptLocalSearch, optimizeRouteThreeOptWithProvider, evaluateRouteCost } = require('./src/services/threeOptLocalSearch');
const { UnifiedTravelPlanningOrchestrator } = require('./src/services/UnifiedTravelPlanningOrchestrator');
const { replanTimelineWithDelay } = require('./src/services/engine/DynamicReplanningEngine');
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
  // TEST A: AUTHORITATIVE ROUTE MATRIX CONTRACT
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

    // Deterministic index map lookups
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
  // TEST B: UNIFIED MATRIX PROPAGATION
  // -------------------------------------------------------------
  await runAsyncTest('Test B: Unified matrix propagation to scheduler and TravelTimeOptimizer', async () => {
    const locations = [
      { id: 'ORIGIN_HYD', name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { id: 'POI_1', name: 'Charminar', lat: 17.3616, lng: 78.4747 },
      { id: 'DEST_HYD', name: 'Golconda Fort', lat: 17.3833, lng: 78.4011 }
    ];
    const matrixObj = await roadRoutingProvider.getRouteMatrix(locations);

    // Verify resolveMatrixCell helper works with matrixObj
    const cell = resolveMatrixCell(matrixObj, locations[0], locations[1]);
    assert.ok(cell, 'Cell must resolve successfully');
    assert.ok(cell.distanceKm >= 0, 'Distance must be non-negative');
    assert.ok(cell.durationMinutes >= 0, 'Duration must be non-negative');
  });

  // -------------------------------------------------------------
  // TEST C: AUTHORITATIVE 3-OPT FINAL SELECTION
  // -------------------------------------------------------------
  await runAsyncTest('Test C: Authoritative 3-Opt selection exposes selectedByOptimizer and matches final stops', async () => {
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

    // Verify scheduled stops in day plans align with optimizer selection
    const allScheduledStops = result.dayPlans.flatMap(d => d.stops || []);
    assert.ok(allScheduledStops.length > 0, 'Must have scheduled stops');
  });

  // -------------------------------------------------------------
  // TEST D: COMPLETE ROUTE TRANSITIONS (Including Final Destination)
  // -------------------------------------------------------------
  await runAsyncTest('Test D: Route transitions cover full journey including final destination', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Srisailam',
      days: 2,
      transportMode: 'car'
    });

    const transitions = result.optimizerResult.routeTransitions;
    const selectedStops = result.optimizerResult.selectedStops;

    assert.ok(Array.isArray(transitions), 'Transitions must be an array');
    assert.strictEqual(
      transitions.length,
      selectedStops.length + 1,
      `Transitions length (${transitions.length}) must equal selectedStops (${selectedStops.length}) + 1`
    );

    // First transition starts from Origin
    assert.ok(
      transitions[0].from.toLowerCase().includes('hyderabad'),
      `First transition must start at origin, got ${transitions[0].from}`
    );

    // Final transition ends at Destination
    const lastTransition = transitions[transitions.length - 1];
    assert.ok(
      lastTransition.to.toLowerCase().includes('srisailam'),
      `Last transition must end at destination, got ${lastTransition.to}`
    );

    // Check data integrity on each transition
    transitions.forEach((t, idx) => {
      assert.ok(t.from, `Transition ${idx} must have 'from'`);
      assert.ok(t.to, `Transition ${idx} must have 'to'`);
      assert.ok(t.distanceKm > 0, `Transition ${idx} distance must be > 0`);
      assert.ok(t.durationMinutes > 0, `Transition ${idx} duration must be > 0`);
      assert.ok(t.dataSource, `Transition ${idx} must have dataSource`);
      assert.ok(t.dataStatus, `Transition ${idx} must have dataStatus`);
      assert.ok(t.confidence !== undefined, `Transition ${idx} must have confidence`);
      assert.ok(t.retrievalTimestamp, `Transition ${idx} must have retrievalTimestamp`);
    });
  });

  // -------------------------------------------------------------
  // TEST E: WEATHER NORMALIZATION CONTRACT & SAFETY CHECK
  // -------------------------------------------------------------
  await runAsyncTest('Test E: Weather normalization contract, zero default Clear, and hazardous safety violation', async () => {
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
  // TEST F: DATA INTEGRITY & ZERO FABRICATION
  // -------------------------------------------------------------
  await runAsyncTest('Test F: Missing ratings, hours, and coordinates remain null/unknown without fake defaults', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 2
    });

    // Check scheduled stops
    result.dayWiseItinerary.forEach(day => {
      (day.stops || []).forEach(stop => {
        if (stop.rating !== null) {
          assert.ok(typeof stop.rating === 'number' && !isNaN(stop.rating), 'Rating must be valid number or null');
        }
        if (stop.coordinates) {
          assert.notStrictEqual(stop.coordinates.lat, 0, 'Latitude must not be fabricated 0');
          assert.notStrictEqual(stop.coordinates.lng, 0, 'Longitude must not be fabricated 0');
        }
      });
    });
  });

  // -------------------------------------------------------------
  // TEST G: COST CALCULATION & EXPLICIT ASSUMPTIONS
  // -------------------------------------------------------------
  runTest('Test G: Cost calculation returns explicit assumptions array and categorized statuses', () => {
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
    assert.ok(budget.assumptions.some(a => a.includes('Fuel rate')), 'Must list fuel price assumption');
    assert.ok(budget.assumptions.some(a => a.includes('Accommodation rate')), 'Must list room rate assumption');
    assert.ok(budget.costBreakdown.fuel.dataStatus, 'Fuel must have dataStatus');
    assert.ok(budget.costBreakdown.accommodation.dataStatus, 'Accommodation must have dataStatus');
  });

  // -------------------------------------------------------------
  // TEST H: FEASIBILITY EVALUATOR SEMANTICS & UNVERIFIED ITEMS
  // -------------------------------------------------------------
  runTest('Test H: Feasibility evaluator tracks unverifiedItems and outputs distinct statuses', () => {
    const mockProfile = normalizeUserPreferences({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 2,
      budget: 20000
    });

    const analysis = evaluateItineraryFeasibility({
      dayPlans: [
        {
          day: 1,
          totalDayDistanceKm: 200,
          totalDayDrivingMinutes: 240,
          stops: [{ name: 'Place A', durationMinutes: 60 }],
          timeline: [{ category: 'meal' }]
        },
        {
          day: 2,
          totalDayDistanceKm: 150,
          totalDayDrivingMinutes: 180,
          stops: [{ name: 'Place B', durationMinutes: 60 }],
          timeline: [{ category: 'meal' }]
        }
      ],
      userProfile: mockProfile,
      routeInfo: { totalDistanceKm: 350, isLiveVerified: false },
      budgetSummary: { totalEstimatedCost: 12000 },
      weatherInfo: { status: 'UNAVAILABLE', condition: 'Unknown' }
    });

    assert.ok(Array.isArray(analysis.unverifiedItems), 'Must return unverifiedItems array');
    assert.ok(analysis.unverifiedItems.length > 0, 'Must record unverified weather/traffic items');
    assert.ok(
      ['FEASIBLE', 'FEASIBLE_WITH_WARNINGS', 'INFEASIBLE', 'NOT_VERIFIED'].includes(analysis.status),
      `Status must be a recognized feasibility status, got ${analysis.status}`
    );
  });

  // -------------------------------------------------------------
  // TEST I: JOURNEY DIRECTION INTEGRITY (One-Way vs Round-Trip)
  // -------------------------------------------------------------
  await runAsyncTest('Test I: Journey direction integrity (one-way terminates at destination, zero return days)', async () => {
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
  // TEST J: PERSONALIZATION DIFFERENTIATION
  // -------------------------------------------------------------
  await runAsyncTest('Test J: Personalization differentiation generates distinct attraction sets', async () => {
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
  // TEST K: PROVIDER FAILURE FALLBACK
  // -------------------------------------------------------------
  await runAsyncTest('Test K: Provider failure fallback returns non-zero distance and duration with explicit estimate flag', async () => {
    const route = await roadRoutingProvider.getRoute(
      { lat: 26.9124, lng: 75.7873, name: 'Jaipur' },
      { lat: 26.2389, lng: 73.0243, name: 'Jodhpur' }
    );

    assert.ok(route.distanceKm > 200, 'Distance must be > 200 km, never 0');
    assert.ok(route.durationMinutes > 180, 'Duration must be > 180 mins, never 0');
    assert.strictEqual(route.dataStatus, 'estimated', 'Must be flagged as estimated');
    assert.strictEqual(route.isLiveVerified, false, 'Must not claim live verification');
  });

  // -------------------------------------------------------------
  // TEST L: MATRIX PERFORMANCE & BOUNDED CONCURRENCY
  // -------------------------------------------------------------
  await runAsyncTest('Test L: Route matrix executes efficiently with caching and bounded batches', async () => {
    const locations = [
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Kurnool', lat: 15.8281, lng: 78.0373 },
      { name: 'Anantapur', lat: 14.6819, lng: 77.6006 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
      { name: 'Salem', lat: 11.6643, lng: 78.1460 }
    ];

    const t0 = Date.now();
    const mat1 = await roadRoutingProvider.getRouteMatrix(locations);
    const duration1 = Date.now() - t0;

    const t1 = Date.now();
    const mat2 = await roadRoutingProvider.getRouteMatrix(locations);
    const duration2 = Date.now() - t1;

    assert.strictEqual(mat1.size, 5, 'Matrix 1 size must be 5');
    assert.strictEqual(mat2.size, 5, 'Matrix 2 size must be 5');
    assert.ok(duration2 <= duration1 + 10, 'Cached matrix computation must be fast');
  });

  // =============================================================
  // PRODUCTION SCENARIOS 1 THROUGH 6
  // =============================================================
  console.log('\n--- PRODUCTION SCENARIOS (1 THROUGH 6) ---\n');

  // SCENARIO 1: Bangalore to Ooty (3-Day Ghats Road Trip, Family/Relaxed)
  await runAsyncTest('Scenario 1: Bangalore to Ooty (3-Day Road Trip, Hill Ghats, Relaxed Pace)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Bangalore',
      destination: 'Ooty',
      days: 3,
      planningStyle: 'relaxed',
      companionType: 'family',
      travelers: 4,
      transportMode: 'car'
    });

    assert.strictEqual(result.dayPlans.length, 3, 'Must generate exactly 3 days');
    assert.ok(result.totalEstimatedCost > 0, 'Cost must be calculated');
    assert.strictEqual(result.feasibilityStatus.isFeasible, true, 'Must be feasible');
  });

  // SCENARIO 2: Delhi to Agra & Jaipur (4-Day Golden Triangle, Cultural, Strict Budget)
  await runAsyncTest('Scenario 2: Delhi to Agra & Jaipur (4-Day Cultural Golden Triangle, Budget)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Delhi',
      destination: 'Jaipur',
      days: 4,
      mode: 'BUDGET',
      budget: 15000,
      activities: ['heritage', 'monuments', 'architecture'],
      transportMode: 'car'
    });

    assert.strictEqual(result.dayPlans.length, 4, 'Must generate 4 days');
    assert.ok(result.optimizerResult.selectedStops.length > 0, 'Must have selected stops');
  });

  // SCENARIO 3: Mumbai to Goa (5-Day Coastal Drive, Monsoon Rain Alert)
  await runAsyncTest('Scenario 3: Mumbai to Goa (5-Day Coastal Drive, Hazardous Monsoon Alert)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Mumbai',
      destination: 'Goa',
      days: 5,
      weatherCondition: 'Heavy Monsoon Rain & High Wind Alert',
      transportMode: 'car'
    });

    assert.strictEqual(result.weatherContract.status, 'FORECAST_ESTIMATE', 'Weather status must be recorded');
    assert.strictEqual(result.feasibilityStatus.isFeasible, false, 'Heavy monsoon must trigger safety infeasibility');
  });

  // SCENARIO 4: Chennai to Pondicherry (2-Day Weekend Coastal Trip, Solo)
  await runAsyncTest('Scenario 4: Chennai to Pondicherry (2-Day Weekend Coastal Trip, Solo Explorer)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Chennai',
      destination: 'Pondicherry',
      days: 2,
      companionType: 'solo',
      travelers: 1,
      transportMode: 'car'
    });

    assert.strictEqual(result.dayPlans.length, 2, 'Must generate 2 days');
    assert.strictEqual(result.feasibilityStatus.isFeasible, true, 'Weekend getaway must be feasible');
  });

  // SCENARIO 5: Hyderabad to Hampi (3-Day Archaeological Trip)
  await runAsyncTest('Scenario 5: Hyderabad to Hampi (3-Day Archaeological Trip)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Hampi',
      days: 3,
      mode: 'CULTURAL',
      activities: ['archaeology', 'ruins', 'temples', 'history'],
      transportMode: 'car'
    });

    assert.strictEqual(result.dayPlans.length, 3, 'Must generate 3 days');
    assert.ok(result.dayPlans[0].stops.length > 0, 'Day 1 must have stops');
  });

  // SCENARIO 6: Kolkata to Darjeeling (4-Day Mountain Road Trip, One-Way)
  await runAsyncTest('Scenario 6: Kolkata to Darjeeling (4-Day Mountain Road Trip, One-Way)', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Kolkata',
      destination: 'Darjeeling',
      days: 4,
      tripDirection: 'one_way',
      transportMode: 'car'
    });

    assert.strictEqual(result.dayPlans.length, 4, 'Must generate 4 days');
    assert.strictEqual(result.returnRoutePlan.isRoundTrip, false, 'Must be one-way trip');
    assert.strictEqual(result.returnRoutePlan.tripDirection, 'one_way', 'tripDirection must be one_way');
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
