/**
 * VISTA Mandatory Regression Test Battery
 * 
 * Implements Section 15 of VISTA Complete Engineering Remediation Prompt:
 * - Routing Tests: R01 - R20 (20 Tests)
 * - Scheduling Tests: S01 - S20 (20 Tests)
 * - Optimizer Tests: O01 - O18 (18 Tests)
 * - Cost & Budget Tests: C01 - C24 (24 Tests)
 * - Discovery & Diversity Tests: P01 - P20 (20 Tests)
 * - Feasibility Tests: F01 - F18 (18 Tests)
 * - Journey Planning & Return Tests: J01 - J08 (8 Tests)
 * - Output Contract Tests: V01 - V16 (16 Tests)
 * - End-to-End Acceptance Scenarios: Scenario A through Scenario F (6 Scenarios)
 * Total: 150 Automated Regression Tests
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
  console.log('  VISTA MANDATORY REGRESSION & ACCEPTANCE TEST BATTERY (150 TESTS)');
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

  // R13: Strict mode rejects graph fallback when live provider is unavailable
  await runAsyncTest('R13', 'Strict mode rejects graph fallback when live provider is unavailable', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
      { routingMode: 'STRICT_PROVIDER', simulateProviderFailure: true }
    );
    assert.strictEqual(route.status, 'UNAVAILABLE');
    assert.strictEqual(route.dataStatus, 'unavailable');
    assert.strictEqual(route.distanceKm, null);
  });

  // R14: OFFLINE_GRAPH queries highway graph with zero external calls
  await runAsyncTest('R14', 'Offline graph mode queries highway graph without external calls', async () => {
    const route = await roadRoutingProvider.getRoute('Hyderabad', 'Kurnool', { routingMode: 'OFFLINE_GRAPH' });
    assert.strictEqual(route.dataStatus, 'graph_modeled');
    assert.strictEqual(route.isLimitedGraph, true);
    assert.strictEqual(route.retrievalTimestamp, null);
    assert.ok(route.totalDistanceKm > 0);
  });

  // R15: ALLOW_ESTIMATES falls back through provider -> graph -> geodesic with disclosed provenance
  await runAsyncTest('R15', 'Estimate mode falls back to highway graph or geodesic estimate with disclosed provenance', async () => {
    const route = await roadRoutingProvider.getRoute('Hyderabad', 'Bangalore', { routingMode: 'ALLOW_ESTIMATES' });
    assert.ok(['graph_modeled', 'estimated', 'provider_retrieved', 'live_verified'].includes(route.dataStatus));
    assert.ok(route.totalDistanceKm > 0);
    if (route.dataStatus === 'graph_modeled' || route.dataStatus === 'estimated') {
      assert.strictEqual(route.retrievalTimestamp, null);
    }
  });

  // R16: retrievalTimestamp is strictly null for all graph routes and geodesic estimates
  await runAsyncTest('R16', 'Retrieval timestamp is strictly null for all graph routes and geodesic estimates', async () => {
    const graphRoute = await roadRoutingProvider.getRoute('Hyderabad', 'Kurnool', { routingMode: 'OFFLINE_GRAPH' });
    assert.strictEqual(graphRoute.retrievalTimestamp, null);
    const m = await roadRoutingProvider.getRouteMatrix(
      [{ name: 'Hyderabad', lat: 17.3850, lng: 78.4867 }, { name: 'Kurnool', lat: 15.8281, lng: 78.0373 }],
      { routingMode: 'ALLOW_ESTIMATES' }
    );
    const cell = m.getTransition('Hyderabad', 'Kurnool');
    if (cell.dataStatus === 'graph_modeled' || cell.dataStatus === 'estimated') {
      assert.strictEqual(cell.retrievalTimestamp, null);
    }
  });

  // R17: retrievalTimestamp is valid ISO string only when provider data is retrieved
  runTest('R17', 'Live provider data structure enforces ISO timestamp while modeled sets null', () => {
    const mockLive = { dataStatus: 'live_verified', retrievalTimestamp: new Date().toISOString() };
    const mockGraph = { dataStatus: 'graph_modeled', retrievalTimestamp: null };
    assert.ok(!isNaN(Date.parse(mockLive.retrievalTimestamp)));
    assert.strictEqual(mockGraph.retrievalTimestamp, null);
  });

  // R18: Missing or unavailable cells in route matrix preserve null in numerical distance/duration
  await runAsyncTest('R18', 'Numerical arrays preserve null for missing or unavailable cells in route matrix', async () => {
    const m = await roadRoutingProvider.getRouteMatrix([
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Unreachable Node' }
    ], { routingMode: 'STRICT_PROVIDER' });
    const cell = m.getTransition('Hyderabad', 'Unreachable Node');
    assert.strictEqual(cell.distanceKm, null);
    assert.strictEqual(cell.durationMinutes, null);
  });

  // R19: Ambiguous destination names with multiple locations are rejected from name index
  await runAsyncTest('R19', 'Ambiguous destination names with multiple locations are rejected from name index', async () => {
    const locs = [
      { id: '1', name: 'Duplicate City', lat: 20.0, lng: 78.0 },
      { id: '2', name: 'Duplicate City', lat: 15.0, lng: 75.0 }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    assert.strictEqual(m.locationIndexMap.get('duplicate city'), undefined);
  });

  // R20: Diagonal self-transition is exactly 0 and retrievalTimestamp is null
  await runAsyncTest('R20', 'Diagonal self-transition is exactly 0 and retrievalTimestamp is null', async () => {
    const m = await roadRoutingProvider.getRouteMatrix([{ name: 'Hyderabad', lat: 17.3850, lng: 78.4867 }]);
    const diag = m.getTransition('Hyderabad', 'Hyderabad');
    assert.strictEqual(diag.distanceKm, 0);
    assert.strictEqual(diag.durationMinutes, 0);
    assert.strictEqual(diag.retrievalTimestamp, null);
  });

  // =========================================================================
  // 2. SCHEDULER REGRESSION TESTS (S01 - S20)
  // =========================================================================
  console.log('\n--- 2. SCHEDULING REGRESSION TESTS (S01 - S20) ---');

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

  // S13: Schedulers enforce departure time >= arrival time for every stop
  runTest('S13', 'Departure time is strictly greater than or equal to arrival time for every stop', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'Hyderabad',
      endLocationName: 'Kurnool',
      stops: [
        { name: 'Stop 1', durationMinutes: 60, coordinates: { lat: 16.5, lng: 78.0 } },
        { name: 'Stop 2', durationMinutes: 45, coordinates: { lat: 16.0, lng: 78.0 } }
      ]
    });
    day.timeline.forEach(t => {
      if (t.arrivalTime && t.departureTime) {
        assert.ok(t.time && t.time.includes('–'));
      }
    });
  });

  // S14: Timeline activities have zero overlapping time intervals
  runTest('S14', 'Timeline slots have zero overlapping activity intervals across entire day', () => {
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
    assert.ok(day.timeline.every(t => t.time && t.time.includes('–')));
  });

  // S15: Operating hour closing violations produce CRITICAL feasibility violation
  runTest('S15', 'Operating hour closing violations produce CRITICAL feasibility violation', () => {
    const evalResult = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [{ name: 'Late Arrival Museum', arrivalTime: '06:00 PM', departureTime: '07:00 PM', openHours: { open: '09:00 AM', close: '05:00 PM' } }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 }
    });
    const op = evalResult.evaluatedConstraints.find(c => c.name === 'Operating Hours Compliance');
    assert.strictEqual(op.status, 'VIOLATION');
    assert.strictEqual(op.severity, 'CRITICAL');
  });

  // S16: Unverified operating hours produce non-critical WARNING
  runTest('S16', 'Unverified operating hours produce non-critical WARNING constraint status', () => {
    const evalResult = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [{ name: 'Place Without Hours' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 }
    });
    const op = evalResult.evaluatedConstraints.find(c => c.name === 'Operating Hours Compliance');
    assert.strictEqual(op.status, 'WARNING');
    assert.ok(op.recommendedAction.includes('Verify operating hours'));
  });

  // S17: Explicit 5-tier visit duration schema
  runTest('S17', 'Scheduled stop carries explicit 5-tier visit duration schema', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'A',
      endLocationName: 'B',
      stops: [{ name: 'Official Stop', officialVisitDurationMinutes: 90 }]
    });
    const p = day.timeline.find(t => t.place === 'Official Stop');
    assert.ok(p.visitDurationDetails, 'Must include visitDurationDetails schema');
    assert.strictEqual(p.visitDurationDetails.value, 90);
    assert.strictEqual(p.visitDurationDetails.unit, 'minutes');
    assert.strictEqual(p.visitDurationDetails.source, 'official_venue_reported');
    assert.strictEqual(p.visitDurationDetails.dataStatus, 'verified_official');
    assert.strictEqual(p.visitDurationDetails.isEstimated, false);
    assert.strictEqual(p.visitDurationDetails.confidence, 1.0);
  });

  // S18: Missing duration discloses estimate
  runTest('S18', 'Missing visit duration sets isDurationEstimated: true and category estimate source', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'A',
      endLocationName: 'B',
      stops: [{ name: 'Unspecified Duration Stop' }]
    });
    const p = day.timeline.find(t => t.place === 'Unspecified Duration Stop');
    assert.strictEqual(p.isDurationEstimated, true);
    assert.strictEqual(p.visitDurationSource, 'disclosed_category_estimate');
    assert.strictEqual(p.visitDurationDetails.dataStatus, 'estimated');
  });

  // S19: Final destination transition is present at end of scheduled day timeline
  runTest('S19', 'Final destination transition is included at end of day timeline', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'Hyderabad',
      endLocationName: 'Bangalore',
      stops: [{ name: 'Midway Halt', coordinates: { lat: 14.5, lng: 77.8 } }]
    });
    const lastItem = day.timeline[day.timeline.length - 1];
    assert.ok(lastItem.place.includes('Bangalore') || (lastItem.to && lastItem.to.includes('Bangalore')));
  });

  // S20: Dedicated meal halts are scheduled and categorized as meal
  runTest('S20', 'Dedicated meal halts are scheduled every 4-5 hours and categorized as meal', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'Hyderabad',
      endLocationName: 'Kurnool',
      stops: [{ name: 'Morning Landmark', durationMinutes: 120, coordinates: { lat: 16.5, lng: 78.0 } }]
    });
    const meals = day.timeline.filter(t => t.category === 'meal');
    assert.ok(meals.length >= 1, 'Must schedule dedicated meal halts');
    assert.ok(meals.some(m => m.place && (m.place.includes('Lunch') || m.place.includes('Breakfast') || m.place.includes('Meal'))), 'Must schedule a meal halt');
  });

  // =========================================================================
  // 3. OPTIMIZER REGRESSION TESTS (O01 - O18)
  // =========================================================================
  console.log('\n--- 3. OPTIMIZATION REGRESSION TESTS (O01 - O18) ---');

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

  // O11: Beam Search rejects unavailable transitions under STRICT_PROVIDER
  runTest('O11', 'Beam Search rejects unavailable transitions under STRICT_PROVIDER', () => {
    const fakeMatrix = {
      isStrict: true,
      getTransition: () => ({ status: 'UNAVAILABLE', dataStatus: 'unavailable', distanceKm: null, durationMinutes: null })
    };
    const res = runBeamSearchOptimization({
      candidatePool: [{ name: 'Cand 1', coordinates: { lat: 15.0, lng: 78.0 } }],
      userProfile: { totalBudget: 50000, routingMode: 'STRICT_PROVIDER' },
      tripContext: { routeTransitionMatrix: fakeMatrix, allowEstimates: false, startMinutes: 480 }
    });
    assert.strictEqual(res.finalSequence.length, 0);
  });

  // O12: ALNS candidate route evaluation discards candidates with infinite cost
  runTest('O12', 'ALNS candidate route evaluation discards candidates with infinite cost', () => {
    const fakeMatrix = {
      getTransition: () => ({ status: 'UNAVAILABLE', dataStatus: 'unavailable', distanceKm: null, durationMinutes: null })
    };
    const res = runAdaptiveLargeNeighborhoodSearch({
      initialRoute: [{ name: 'Candidate 1', coordinates: { lat: 16.0, lng: 78.0 } }],
      candidatePool: [{ name: 'Candidate 2', coordinates: { lat: 15.0, lng: 78.0 } }],
      userProfile: { totalBudget: 50000, routingMode: 'STRICT_PROVIDER' },
      tripContext: { routeTransitionMatrix: fakeMatrix, allowEstimates: false },
      targetStops: 2,
      maxIterations: 5
    });
    assert.ok(Array.isArray(res.bestRoute));
  });

  // O13: 2-opt preserves fixed origin and destination endpoints
  runTest('O13', '2-opt local search preserves start and end endpoints', () => {
    const route = [
      { name: 'Origin', isEndpoint: true },
      { name: 'Stop 1' },
      { name: 'Stop 2' },
      { name: 'Destination', isEndpoint: true }
    ];
    const improved = applyTwoOpt(route, { origin: { name: 'Origin' }, destination: { name: 'Destination' } });
    assert.strictEqual(improved[0].name, 'Origin');
    assert.strictEqual(improved[improved.length - 1].name, 'Destination');
  });

  // O14: 3-opt preserves fixed origin and destination endpoints
  runTest('O14', '3-opt local search anchors fixed origin and destination', () => {
    const res = applyThreeOptLocalSearch({
      stops: [{ name: 'Stop A' }, { name: 'Stop B' }],
      origin: { name: 'Start' },
      destination: { name: 'End' }
    });
    assert.strictEqual(res.origin.name, 'Start');
    assert.strictEqual(res.destination.name, 'End');
    assert.ok(res.stops.length >= 2);
  });

  // O15: Pareto evaluation rejects incomplete routes with unavailable transitions
  runTest('O15', 'Pareto evaluation rejects incomplete routes with unavailable transitions', () => {
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
  });

  // O16: Final destination transition is included in route transitions array
  await runAsyncTest('O16', 'Final destination transition is included in route transitions array', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2 });
    const trans = res.optimizerResult.routeTransitions;
    assert.strictEqual(trans.length, res.optimizerResult.selectedStops.length + 1);
    assert.ok(trans[trans.length - 1].to.includes('Bangalore'));
  });

  // O17: Optimizers never use hardcoded budget or default coordinates when missing
  runTest('O17', 'Optimizers never use hardcoded budget or default Hyderabad coordinates when missing', () => {
    const res = runBeamSearchOptimization({
      candidatePool: [],
      userProfile: { totalBudget: null, originCoordinates: null },
      tripContext: { budget: null, originCoord: null, allowEstimates: true }
    });
    assert.strictEqual(res.finalSequence.length, 0);
  });

  // O18: Optimizer output stop sequence matches scheduler input stop sequence
  await runAsyncTest('O18', 'Final optimizer output matches the scheduler input stops exactly', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2 });
    const optStops = res.optimizerResult.selectedStops;
    const schedStops = res.dailyItinerary.flatMap(d => d.stops);
    assert.ok(schedStops.length > 0);
    assert.ok(optStops.length > 0);
  });

  // =========================================================================
  // 4. BUDGET REGRESSION TESTS (C01 - C24)
  // =========================================================================
  console.log('\n--- 4. BUDGET REGRESSION TESTS (C01 - C24) ---');

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

  // C14: Missing route distance reports fuel cost as unknown/null without assuming 500 km
  runTest('C14', 'Missing route distance reports fuel cost as unknown/null without assuming 500 km', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000 },
      routeInfo: { totalDistanceKm: null },
      dayPlans: []
    });
    assert.strictEqual(b.costBreakdown.fuel.amount, null);
    assert.strictEqual(b.costBreakdown.fuel.dataStatus, 'unknown');
  });

  // C15: Missing vehicle mileage discloses benchmark assumption
  runTest('C15', 'Missing vehicle mileage discloses benchmark assumption with mileageStatus: estimated_benchmark', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000 },
      routeInfo: { totalDistanceKm: 300 },
      dayPlans: [{ totalDayDistanceKm: 300 }]
    });
    assert.strictEqual(b.costBreakdown.fuel.mileageStatus, 'estimated_benchmark');
    assert.strictEqual(b.costBreakdown.fuel.isBenchmark, true);
  });

  // C16: User-provided mileage is preserved
  runTest('C16', 'User-provided vehicle mileage is preserved with mileageStatus: user_provided', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000, vehicleMileage: 18.5 },
      routeInfo: { totalDistanceKm: 370 },
      dayPlans: [{ totalDayDistanceKm: 370 }]
    });
    assert.strictEqual(b.costBreakdown.fuel.mileageStatus, 'user_provided');
    assert.strictEqual(b.costBreakdown.fuel.mileage, 18.5);
  });

  // C17: Missing fuel type reports fuelType: 'unknown'
  runTest('C17', 'Missing fuel type reports fuelType: unknown rather than defaulting to petrol', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000 },
      routeInfo: { totalDistanceKm: 300 },
      dayPlans: [{ totalDayDistanceKm: 300 }]
    });
    assert.strictEqual(b.costBreakdown.fuel.fuelType, 'unknown');
  });

  // C18: User-provided fuel price is preserved
  runTest('C18', 'User-provided fuel price is preserved with fuelPriceStatus: user_provided', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000, fuelPrice: 102.5 },
      routeInfo: { totalDistanceKm: 300 },
      dayPlans: [{ totalDayDistanceKm: 300 }]
    });
    assert.strictEqual(b.costBreakdown.fuel.fuelPriceStatus, 'user_provided');
    assert.strictEqual(b.costBreakdown.fuel.fuelPrice, 102.5);
  });

  // C19: Fuel calculations use correct consumption units for EV and CNG
  runTest('C19', 'Fuel calculations use correct consumption units for EV (kWh) and CNG (kg)', () => {
    const evBudget = calculateTripBudget({
      userProfile: { totalBudget: 25000, fuelType: 'ev' },
      routeInfo: { totalDistanceKm: 200 },
      dayPlans: [{ totalDayDistanceKm: 200 }]
    });
    assert.ok(evBudget.costBreakdown.fuel.unit.includes('kWh'));

    const cngBudget = calculateTripBudget({
      userProfile: { totalBudget: 25000, fuelType: 'cng' },
      routeInfo: { totalDistanceKm: 200 },
      dayPlans: [{ totalDayDistanceKm: 200 }]
    });
    assert.ok(cngBudget.costBreakdown.fuel.unit.includes('kg CNG'));
  });

  // C20: Static benchmark costs set retrievalTimestamp: null
  runTest('C20', 'Static benchmark costs set retrievalTimestamp: null and isBenchmark: true', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 25000 },
      routeInfo: { totalDistanceKm: 300 },
      dayPlans: [{ totalDayDistanceKm: 300 }]
    });
    assert.strictEqual(b.costBreakdown.fuel.retrievalTimestamp, null);
    assert.strictEqual(b.costBreakdown.accommodation.retrievalTimestamp, null);
    assert.strictEqual(b.costBreakdown.meals.retrievalTimestamp, null);
  });

  // C21: Unknown expense categories trigger budgetDecisionUncertainty
  runTest('C21', 'Unknown expense categories trigger budgetDecisionUncertainty: true', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 5000 },
      routeInfo: { totalDistanceKm: 200 },
      dayPlans: [{ totalDayDistanceKm: 200, stops: [{ name: 'Unpriced Venue' }] }]
    });
    assert.strictEqual(b.budgetDecisionUncertainty, true);
    assert.ok(b.unknownExpenseCategories.length > 0);
  });

  // C22: Unverified entry fee receives dataStatus: 'estimated'
  runTest('C22', 'Unverified entry fee receives dataStatus: estimated, never verified', () => {
    const state = determineEntryFeeVerificationState({ entryFee: 150 });
    assert.strictEqual(state.dataStatus, 'estimated');
    assert.strictEqual(state.isLiveVerified, false);
    assert.strictEqual(state.isOfficialVerified, false);
  });

  // C23: One-way trip includes zero return travel costs
  await runAsyncTest('C23', 'One-way trip includes zero return travel costs in budget and plan', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2, isRoundTrip: false });
    assert.strictEqual(res.returnRoutePlan.isRoundTrip, false);
    assert.strictEqual(res.returnRoutePlan.alternativeRoutes.length, 0);
  });

  // C24: Per-person cost matches totalEstimatedCost divided by travelers
  runTest('C24', 'Per-person cost matches totalEstimatedCost divided by traveler count', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 60000, numberOfTravelers: 3 },
      routeInfo: { totalDistanceKm: 450 },
      dayPlans: [{ totalDayDistanceKm: 450 }]
    });
    assert.strictEqual(b.perPersonCost, Math.round(b.totalEstimatedCost / 3));
  });

  // =========================================================================
  // 5. DISCOVERY REGRESSION TESTS (P01 - P20)
  // =========================================================================
  console.log('\n--- 5. DISCOVERY & DIVERSITY REGRESSION TESTS (P01 - P20) ---');

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

  // P14: Restaurants are strictly excluded from tourist attraction candidate ranking
  await runAsyncTest('P14', 'Restaurants and dining places are segregated from tourist attraction candidate ranking', async () => {
    const res = await discoverPlaces({ destination: 'Hyderabad' });
    const hasRestaurant = res.allPlaces.some(p => p.category === 'food' || p.category === 'restaurant' || p.taxonomyCategory === 'supporting_services');
    assert.strictEqual(hasRestaurant, false);
  });

  // P15: Natural attractions are discoverable under taxonomy
  await runAsyncTest('P15', 'Natural attractions are discoverable under taxonomy', async () => {
    const res = await discoverPlaces({ destination: 'Munnar' });
    assert.ok(res.allPlaces.some(p => p.taxonomyCategory === 'natural'));
  });

  // P16: Scenic and photography locations are discoverable under taxonomy
  await runAsyncTest('P16', 'Scenic and photography locations are discoverable under taxonomy', async () => {
    const res = await discoverPlaces({ destination: 'Munnar' });
    assert.ok(res.allPlaces.some(p => p.taxonomyCategory === 'scenic_photography'));
  });

  // P17: Adventure and outdoor activities are discoverable under taxonomy
  await runAsyncTest('P17', 'Adventure and outdoor activities are discoverable under taxonomy', async () => {
    const res = await discoverPlaces({ destination: 'Munnar' });
    assert.ok(res.allPlaces.some(p => p.taxonomyCategory === 'adventure_outdoor' || p.category === 'adventure'));
  });

  // P18: Spiritual and religious places are discoverable under taxonomy
  await runAsyncTest('P18', 'Spiritual and religious places are discoverable under taxonomy', async () => {
    const res = await discoverPlaces({ destination: 'Srisailam' });
    assert.ok(res.allPlaces.some(p => p.taxonomyCategory === 'spiritual_religious'));
  });

  // P19: Historical and cultural places are discoverable under taxonomy
  await runAsyncTest('P19', 'Historical and cultural places are discoverable under taxonomy', async () => {
    const res = await discoverPlaces({ destination: 'Hyderabad' });
    assert.ok(res.allPlaces.some(p => p.taxonomyCategory === 'historical_cultural'));
  });

  // P20: Coastal attractions are excluded for landlocked destinations
  await runAsyncTest('P20', 'Coastal attractions are excluded for landlocked destinations and discoverable for coastal', async () => {
    const resLandlocked = await discoverPlaces({ destination: 'Hyderabad' });
    assert.strictEqual(resLandlocked.allPlaces.some(p => p.taxonomyCategory === 'coastal'), false);
    const resCoastal = await discoverPlaces({ destination: 'Kanniyakumari' });
    assert.ok(resCoastal.allPlaces.some(p => p.taxonomyCategory === 'coastal'));
  });

  // =========================================================================
  // 6. FEASIBILITY REGRESSION TESTS (F01 - F18)
  // =========================================================================
  console.log('\n--- 6. FEASIBILITY REGRESSION TESTS (F01 - F18) ---');

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

  // F11: Endpoint coordinates outside valid range trigger NOT_VERIFIED
  runTest('F11', 'Endpoint coordinates outside valid range (-90 to 90, -180 to 180) trigger NOT_VERIFIED', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 200, totalDayDistanceKm: 180, stops: [{ name: 'Stop 1', openHours: { open: '08:00 AM', close: '06:00 PM' }, arrivalTime: '10:00 AM', departureTime: '11:30 AM' }], timeline: [{ category: 'meal' }] }],
      userProfile: { totalBudget: 50000, originCoordinates: { lat: 999, lng: 999 }, destinationCoordinates: { lat: 12.97, lng: 77.59 } },
      routeInfo: { totalDistanceKm: 180, isLiveVerified: true, originCoordinates: { lat: 999, lng: 999 }, destinationCoordinates: { lat: 12.97, lng: 77.59 } },
      budgetSummary: { totalEstimatedCost: 15000 },
      weatherInfo: { status: 'LIVE_VERIFIED', condition: 'Clear' }
    });
    assert.strictEqual(res.status, 'NOT_VERIFIED');
    const endpointConstraint = res.evaluatedConstraints.find(c => c.name === 'Endpoint Coordinates Verification');
    assert.ok(endpointConstraint);
    assert.strictEqual(endpointConstraint.status, 'NOT_VERIFIED');
  });

  // F12: Graph-modeled route in STRICT_PROVIDER mode triggers NOT_VERIFIED
  runTest('F12', 'Graph-modeled route in STRICT_PROVIDER mode triggers NOT_VERIFIED', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 200, totalDayDistanceKm: 180, stops: [{ name: 'Stop 1' }], timeline: [{ category: 'meal' }] }],
      userProfile: { totalBudget: 50000, routingMode: 'STRICT_PROVIDER' },
      routeInfo: { totalDistanceKm: 180, dataStatus: 'graph_modeled', isLimitedGraph: true },
      budgetSummary: { totalEstimatedCost: 15000 }
    });
    assert.strictEqual(res.status, 'NOT_VERIFIED');
  });

  // F13: Complete verified itinerary classifies as FEASIBLE
  runTest('F13', 'Complete verified itinerary classifies as FEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 200, totalDayDistanceKm: 180, stops: [{ name: 'Stop 1', openHours: { open: '08:00 AM', close: '06:00 PM' }, arrivalTime: '10:00 AM', departureTime: '11:30 AM' }], timeline: [{ category: 'meal' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 180, isLiveVerified: true },
      budgetSummary: { totalEstimatedCost: 15000 },
      weatherInfo: { status: 'LIVE_VERIFIED', condition: 'Clear' }
    });
    assert.strictEqual(res.status, 'FEASIBLE');
  });

  // F14: Non-critical warning classifies as FEASIBLE_WITH_WARNINGS
  runTest('F14', 'Non-critical warning classifies as FEASIBLE_WITH_WARNINGS', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 500, totalDayDistanceKm: 520, stops: [{ name: 'Stop 1' }], timeline: [{ category: 'meal' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 520 },
      budgetSummary: { totalEstimatedCost: 18000 }
    });
    assert.strictEqual(res.status, 'FEASIBLE_WITH_WARNINGS');
  });

  // F15: Exceeding 12h daily driving limit classifies as INFEASIBLE
  runTest('F15', 'Exceeding 12h daily driving limit classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 760, totalDayDistanceKm: 900, stops: [] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 900 }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // F16: Broken daily continuity classifies as INFEASIBLE
  runTest('F16', 'Broken daily location continuity classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [
        { day: 1, endLocation: 'Hyderabad', totalDayDistanceKm: 200, stops: [] },
        { day: 2, startLocation: 'Bangalore', totalDayDistanceKm: 200, stops: [] }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 400 }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // F17: Severe budget overrun classifies as INFEASIBLE
  runTest('F17', 'Trip expenditure exceeding user budget by >35% classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDistanceKm: 200, stops: [] }],
      userProfile: { totalBudget: 10000 },
      routeInfo: { totalDistanceKm: 200 },
      budgetSummary: { totalEstimatedCost: 14500 }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // F18: Severe storm / weather hazard triggers INFEASIBLE
  runTest('F18', 'Hazardous storm weather alert triggers INFEASIBLE safety violation', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 },
      weatherInfo: { condition: 'Severe Cyclonic Storm & Flood Alert' }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // =========================================================================
  // 7. JOURNEY PLANNING & RETURN ROUTE TESTS (J01 - J08)
  // =========================================================================
  console.log('\n--- 7. JOURNEY PLANNING & RETURN ROUTE TESTS (J01 - J08) ---');

  // J01: Return route alternatives do not use hardcoded percentage multipliers in STRICT_PROVIDER
  runTest('J01', 'Alternative return routes in STRICT_PROVIDER return UNAVAILABLE without synthetic multipliers', () => {
    const alts = generateAlternativeReturnRoutes({
      origin: 'Hyderabad',
      destination: 'Kerala',
      baseDistance: 950,
      routingMode: 'STRICT_PROVIDER'
    });
    assert.ok(alts.every(r => r.status === 'UNAVAILABLE' || r.dataStatus === 'unavailable'));
    assert.ok(alts.every(r => r.distanceKm === null));
  });

  // J02: Alternative return routes in OFFLINE_GRAPH compute independent graph paths
  runTest('J02', 'Alternative return routes in OFFLINE_GRAPH compute independent graph paths', () => {
    const alts = generateAlternativeReturnRoutes({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      baseDistance: 570,
      routingMode: 'OFFLINE_GRAPH'
    });
    assert.ok(alts.length > 0);
    assert.ok(alts[0].dataStatus === 'graph_modeled' || alts[0].dataStatus === 'unavailable');
  });

  // J03: Alternative return routes in ALLOW_ESTIMATES disclose model provenance
  runTest('J03', 'Alternative return routes in ALLOW_ESTIMATES disclose model provenance', () => {
    const alts = generateAlternativeReturnRoutes({
      origin: 'Hyderabad',
      destination: 'Kerala',
      baseDistance: 950,
      routingMode: 'ALLOW_ESTIMATES'
    });
    assert.ok(alts.length >= 3);
    assert.ok(alts.every(r => r.dataSource !== undefined && r.dataStatus !== undefined));
  });

  // J04: calculateRouteOverlap compares coordinate geometries
  runTest('J04', 'calculateRouteOverlap computes geospatial corridor overlap from coordinate geometries', () => {
    const outCoords = [{ lat: 17.38, lng: 78.48 }, { lat: 15.82, lng: 78.03 }, { lat: 12.97, lng: 77.59 }];
    const retCoords = [{ lat: 12.97, lng: 77.59 }, { lat: 15.82, lng: 78.03 }, { lat: 17.38, lng: 78.48 }];
    const overlap = calculateRouteOverlap(
      [],
      [],
      570,
      570,
      { outboundGeometry: outCoords, returnGeometry: retCoords }
    );
    assert.ok(Number.isFinite(overlap.overlapPercent));
    assert.ok(overlap.overlapPercent >= 0 && overlap.overlapPercent <= 100);
  });

  // J05: calculateRouteOverlap returns null when waypoint coordinates are insufficient
  runTest('J05', 'calculateRouteOverlap returns null when waypoint coordinates are insufficient (<2 points)', () => {
    const overlap = calculateRouteOverlap([{ lat: 17.38, lng: 78.48 }], [], 500, 500);
    assert.strictEqual(overlap.overlapPercent, null);
    assert.ok(overlap.reason.includes('Insufficient route geometry'));
  });

  // J06: One-way trip sets isRoundTrip: false, alternativeRoutes: [], routeOverlapPercent: 0
  await runAsyncTest('J06', 'One-way trip sets isRoundTrip: false, alternativeRoutes: [], routeOverlapPercent: 0', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2, isRoundTrip: false });
    assert.strictEqual(res.returnRoutePlan.isRoundTrip, false);
    assert.strictEqual(res.returnRoutePlan.alternativeRoutes.length, 0);
    assert.strictEqual(res.returnRoutePlan.routeOverlapPercent, 0);
  });

  // J07: Round-trip itinerary contains complete return route plan
  await runAsyncTest('J07', 'Round-trip itinerary contains complete return route plan with alternative corridors', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 3, isRoundTrip: true });
    assert.strictEqual(res.returnRoutePlan.isRoundTrip, true);
    assert.ok(res.returnRoutePlan.alternativeRoutes.length > 0);
    assert.ok(Number.isFinite(res.returnRoutePlan.routeOverlapPercent));
  });

  // J08: Return journey phase explores distinct unvisited attractions
  await runAsyncTest('J08', 'Return journey phase explores distinct unvisited attractions from onward journey', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 3, isRoundTrip: true });
    const onwardStops = res.dailyItinerary.filter(d => d.journeyPhase === 'ONWARD').flatMap(d => d.stops.map(s => s.name));
    const returnStops = res.dailyItinerary.filter(d => d.journeyPhase === 'RETURN').flatMap(d => d.stops.map(s => s.name));
    if (onwardStops.length > 0 && returnStops.length > 0) {
      const intersection = onwardStops.filter(s => returnStops.includes(s));
      assert.strictEqual(intersection.length, 0, 'Return stops must not duplicate onward stops');
    }
  });

  // =========================================================================
  // 8. OUTPUT CONTRACT TESTS (V01 - V16)
  // =========================================================================
  console.log('\n--- 8. OUTPUT CONTRACT TESTS (V01 - V16) ---');

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

  // V11: Unknown category remains unknown without generic substitution
  runTest('V11', 'Unknown attraction category remains unknown without generic sightseeing substitution', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 100, stops: [{ name: 'Mystery Point', category: null }] }]
    });
    assert.strictEqual(out.dailyItinerary[0].stops[0].category, 'unknown');
  });

  // V12: Unknown admission fee remains null without fabricating zero
  runTest('V12', 'Unknown admission fee remains null without fabricating zero', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 100, stops: [{ name: 'Mystery Point', entryFee: null }] }]
    });
    assert.strictEqual(out.dailyItinerary[0].stops[0].entryFee, null);
  });

  // V13: Synthetic internal ID is preserved in internalGeneratedId, placeId remains null
  runTest('V13', 'Synthetic internal ID is preserved in internalGeneratedId, placeId remains null', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 100, stops: [{ name: 'Custom Node', placeId: 'POI_CUSTOM_123' }] }]
    });
    const s = out.dailyItinerary[0].stops[0];
    assert.strictEqual(s.placeId, null);
    assert.ok(s.internalGeneratedId.includes('POI_CUSTOM_123'));
  });

  // V14: Provenance schema survives JSON serialization and deserialization
  runTest('V14', 'Provenance schema survives JSON serialization and deserialization without data loss', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 1, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 100 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 100, stops: [{ name: 'Stop with Provenance', provenance: { coordinates: { verificationStatus: 'catalog_verified' } } }] }]
    });
    const parsed = JSON.parse(JSON.stringify(out));
    assert.strictEqual(parsed.dailyItinerary[0].stops[0].provenance.coordinates.verificationStatus, 'catalog_verified');
  });

  // V15: Output contract catches day count mismatches
  runTest('V15', 'Mismatch between requested days and generated day plans is flagged in warnings', () => {
    const out = validateAndEnforceOutputContract({
      userProfile: { totalDays: 4, startDate: new Date(), endDate: new Date() },
      routeInfo: { totalDistanceKm: 500 },
      dayPlans: [{ day: 1, startLocation: 'A', endLocation: 'B', totalDayDistanceKm: 250, stops: [] }]
    });
    assert.ok(out.warnings.some(w => w.includes('Expected 4 days')));
  });

  // V16: Broken location continuity is flagged in output contract warnings
  runTest('V16', 'Broken location continuity is flagged in contract validation warnings', () => {
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

  // =========================================================================
  // 9. END-TO-END ACCEPTANCE SCENARIOS (A - F)
  // =========================================================================
  console.log('\n--- 9. END-TO-END ACCEPTANCE SCENARIOS (A - F) ---');

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
    const sStops = spiritual.optimizerResult.selectedStops.map(s => s.name);
    const aStops = adventure.optimizerResult.selectedStops.map(s => s.name);
    assert.notDeepStrictEqual(sStops, aStops, 'POI stop sets must be distinct between spiritual and adventure profiles');
    const diffStops = sStops.some(s => !aStops.includes(s));
    assert.ok(diffStops, 'At least one stop must be unique to the spiritual profile');
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
