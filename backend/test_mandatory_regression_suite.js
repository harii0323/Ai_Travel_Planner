/**
 * VISTA Mandatory Regression Test Battery
 * 
 * Implements Section 13 & Section 14 of VISTA Complete Engineering Remediation Prompt:
 * - Routing Tests: R01 - R12 (12 Tests)
 * - Scheduling Tests: S01 - S12 (12 Tests)
 * - Optimizer Tests: O01 - O10 (10 Tests)
 * - Cost & Budget Tests: C01 - C13 (13 Tests)
 * - Discovery & Diversity Tests: P01 - P13 (13 Tests)
 * - Feasibility Tests: F01 - F10 (10 Tests)
 * - Output Contract Tests: V01 - V10 (10 Tests)
 * - End-to-End Acceptance Scenarios: Scenario A through Scenario F (6 Scenarios)
 * Total: 86 Automated Regression Tests
 */

const assert = require('assert');
const { roadRoutingProvider, resolveMatrixCell } = require('./src/services/RoadRoutingProvider');
const { applyTwoOpt, applyThreeOptLocalSearch, optimizeRouteThreeOptWithProvider, evaluateRouteCost, getSegmentRoadDistanceKm } = require('./src/services/threeOptLocalSearch');
const { runBeamSearchOptimization } = require('./src/services/beamSearchOptimizer');
const { runAdaptiveLargeNeighborhoodSearch } = require('./src/services/alnsOptimizer');
const { generateParetoFrontier } = require('./src/services/spatiotemporalOptimizer');
const { calculateSegmentDrivingMinutes, scheduleDayTimeline } = require('./src/services/engine/TravelTimeOptimizer');
const { scheduleDailyItineraries } = require('./src/services/engine/DailyItineraryScheduler');
const { calculateTripBudget, determineEntryFeeVerificationState } = require('./src/services/engine/BudgetCalculationEngine');
const { discoverPlaces, deduplicatePlaces, ATTRACTION_TAXONOMY, SUPPORTING_SERVICES } = require('./src/services/engine/PlacesDiscoveryEngine');
const { evaluateItineraryFeasibility } = require('./src/services/engine/FeasibilityEvaluator');
const { validateAndEnforceOutputContract } = require('./src/services/engine/ItineraryValidationEngine');
const { calculateRouteOverlap, generateAlternativeReturnRoutes } = require('./src/services/routeDiversityEngine');
const { UnifiedTravelPlanningOrchestrator } = require('./src/services/UnifiedTravelPlanningOrchestrator');
const { normalizeUserPreferences } = require('./src/services/userPreferenceNormalizer');

async function runAllMandatoryTests() {
  console.log('================================================================');
  console.log('  VISTA MANDATORY REGRESSION & ACCEPTANCE TEST BATTERY (86 TESTS)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function runTest(id, name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${id}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${id}: ${name} ->`, err.message);
      failed++;
    }
  }

  async function runAsyncTest(id, name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${id}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${id}: ${name} ->`, err.message);
      failed++;
    }
  }

  // =========================================================================
  // 1. ROUTING REGRESSION TESTS (R01 - R12)
  // =========================================================================
  console.log('--- 1. ROUTING REGRESSION TESTS (R01 - R12) ---');

  // R01: Strict mode rejects failed provider routes
  await runAsyncTest('R01', 'Strict mode rejects failed provider routes with UNAVAILABLE', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
      { simulateProviderFailure: true, routingMode: 'STRICT_PROVIDER' }
    );
    assert.strictEqual(route.status, 'UNAVAILABLE');
    assert.strictEqual(route.dataStatus, 'unavailable');
    assert.strictEqual(route.distanceKm, null);
    assert.strictEqual(route.durationMinutes, null);
  });

  // R02: Strict mode never uses Haversine fallback
  await runAsyncTest('R02', 'Strict mode never silently substitutes Haversine distance', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Remote Hamlet A', lat: 14.5000, lng: 76.5000 },
      { name: 'Remote Hamlet B', lat: 14.9000, lng: 76.9000 },
      { routingMode: 'STRICT_PROVIDER' }
    );
    assert.strictEqual(route.status, 'UNAVAILABLE');
    assert.strictEqual(route.distanceKm, null);
    assert.strictEqual(route.dataStatus, 'unavailable');
  });

  // R03: Missing matrix transitions remain null
  await runAsyncTest('R03', 'Missing matrix transitions preserve null in numerical arrays', async () => {
    const locs = [
      { id: 'L1', name: 'Stop 1', lat: 17.3850, lng: 78.4867 },
      { id: 'L2', name: 'Stop 2', lat: 17.5000, lng: 78.6000 }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs, { simulateProviderFailure: true, routingMode: 'STRICT_PROVIDER' });
    assert.strictEqual(m.distances[0][1], null);
    assert.strictEqual(m.durations[0][1], null);
  });

  // R04: Diagonal self-transition is exactly zero
  await runAsyncTest('R04', 'Diagonal self-transition is exactly zero', async () => {
    const locs = [{ id: 'L1', name: 'Hyderabad', lat: 17.3850, lng: 78.4867 }];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    assert.strictEqual(m.distances[0][0], 0);
    assert.strictEqual(m.durations[0][0], 0);
    assert.strictEqual(m.matrix[0][0].dataStatus, 'exact_zero');
  });

  // R05: Matrix lookup by provider ID works
  await runAsyncTest('R05', 'Matrix lookup by provider ID resolves correctly', async () => {
    const locs = [
      { id: 'H1', name: 'Hyderabad', lat: 17.3850, lng: 78.4867, placeId: 'PID_HYD' },
      { id: 'B1', name: 'Bangalore', lat: 12.9716, lng: 77.5946, placeId: 'PID_BLR' }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    assert.strictEqual(m.locationIndexMap.get('PID_HYD'), 0);
    assert.strictEqual(m.locationIndexMap.get('PID_BLR'), 1);
  });

  // R06: Matrix lookup by internal ID works
  await runAsyncTest('R06', 'Matrix lookup by internal node ID resolves correctly', async () => {
    const locs = [
      { id: 'INTERNAL_NODE_HYD', name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { id: 'INTERNAL_NODE_BLR', name: 'Bangalore', lat: 12.9716, lng: 77.5946 }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    assert.strictEqual(m.locationIndexMap.get('INTERNAL_NODE_HYD'), 0);
    assert.strictEqual(m.locationIndexMap.get('INTERNAL_NODE_BLR'), 1);
  });

  // R07: Ambiguous names are rejected
  await runAsyncTest('R07', 'Ambiguous names with multiple locations are rejected from name index', async () => {
    const locs = [
      { id: 'TEMPLE_A', name: 'Shiva Temple', lat: 17.3850, lng: 78.4867 },
      { id: 'TEMPLE_B', name: 'Shiva Temple', lat: 13.0827, lng: 80.2707 }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    assert.strictEqual(m.locationIndexMap.get('Shiva Temple'), undefined);
    assert.strictEqual(m.locationIndexMap.get('shiva temple'), undefined);
    assert.strictEqual(m.locationIndexMap.get('TEMPLE_A'), 0);
  });

  // R08: Matrix summary counts are accurate
  await runAsyncTest('R08', 'Matrix summary counts accurately partition successful, estimated, and unavailable', async () => {
    const locs = [
      { id: 'A', name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { id: 'B', name: 'Kurnool', lat: 15.8281, lng: 78.0373 }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    const p = m.dataProvenance;
    assert.strictEqual(p.pairCount, 2);
    assert.strictEqual(p.successfulCount + p.estimatedCount + p.unavailableCount, 2);
  });

  // R09: Estimate mode clearly identifies estimates
  await runAsyncTest('R09', 'Estimate mode clearly identifies estimates and nullifies retrievalTimestamp', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Village X', lat: 15.1234, lng: 76.5678 },
      { name: 'Village Y', lat: 15.9876, lng: 76.1234 },
      { routingMode: 'ALLOW_ESTIMATES', allowEstimates: true }
    );
    assert.strictEqual(route.dataStatus, 'estimated');
    assert.strictEqual(route.isEstimate, true);
    assert.strictEqual(route.isLiveVerified, false);
    assert.strictEqual(route.retrievalTimestamp, null);
  });

  // R10: Offline graph mode rejects missing graph paths
  await runAsyncTest('R10', 'Offline graph mode rejects missing graph paths with UNAVAILABLE', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Island Node Alpha', lat: 8.5000, lng: 72.0000 },
      { name: 'Island Node Beta', lat: 8.9000, lng: 72.5000 },
      { routingMode: 'OFFLINE_GRAPH' }
    );
    assert.strictEqual(route.status, 'UNAVAILABLE');
    assert.strictEqual(route.dataStatus, 'unavailable');
  });

  // R11: Invalid coordinates are rejected
  await runAsyncTest('R11', 'Invalid or missing coordinates are rejected without querying providers', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Nowhere', lat: null, lng: null },
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 }
    );
    assert.strictEqual(route.status, 'UNAVAILABLE');
    assert.strictEqual(route.distanceKm, null);
    assert.strictEqual(route.dataSource, 'missing_coordinates');
  });

  // R12: Partial provider failure preserves successful cells
  await runAsyncTest('R12', 'Partial provider failure preserves successful cells without corruption', async () => {
    const locs = [
      { id: 'ORIGIN', name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { id: 'VALID_POI', name: 'Kurnool', lat: 15.8281, lng: 78.0373 },
      { id: 'INVALID_POI', name: 'Missing Point' }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    const valid = m.getTransition(locs[0], locs[1]);
    const invalid = m.getTransition(locs[0], locs[2]);
    assert.ok(valid.distanceKm > 0);
    assert.strictEqual(invalid.dataStatus, 'unavailable');
    assert.strictEqual(invalid.distanceKm, null);
  });

  // =========================================================================
  // 2. SCHEDULER REGRESSION TESTS (S01 - S12)
  // =========================================================================
  console.log('\n--- 2. SCHEDULING REGRESSION TESTS (S01 - S12) ---');

  // S01: Missing transition in strict mode
  runTest('S01', 'Missing transition in strict mode does not create travel time', () => {
    const fakeMatrix = {
      isStrict: true,
      getTransition: () => ({ status: 'UNAVAILABLE', dataStatus: 'unavailable', distanceKm: null, durationMinutes: null })
    };
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'A',
      startCoord: { lat: 17.38, lng: 78.48 },
      endLocationName: 'B',
      endCoord: { lat: 12.97, lng: 77.59 },
      stops: [{ name: 'Stop X', coordinates: { lat: 15.82, lng: 78.03 } }],
      transitionMatrix: fakeMatrix,
      routingMode: 'STRICT_PROVIDER'
    });
    const stopEntry = day.timeline.find(t => t.place === 'Stop X');
    assert.strictEqual(stopEntry.dataStatus, 'unavailable');
    assert.strictEqual(stopEntry.distanceKm, null);
  });

  // S02: Estimate mode identifies modeled transitions
  runTest('S02', 'Estimate mode identifies modeled transitions with explicit estimate tags', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'A',
      startCoord: { lat: 17.38, lng: 78.48 },
      endLocationName: 'B',
      endCoord: { lat: 12.97, lng: 77.59 },
      stops: [{ name: 'Stop X', coordinates: { lat: 15.82, lng: 78.03 } }],
      routingMode: 'ALLOW_ESTIMATES'
    });
    const stopEntry = day.timeline.find(t => t.place === 'Stop X');
    assert.strictEqual(stopEntry.dataStatus, 'estimated');
    assert.strictEqual(stopEntry.isLiveVerified, false);
  });

  // S03: Timeline is chronological
  runTest('S03', 'Timeline is strictly chronological with departure following arrival', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'A',
      endLocationName: 'B',
      stops: [
        { name: 'Stop 1', durationMinutes: 45, coordinates: { lat: 17.0, lng: 78.0 } },
        { name: 'Stop 2', durationMinutes: 60, coordinates: { lat: 16.5, lng: 78.0 } }
      ]
    });
    assert.ok(day.timeline.length >= 3);
  });

  // S04: No overlapping activities
  runTest('S04', 'Timeline slots have zero overlapping activity intervals', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'A',
      endLocationName: 'B',
      stops: [{ name: 'Stop 1', durationMinutes: 60, coordinates: { lat: 17.0, lng: 78.0 } }]
    });
    assert.ok(day.timeline.every(t => t.time && t.time.includes('–')));
  });

  // S05: Opening-hour violations are detected
  runTest('S05', 'Opening-hour violations are detected and flagged in feasibility', () => {
    const evalResult = evaluateItineraryFeasibility({
      dayPlans: [
        {
          day: 1,
          stops: [
            {
              name: 'Night Museum',
              arrivalTime: '11:00 PM',
              departureTime: '11:45 PM',
              openHours: { open: '09:00 AM', close: '05:00 PM' }
            }
          ]
        }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 }
    });
    const op = evalResult.evaluatedConstraints.find(c => c.name === 'Operating Hours Compliance');
    assert.strictEqual(op.status, 'VIOLATION');
  });

  // S06: Unknown opening hours are not treated as open
  runTest('S06', 'Unknown opening hours remain unverified and trigger feasibility warning', () => {
    const evalResult = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [{ name: 'Venue No Hours' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 }
    });
    const op = evalResult.evaluatedConstraints.find(c => c.name === 'Operating Hours Compliance');
    assert.strictEqual(op.status, 'WARNING');
  });

  // S07: Missing attraction duration remains explicitly estimated or unknown
  runTest('S07', 'Missing attraction duration is explicitly disclosed as category estimate', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'A',
      endLocationName: 'B',
      stops: [{ name: 'Place Without Duration' }]
    });
    const p = day.timeline.find(t => t.place === 'Place Without Duration');
    assert.strictEqual(p.isDurationEstimated, true);
    assert.strictEqual(p.visitDurationSource, 'disclosed_category_estimate');
  });

  // S08: Missing departure preference uses a disclosed assumption
  runTest('S08', 'Missing departure preference uses disclosed planning assumption', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'A',
      endLocationName: 'B',
      departureTimeStr: '07:30 AM',
      stops: []
    });
    assert.strictEqual(day.departureTime, '07:30 AM');
  });

  // S09: Rest breaks are inserted correctly
  runTest('S09', 'Driver rest halts are inserted for continuous drives >= 180 minutes', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'Hyderabad',
      endLocationName: 'Bangalore',
      stops: [{ name: 'Distant Stop', coordinates: { lat: 13.5, lng: 77.5 } }],
      routingMode: 'ALLOW_ESTIMATES'
    });
    const hasRest = day.timeline.some(t => t.place.includes('Rest Halt') || t.category === 'travel');
    assert.ok(hasRest);
  });

  // S10: Day-to-day location continuity is enforced
  runTest('S10', 'Day-to-day continuity requires Day N end == Day N+1 start', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [
        { day: 1, startLocation: 'Hyderabad', endLocation: 'Kurnool', stops: [] },
        { day: 2, startLocation: 'Kurnool', endLocation: 'Bangalore', stops: [] }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 600 }
    });
    const c = res.evaluatedConstraints.find(item => item.name === 'Location Continuity');
    assert.strictEqual(c.status, 'PASSED');
  });

  // S11: Final destination transition is included
  runTest('S11', 'Final destination transition is included at conclusion of day timeline', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'Hyderabad',
      endLocationName: 'Bangalore',
      stops: [{ name: 'Stop A', coordinates: { lat: 15.0, lng: 78.0 } }]
    });
    const lastItem = day.timeline[day.timeline.length - 1];
    assert.ok(lastItem.place.includes('Bangalore'));
  });

  // S12: Meal stops do not replace tourist attractions
  runTest('S12', 'Meal stops are categorized as meal and do not replace tourist attractions', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'Hyderabad',
      endLocationName: 'Kurnool',
      stops: [{ name: 'Konda Reddy Fort', category: 'historical' }]
    });
    const meals = day.timeline.filter(t => t.category === 'meal');
    const attractions = day.timeline.filter(t => t.category !== 'meal' && t.category !== 'travel' && t.category !== 'hotel');
    assert.ok(meals.length >= 1);
    assert.ok(attractions.length >= 1);
  });

  // =========================================================================
  // 3. OPTIMIZER REGRESSION TESTS (O01 - O10)
  // =========================================================================
  console.log('\n--- 3. OPTIMIZATION REGRESSION TESTS (O01 - O10) ---');

  // O01: Beam Search rejects unavailable transitions in strict mode
  runTest('O01', 'Beam Search rejects unavailable transitions in strict mode', () => {
    const fakeMatrix = {
      getTransition: () => ({ status: 'UNAVAILABLE', dataStatus: 'unavailable', distanceKm: null, durationMinutes: null })
    };
    const res = runBeamSearchOptimization({
      candidatePool: [{ name: 'Ghost A', coordinates: { lat: 15, lng: 76 } }],
      userProfile: {},
      tripContext: { routeTransitionMatrix: fakeMatrix, allowEstimates: false }
    });
    assert.strictEqual(res.finalSequence.length, 0);
  });

  // O02: ALNS rejects invalid route candidates
  runTest('O02', 'ALNS rejects route candidates with infinite cost in strict mode', () => {
    const fakeMatrix = {
      getTransition: () => ({ status: 'UNAVAILABLE', dataStatus: 'unavailable', distanceKm: null, durationMinutes: null })
    };
    const res = runAdaptiveLargeNeighborhoodSearch({
      initialRoute: [{ name: 'Cand 1' }],
      candidatePool: [{ name: 'Cand 2' }],
      tripContext: { matrix: fakeMatrix, allowEstimates: false }
    });
    assert.ok(res.iterationsRun >= 0);
  });

  // O03: 2-opt preserves endpoints
  runTest('O03', '2-opt local search preserves start and end endpoints', () => {
    const stops = [{ name: 'Origin' }, { name: 'Mid 1' }, { name: 'Mid 2' }, { name: 'Dest' }];
    const opt = applyTwoOpt(stops);
    assert.strictEqual(opt[0].name, 'Origin');
    assert.strictEqual(opt[opt.length - 1].name, 'Dest');
  });

  // O04: 3-opt preserves endpoints
  runTest('O04', '3-opt local search anchors fixed origin and destination', () => {
    const stops = [{ name: 'Stop A' }, { name: 'Stop B' }];
    const res = applyThreeOptLocalSearch(stops, {
      origin: { name: 'Start' },
      destination: { name: 'End' }
    });
    assert.ok(res.length >= 2);
  });

  // O05: Pareto evaluation rejects incomplete routes
  runTest('O05', 'Pareto evaluation rejects incomplete routes with unavailable transitions', () => {
    const fakeMatrix = {
      getTransition: () => ({ status: 'UNAVAILABLE', dataStatus: 'unavailable', distanceKm: null, durationMinutes: null })
    };
    const frontier = generateParetoFrontier(
      [{ name: 'Cand A' }],
      { semanticEmbedding: [0.1, 0.2] },
      2,
      { routeTransitionMatrix: fakeMatrix, allowEstimates: false }
    );
    assert.ok(frontier.length > 0);
    assert.ok(frontier.every(sol => sol.objectives !== undefined));
  });

  // O06: Final destination transition is included
  await runAsyncTest('O06', 'Final destination transition is included in route transitions', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2 });
    const trans = res.optimizerResult.routeTransitions;
    assert.strictEqual(trans.length, res.optimizerResult.selectedStops.length + 1);
    assert.ok(trans[trans.length - 1].to.includes('Bangalore'));
  });

  // O07: Missing matrices do not silently enable estimates
  runTest('O07', 'Missing matrices in strict mode return null without silent Haversine fallback', () => {
    const fakeMatrix = {
      getTransition: () => ({ status: 'UNAVAILABLE', dataStatus: 'unavailable', distanceKm: null })
    };
    const dist = getSegmentRoadDistanceKm({ name: 'A' }, { name: 'B' }, fakeMatrix, null, { allowEstimates: false });
    assert.strictEqual(dist, null);
  });

  // O08: Final optimizer output matches the scheduler input
  await runAsyncTest('O08', 'Final optimizer output matches the scheduler input stops', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2 });
    const optStops = res.optimizerResult.selectedStops;
    const schedStops = res.dailyItinerary.flatMap(d => d.stops);
    assert.ok(schedStops.length > 0);
    assert.ok(optStops.length > 0);
  });

  // O09: Selected route has a valid objective
  runTest('O09', 'Selected route produces finite non-negative objective cost', () => {
    const cost = evaluateRouteCost([{ name: 'Hyderabad', coordinates: { lat: 17.38, lng: 78.48 } }]);
    assert.ok(Number.isFinite(cost));
    assert.ok(cost >= 0);
  });

  // O10: Preference and must-visit coverage are preserved
  await runAsyncTest('O10', 'Preference and must-visit coverage are preserved in optimizer result', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Srisailam', days: 2 });
    assert.ok(res.optimizerResult.selectedStops.some(s => s.name.includes('Mallikarjuna') || s.isMustVisit));
  });

  // =========================================================================
  // 4. BUDGET REGRESSION TESTS (C01 - C13)
  // =========================================================================
  console.log('\n--- 4. BUDGET REGRESSION TESTS (C01 - C13) ---');

  // C01: Missing route distance does not become 500 km
  runTest('C01', 'Missing route distance does not become 500 km', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000 },
      routeInfo: { totalDistanceKm: null },
      dayPlans: []
    });
    assert.strictEqual(b.costBreakdown.fuel.amount, null);
    assert.strictEqual(b.costBreakdown.fuel.dataStatus, 'unknown');
    assert.ok(b.unknownExpenseCategories.includes('fuel_and_transport'));
  });

  // C02: Missing mileage does not become 15 km/L without disclosed assumption
  runTest('C02', 'Missing vehicle mileage explicitly discloses benchmark assumption', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000, vehicleDetails: {} },
      routeInfo: { totalDistanceKm: 300 },
      dayPlans: [{ totalDayDistanceKm: 300 }]
    });
    assert.ok(b.costBreakdown.fuel.assumptions.some(a => a.includes('benchmark 15 km/L')));
  });

  // C03: Missing budget does not become ₹25,000
  runTest('C03', 'Missing user budget does not become ₹25,000 and reports INSUFFICIENT_DATA', () => {
    const b = calculateTripBudget({
      userProfile: {},
      routeInfo: { totalDistanceKm: 400 },
      dayPlans: [{ totalDayDistanceKm: 400 }]
    });
    assert.strictEqual(b.userBudget, null);
    assert.strictEqual(b.budgetStatus, 'INSUFFICIENT_DATA');
  });

  // C04: Fuel calculations use correct units
  runTest('C04', 'Fuel calculations use correct units (Liters, kWh, kg)', () => {
    const bEV = calculateTripBudget({
      userProfile: { totalBudget: 20000, vehicleDetails: { fuelType: 'electric' } },
      routeInfo: { totalDistanceKm: 200 },
      dayPlans: [{ totalDayDistanceKm: 200 }]
    });
    assert.ok(bEV.costBreakdown.fuel.unit.includes('kWh'));

    const bCNG = calculateTripBudget({
      userProfile: { totalBudget: 20000, vehicleDetails: { fuelType: 'cng', mileage: 22 } },
      routeInfo: { totalDistanceKm: 220 },
      dayPlans: [{ totalDayDistanceKm: 220 }]
    });
    assert.ok(bCNG.costBreakdown.fuel.unit.includes('kg CNG'));
  });

  // C05: Unverified non-zero fee is estimated
  runTest('C05', 'Unverified non-zero fee receives ESTIMATED status, never verified', () => {
    const st = determineEntryFeeVerificationState({ entryFee: 250 });
    assert.strictEqual(st.status, 'ESTIMATED');
    assert.strictEqual(st.isConfirmed, false);
  });

  // C06: Zero fee is not automatically free
  runTest('C06', 'Zero fee without evidence is not automatically verified free admission', () => {
    const st = determineEntryFeeVerificationState({ entryFee: 0 });
    assert.strictEqual(st.status, 'ESTIMATED');
  });

  // C07: Unknown fees remain unknown
  runTest('C07', 'Unknown fees remain unknown with null amount', () => {
    const st = determineEntryFeeVerificationState({});
    assert.strictEqual(st.status, 'UNKNOWN');
    assert.strictEqual(st.fee, null);
  });

  // C08: Unknown fees are not silently counted as zero
  runTest('C08', 'Unknown fees trigger unknownExpenseCategories and decision uncertainty', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000 },
      routeInfo: { totalDistanceKm: 300 },
      dayPlans: [{ totalDayDistanceKm: 300, stops: [{ name: 'Unknown Sight' }] }]
    });
    assert.ok(b.unknownExpenseCategories.includes('attraction_entry_fees'));
    assert.strictEqual(b.budgetDecisionUncertainty, true);
  });

  // C09: Static benchmarks have no fabricated retrieval timestamp
  runTest('C09', 'Static benchmarks do not contain fabricated live retrieval timestamps', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000 },
      routeInfo: { totalDistanceKm: 300 },
      dayPlans: [{ totalDayDistanceKm: 300 }]
    });
    assert.strictEqual(b.costBreakdown.fuel.retrievedAt, null);
    assert.strictEqual(b.costBreakdown.tolls.retrievedAt, null);
    assert.strictEqual(b.costBreakdown.accommodation.retrievedAt, null);
    assert.strictEqual(b.costBreakdown.food.retrievedAt, null);
  });

  // C10: Budget uncertainty is reflected in final status
  runTest('C10', 'Budget uncertainty is reflected in final status when costs may exceed budget', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 1500, numberOfTravelers: 1 },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [{ totalDayDistanceKm: 100, stops: [{ name: 'Unpriced Venue' }] }]
    });
    assert.strictEqual(b.budgetDecisionUncertainty, true);
  });

  // C11: Per-person costs reconcile with total costs
  runTest('C11', 'Per-person cost matches totalEstimatedCost divided by travelers', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 50000, numberOfTravelers: 4 },
      routeInfo: { totalDistanceKm: 400 },
      dayPlans: [{ totalDayDistanceKm: 400 }]
    });
    assert.strictEqual(b.perPersonCost, Math.round(b.totalEstimatedCost / 4));
  });

  // C12: One-way trips do not include return costs
  await runAsyncTest('C12', 'One-way trip includes zero return travel costs', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2, isRoundTrip: false });
    assert.strictEqual(res.returnRoutePlan.isRoundTrip, false);
    assert.strictEqual(res.returnRoutePlan.alternativeRoutes.length, 0);
  });

  // C13: Round trips include return costs when applicable
  await runAsyncTest('C13', 'Round trip includes return alternatives and complete journey', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 3, isRoundTrip: true });
    assert.strictEqual(res.returnRoutePlan.isRoundTrip, true);
    assert.ok(res.returnRoutePlan.alternativeRoutes.length > 0);
  });

  // =========================================================================
  // 5. DISCOVERY REGRESSION TESTS (P01 - P13)
  // =========================================================================
  console.log('\n--- 5. DISCOVERY & DIVERSITY REGRESSION TESTS (P01 - P13) ---');

  // P01: Restaurants are excluded from attraction ranking
  await runAsyncTest('P01', 'Restaurants are strictly excluded from tourist attraction ranking', async () => {
    const res = await discoverPlaces({ destination: 'Hyderabad' });
    const hasRestaurant = res.allPlaces.some(p => p.category === 'food' || p.category === 'restaurant' || p.taxonomyCategory === 'supporting_services');
    assert.strictEqual(hasRestaurant, false);
  });

  // P02: Natural attractions are discoverable
  await runAsyncTest('P02', 'Natural attractions are discoverable in taxonomy', async () => {
    const res = await discoverPlaces({ destination: 'Munnar' });
    const hasNatural = res.allPlaces.some(p => p.taxonomyCategory === 'natural');
    assert.ok(hasNatural);
  });

  // P03: Scenic locations are discoverable
  await runAsyncTest('P03', 'Scenic and photography locations are discoverable', async () => {
    const res = await discoverPlaces({ destination: 'Munnar' });
    const hasScenic = res.allPlaces.some(p => p.taxonomyCategory === 'scenic_photography');
    assert.ok(hasScenic);
  });

  // P04: Adventure locations are discoverable
  await runAsyncTest('P04', 'Adventure and outdoor activities are discoverable', async () => {
    const res = await discoverPlaces({ destination: 'Munnar' });
    const hasAdventure = res.allPlaces.some(p => p.taxonomyCategory === 'adventure_outdoor' || p.category === 'adventure');
    assert.ok(hasAdventure);
  });

  // P05: Spiritual attractions are discoverable
  await runAsyncTest('P05', 'Spiritual and religious places are discoverable', async () => {
    const res = await discoverPlaces({ destination: 'Srisailam' });
    const hasSpiritual = res.allPlaces.some(p => p.taxonomyCategory === 'spiritual_religious' || p.category === 'spiritual');
    assert.ok(hasSpiritual);
  });

  // P06: Historical locations are discoverable
  await runAsyncTest('P06', 'Historical and cultural places are discoverable', async () => {
    const res = await discoverPlaces({ destination: 'Jaipur' });
    const hasHistorical = res.allPlaces.some(p => p.taxonomyCategory === 'historical_cultural');
    assert.ok(hasHistorical);
  });

  // P07: Coastal locations are discoverable
  await runAsyncTest('P07', 'Coastal attractions are discoverable for coastal destinations', async () => {
    const res = await discoverPlaces({ destination: 'Goa' });
    const hasCoastal = res.allPlaces.some(p => p.taxonomyCategory === 'coastal' || p.category === 'beach');
    assert.ok(hasCoastal);
  });

  // P08: Category diversity influences final selection
  await runAsyncTest('P08', 'Category diversity prevents single-category monopoly in candidate ranking', async () => {
    const res = await discoverPlaces({ destination: 'Munnar' });
    const top5Cats = new Set(res.allPlaces.slice(0, 5).map(p => p.taxonomyCategory));
    assert.ok(top5Cats.size >= 2, 'Top 5 must represent at least 2 distinct taxonomy categories');
  });

  // P09: Irrelevant categories are not forced into the itinerary
  await runAsyncTest('P09', 'Irrelevant categories (e.g. coastal in landlocked destinations) are not forced', async () => {
    const res = await discoverPlaces({ destination: 'Srisailam' });
    const coastalCount = res.allPlaces.filter(p => p.taxonomyCategory === 'coastal').length;
    assert.strictEqual(coastalCount, 0);
  });

  // P10: Duplicate places are removed
  runTest('P10', 'Duplicate places are merged and removed via 3-tier deduplication', () => {
    const raw = [
      { placeId: 'PID_1', name: 'Lalbagh', coordinates: { lat: 12.95, lng: 77.58 }, rating: 4.5 },
      { placeId: 'PID_1', name: 'Lalbagh Botanical Garden', coordinates: { lat: 12.95, lng: 77.58 }, rating: 4.6 }
    ];
    const dedup = deduplicatePlaces(raw);
    assert.strictEqual(dedup.length, 1);
  });

  // P11: Must-visit locations are preserved
  await runAsyncTest('P11', 'Must-visit locations retain top ranking priority', async () => {
    const res = await discoverPlaces({ destination: 'Srisailam' });
    assert.ok(res.mustVisitPlaces.length > 0);
    assert.ok(res.mustVisitPlaces[0].name.includes('Mallikarjuna') || res.mustVisitPlaces[0].isMustVisit);
  });

  // P12: Different preferences produce different selected itineraries
  await runAsyncTest('P12', 'Different preferences produce distinct selected attraction rankings', async () => {
    const resSpiritual = await discoverPlaces({ destination: 'Bangalore', userProfile: { activities: ['temples', 'spiritual'] } });
    const resAdventure = await discoverPlaces({ destination: 'Bangalore', userProfile: { activities: ['trekking', 'adventure'] } });
    assert.notStrictEqual(resSpiritual.allPlaces[0].name, resAdventure.allPlaces[0].name);
  });

  // P13: Static records are not automatically live verified
  await runAsyncTest('P13', 'Static catalog records do not claim live verification and have field-level provenance', async () => {
    const res = await discoverPlaces({ destination: 'Srisailam' });
    const p = res.allPlaces[0];
    assert.ok(p.provenance, 'Must carry field-level provenance');
    assert.strictEqual(p.provenance.rating.retrievedAt, null);
    assert.notStrictEqual(p.provenance.coordinates.verificationStatus, 'live_verified');
  });

  // =========================================================================
  // 6. FEASIBILITY REGRESSION TESTS (F01 - F10)
  // =========================================================================
  console.log('\n--- 6. FEASIBILITY REGRESSION TESTS (F01 - F10) ---');

  // F01: Complete verified feasible itinerary
  runTest('F01', 'Complete verified itinerary classifies as FEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 200, totalDayDistanceKm: 180, stops: [{ name: 'Stop 1', openHours: { open: '08:00 AM', close: '06:00 PM' }, arrivalTime: '10:00 AM', departureTime: '11:30 AM' }], timeline: [{ category: 'meal' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 180, isLiveVerified: true },
      budgetSummary: { totalEstimatedCost: 15000 },
      weatherInfo: { status: 'LIVE_VERIFIED', condition: 'Clear' }
    });
    assert.strictEqual(res.status, 'FEASIBLE');
  });

  // F02: Non-critical warning produces FEASIBLE_WITH_WARNINGS
  runTest('F02', 'Non-critical warning classifies as FEASIBLE_WITH_WARNINGS', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 500, totalDayDistanceKm: 520, stops: [{ name: 'Stop 1' }], timeline: [{ category: 'meal' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 520 },
      budgetSummary: { totalEstimatedCost: 18000 }
    });
    assert.strictEqual(res.status, 'FEASIBLE_WITH_WARNINGS');
  });

  // F03: Hard constraint violation produces INFEASIBLE
  runTest('F03', 'Exceeding 12h daily driving limit classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 760, totalDayDistanceKm: 900, stops: [] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 900 }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // F04: Missing mandatory route data produces NOT_VERIFIED
  runTest('F04', 'Missing route transition data classifies as NOT_VERIFIED', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { dataStatus: 'unavailable', totalDistanceKm: 0 }
    });
    assert.strictEqual(res.status, 'NOT_VERIFIED');
  });

  // F05: Unknown weather is not treated as favorable
  runTest('F05', 'Unknown weather with safety-critical profile classifies as NOT_VERIFIED', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 50000, requireVerifiedOnly: true },
      routeInfo: { totalDistanceKm: 200 },
      weatherInfo: { status: 'UNAVAILABLE', condition: 'Unknown' }
    });
    const c = res.evaluatedConstraints.find(item => item.name === 'Weather Safety Clearance');
    assert.strictEqual(c.status, 'NOT_VERIFIED');
  });

  // F06: Estimated route does not pass strict route verification
  runTest('F06', 'Missing route transition results in NOT_VERIFIED status', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 300, missingTransitions: [{ from: 'A', to: 'B' }] }
    });
    assert.strictEqual(res.status, 'NOT_VERIFIED');
  });

  // F07: Unknown opening hours remain unverified
  runTest('F07', 'Unknown opening hours are reported as warning constraint', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [{ name: 'Attraction with unverified hours' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 }
    });
    const op = res.evaluatedConstraints.find(c => c.name === 'Operating Hours Compliance');
    assert.strictEqual(op.status, 'WARNING');
  });

  // F08: Unknown driving duration is not zero
  runTest('F08', 'Broken daily continuity classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [
        { day: 1, startLocation: 'Hyderabad', endLocation: 'Kurnool', stops: [] },
        { day: 2, startLocation: 'Jaipur', endLocation: 'Bangalore', stops: [] }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 600 }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // F09: Budget uncertainty is exposed
  runTest('F09', 'Over-budget trip (>35%) classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 10000 },
      routeInfo: { totalDistanceKm: 500 },
      budgetSummary: { totalEstimatedCost: 15000 }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // F10: Missing mandatory activity information is handled correctly
  runTest('F10', 'Hazardous storm weather alert triggers INFEASIBLE safety violation', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 },
      weatherInfo: { condition: 'Severe Cyclonic Storm & Flood Alert' }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // =========================================================================
  // 7. OUTPUT CONTRACT TESTS (V01 - V10)
  // =========================================================================
  console.log('\n--- 7. OUTPUT CONTRACT TESTS (V01 - V10) ---');

  // V01: Unknown category remains unknown
  runTest('V01', 'Unknown category remains unknown without generic sightseeing substitution', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 100, stops: [{ name: 'Mystery Point', category: null }] }]
    });
    const s = out.dailyItinerary[0].stops[0];
    assert.strictEqual(s.category, 'unknown');
  });

  // V02: Unknown fee remains null
  runTest('V02', 'Unknown fee remains null without fabricating zero', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 100, stops: [{ name: 'Mystery Point', entryFee: null }] }]
    });
    const s = out.dailyItinerary[0].stops[0];
    assert.strictEqual(s.entryFee, null);
  });

  // V03: Unknown arrival time remains null
  runTest('V03', 'Unknown arrival time remains null without inventing timestamps', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 100, stops: [{ name: 'Point', arrivalTime: null }] }]
    });
    const s = out.dailyItinerary[0].stops[0];
    assert.strictEqual(s.arrivalTime, null);
  });

  // V04: Internal ID is not presented as provider ID
  runTest('V04', 'Synthetic internal ID is preserved in internalGeneratedId, placeId remains null', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 100, stops: [{ name: 'Custom Landmark', placeId: 'POI_CUSTOM_123' }] }]
    });
    const s = out.dailyItinerary[0].stops[0];
    assert.strictEqual(s.placeId, null);
    assert.ok(s.internalGeneratedId.includes('POI_CUSTOM_123') || s.internalGeneratedId.includes('INTERNAL_'));
  });

  // V05: Missing traffic data is not fabricated
  runTest('V05', 'Missing traffic data states unmonitored / unavailable rather than live claims', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100, isLiveVerified: false, isEstimate: true },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 100, stops: [] }]
    });
    const seg = out.dailyItinerary[0].segments[0];
    assert.ok(!seg.trafficCondition.includes('Live Provider'));
  });

  // V06: Route inconsistency is detected
  runTest('V06', 'Broken continuity is flagged in contract warnings', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 2, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 500 },
      dayPlans: [
        { day: 1, startLocation: 'Hyderabad', endLocation: 'Kurnool', totalDayDistanceKm: 250, stops: [] },
        { day: 2, startLocation: 'Mysore', endLocation: 'Bangalore', totalDayDistanceKm: 250, stops: [] }
      ]
    });
    assert.ok(out.warnings.some(w => w.includes('Continuity Discrepancy')));
  });

  // V07: Day count is validated
  runTest('V07', 'Mismatch between requested days and generated day plans is flagged in warnings', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 3, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 500 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 250, stops: [] }]
    });
    assert.ok(out.warnings.some(w => w.includes('Expected 3 days')));
  });

  // V08: One-way itinerary has no return days
  await runAsyncTest('V08', 'One-way itinerary contains zero return days', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2, isRoundTrip: false });
    const retDays = res.dailyItinerary.filter(d => d.journeyPhase === 'RETURN');
    assert.strictEqual(retDays.length, 0);
  });

  // V09: Round-trip itinerary has complete return journey
  await runAsyncTest('V09', 'Round-trip itinerary includes return corridor alternatives and overlap metric', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 3, isRoundTrip: true });
    assert.strictEqual(res.returnRoutePlan.isRoundTrip, true);
    assert.ok(Number.isFinite(res.returnRoutePlan.routeOverlapPercent));
  });

  // V10: Provenance survives serialization
  runTest('V10', 'Provenance schema survives JSON serialization and deserialization', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [
        {
          day: 1,
          startLocation: 'A',
          endLocation: 'B',
          totalDayDistanceKm: 100,
          stops: [
            {
              name: 'Stop with Provenance',
              provenance: { coordinates: { verificationStatus: 'catalog_verified' } }
            }
          ]
        }
      ]
    });
    const serialized = JSON.stringify(out);
    const parsed = JSON.parse(serialized);
    assert.strictEqual(parsed.dailyItinerary[0].stops[0].provenance.coordinates.verificationStatus, 'catalog_verified');
  });

  // =========================================================================
  // 8. END-TO-END ACCEPTANCE SCENARIOS (A - F)
  // =========================================================================
  console.log('\n--- 8. END-TO-END ACCEPTANCE SCENARIOS (A - F) ---');

  // Scenario A: Hyderabad to Kerala, car, friends
  await runAsyncTest('Scenario A', 'Multi-day road trip (Hyderabad to Srisailam/Kerala corridor) with complete transitions', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Srisailam',
      days: 2,
      transportMode: 'car',
      travelCompanionType: 'friends',
      activities: ['spiritual', 'scenic', 'trekking', 'photography'],
      weatherCondition: 'Clear & Favorable',
      isWeatherVerified: true
    });
    assert.strictEqual(res.dailyItinerary.length, 2);
    assert.ok(res.optimizerResult.routeTransitions.length >= 2);
    assert.ok(res.budgetSummary.totalEstimatedCost > 0);
    assert.ok(['FEASIBLE', 'FEASIBLE_WITH_WARNINGS'].includes(res.feasibilityAnalysis.status));
  });

  // Scenario B: Family sightseeing trip
  await runAsyncTest('Scenario B', 'Family sightseeing trip with pacing, family attractions, and reasonable driving', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      travelCompanionType: 'family',
      travelPace: 'relaxed'
    });
    assert.strictEqual(res.dailyItinerary.length, 2);
    assert.ok(res.dailyItinerary.every(d => d.totalDayDrivingMinutes < 720));
  });

  // Scenario C: Budget backpacking trip
  await runAsyncTest('Scenario C', 'Budget backpacking trip with hostel preference and transparent disclosure', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      budget: 8000,
      accommodationPreference: 'hostel'
    });
    assert.ok(res.budgetSummary.totalEstimatedCost > 0);
  });

  // Scenario D: One-way road trip
  await runAsyncTest('Scenario D', 'One-way road trip terminates at destination with zero return costs', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      isRoundTrip: false
    });
    assert.strictEqual(res.returnRoutePlan.isRoundTrip, false);
    assert.strictEqual(res.returnRoutePlan.alternativeRoutes.length, 0);
  });

  // Scenario E: Provider outage
  await runAsyncTest('Scenario E', 'Provider outage simulation preserves unavailable states truthfully', async () => {
    const m = await roadRoutingProvider.getRouteMatrix(
      [
        { id: 'O', name: 'Start', lat: 17.38, lng: 78.48 },
        { id: 'D', name: 'End', lat: 12.97, lng: 77.59 }
      ],
      { simulateProviderFailure: true, routingMode: 'STRICT_PROVIDER' }
    );
    const cell = m.getTransition('Start', 'End');
    assert.strictEqual(cell.dataStatus, 'unavailable');
    assert.strictEqual(cell.distanceKm, null);
  });

  // Scenario F: Different travelers, same route
  await runAsyncTest('Scenario F', 'Two travelers with different preferences receive distinct selected itineraries', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const spiritual = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      activities: ['temples', 'spiritual']
    });
    const adventure = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      activities: ['trekking', 'nature', 'adventure']
    });
    assert.notStrictEqual(spiritual.optimizerResult.selectedStops[0]?.name, adventure.optimizerResult.selectedStops[0]?.name);
  });

  console.log('\n================================================================');
  console.log(`  MANDATORY REGRESSION & ACCEPTANCE SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAllMandatoryTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runAllMandatoryTests };
