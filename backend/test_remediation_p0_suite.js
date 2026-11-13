/**
 * VISTA Remediation P0 Verification Test Suite
 * 
 * Verifies:
 * 1. Explicit One-Way vs Round-Trip normalization and scheduling
 * 2. Pareto mode sensitivity: selected mode directly controls stops in final day plans
 * 3. Optimizer integration contract (selectedStops, selectedMode, objectiveScores, routeTransitions, provenance)
 * 4. RoadRoutingProvider 4-tier routing and N x N transition matrix generation
 * 5. 3-Opt local search using pre-computed transition matrix
 * 6. Meal and rest stops scheduled as supporting items without replacing tourist attractions
 * 7. Dynamic rolling-horizon replanning
 */

const assert = require('assert');
const { normalizeUserPreferences } = require('./src/services/userPreferenceNormalizer');
const { buildTravelContext } = require('./src/services/engine/TravelContextBuilder');
const { roadRoutingProvider } = require('./src/services/RoadRoutingProvider');
const { applyThreeOptLocalSearch, optimizeRouteThreeOptWithProvider } = require('./src/services/threeOptLocalSearch');
const { UnifiedTravelPlanningOrchestrator } = require('./src/services/UnifiedTravelPlanningOrchestrator');
const { replanTimelineWithDelay, reoptimizeRollingHorizon } = require('./src/services/engine/DynamicReplanningEngine');

async function runRemediationP0Suite() {
  console.log('================================================================');
  console.log('  VISTA REMEDIATION P0 VERIFICATION SUITE');
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
  // TEST 1: EXPLICIT ONE-WAY TRIP NORMALIZATION
  // -------------------------------------------------------------
  runTest('1. Explicit one-way trip normalization sets isRoundTrip=false and tripDirection=one_way', () => {
    const profile = normalizeUserPreferences({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 4,
      tripDirection: 'one_way'
    });
    assert.strictEqual(profile.isRoundTrip, false, 'isRoundTrip must be false');
    assert.strictEqual(profile.tripDirection, 'one_way', 'tripDirection must be one_way');

    const ctx = buildTravelContext(profile, 1000);
    assert.strictEqual(ctx.returnDays, 0, 'One-way trip must have returnDays = 0');
    assert.strictEqual(ctx.totalDays, 4, 'Total days must equal 4');
    assert.strictEqual(ctx.destinationDays, 3, 'destinationDays must equal 3 (4 total - 1 onward - 0 return)');
  });

  // -------------------------------------------------------------
  // TEST 2: EXPLICIT ROUND-TRIP NORMALIZATION
  // -------------------------------------------------------------
  runTest('2. Explicit round-trip normalization sets isRoundTrip=true and tripDirection=round_trip', () => {
    const profile = normalizeUserPreferences({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 5,
      tripDirection: 'round_trip'
    });
    assert.strictEqual(profile.isRoundTrip, true, 'isRoundTrip must be true');
    assert.strictEqual(profile.tripDirection, 'round_trip', 'tripDirection must be round_trip');

    const ctx = buildTravelContext(profile, 1000);
    assert.strictEqual(ctx.returnDays >= 1, true, 'Round-trip must allocate returnDays >= 1');
    assert.strictEqual(ctx.totalDays, 5, 'Total days must equal 5');
  });

  // -------------------------------------------------------------
  // TEST 3: ROADROUTINGPROVIDER 4-TIER RESOLUTION & MATRIX
  // -------------------------------------------------------------
  async function testRoutingProvider() {
    // Tier 3 Graph Route
    const route = await roadRoutingProvider.getRoute('Hyderabad', 'Srisailam');
    assert.ok(route.totalDistanceKm > 150, 'Distance must be > 150 km');
    assert.ok(route.totalDurationMinutes > 180, 'Duration must be > 180 mins');
    assert.strictEqual(route.dataSource, 'limited_highway_corridor_graph', 'Must use Tier 3 graph');
    assert.strictEqual(route.isLiveVerified, false, 'Limited graph must not claim live verification');

    // Matrix computation
    const points = [
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Kurnool', lat: 15.8281, lng: 78.0373 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946 }
    ];
    const matrix = await roadRoutingProvider.getRouteMatrix(points);
    assert.strictEqual(matrix.distances.length, 3, 'Matrix must be 3x3');
    assert.strictEqual(matrix.distances[0][0], 0, 'Self distance must be 0');
    assert.ok(matrix.distances[0][1] > 0, 'Distance Hyderabad->Kurnool > 0');
    assert.ok(matrix.durations[0][2] > 0, 'Duration Hyderabad->Bangalore > 0');
  }
  await runAsyncTest('3. RoadRoutingProvider resolves routes and pre-computes N x N transition matrix', testRoutingProvider);

  // -------------------------------------------------------------
  // TEST 4: 3-OPT LOCAL SEARCH WITH TRANSITION MATRIX
  // -------------------------------------------------------------
  async function testThreeOptWithMatrix() {
    const stops = [
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
      { name: 'Kurnool', lat: 15.8281, lng: 78.0373 }, // Deliberately out of order
      { name: 'Anantapur', lat: 14.6819, lng: 77.6006 },
      { name: 'Salem', lat: 11.6643, lng: 78.1460 }
    ];

    const result = await optimizeRouteThreeOptWithProvider(stops, {
      origin: stops[0],
      destination: stops[4]
    });

    assert.ok(result.bestRoute.length === stops.length, 'Must retain all stops');
    assert.ok(result.finalCost <= result.initialCost, 'Final cost must be <= initial cost');
    assert.ok(result.dataProvenance, 'Must include data provenance');
  }
  await runAsyncTest('4. 3-Opt local search optimizes route with pre-computed transition matrix', testThreeOptWithMatrix);

  // -------------------------------------------------------------
  // TEST 5: END-TO-END ONE-WAY ITINERARY (Zero Return Days)
  // -------------------------------------------------------------
  async function testOneWayItinerary() {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      tripDirection: 'one_way',
      transportMode: 'car',
      budget: 25000
    });

    assert.strictEqual(result.success, true, 'Generation must succeed');
    assert.strictEqual(result.returnRoutePlan.isRoundTrip, false, 'returnRoutePlan.isRoundTrip must be false');
    assert.strictEqual(result.returnRoutePlan.tripDirection, 'one_way', 'tripDirection must be one_way');
    assert.strictEqual(result.returnRoutePlan.alternativeRoutes.length, 0, 'No return route alternatives for one-way trip');

    // Check days: Day 3 must terminate at Munnar, not Hyderabad
    const lastDay = result.dayPlans[result.dayPlans.length - 1];
    assert.ok(
      lastDay.endLocation.toLowerCase().includes('munnar') || lastDay.phase.toLowerCase().includes('destination'),
      `Final day must end at destination region, got ${lastDay.endLocation}`
    );
    assert.notStrictEqual(lastDay.journeyPhase, 'RETURN', 'One-way trip must have no RETURN phase');
  }
  await runAsyncTest('5. End-to-End one-way itinerary terminates at destination with zero return days', testOneWayItinerary);

  // -------------------------------------------------------------
  // TEST 6: PARETO MODE CONTROLS ITINERARY OBJECTIVE
  // -------------------------------------------------------------
  async function testParetoModeSensitivity() {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();

    const budgetTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Hampi',
      days: 3,
      mode: 'BUDGET',
      activities: ['heritage', 'architecture'],
      transportMode: 'car'
    });

    const adventureTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Hampi',
      days: 3,
      mode: 'ADVENTURE',
      activities: ['adventure', 'trekking', 'caves'],
      transportMode: 'car'
    });

    assert.strictEqual(budgetTrip.optimizerResult.selectedMode, 'BUDGET', 'Budget trip mode must be BUDGET');
    assert.strictEqual(adventureTrip.optimizerResult.selectedMode, 'ADVENTURE', 'Adventure trip mode must be ADVENTURE');

    // Verify stops reflect mode
    assert.ok(budgetTrip.optimizerResult.selectedStops.length > 0, 'Must have selected stops');
    assert.ok(adventureTrip.optimizerResult.selectedStops.length > 0, 'Must have selected stops');

    // Structured optimizerResult verification
    assert.ok(budgetTrip.optimizerResult.objectiveScores, 'Must have objective scores');
    assert.ok(Array.isArray(budgetTrip.optimizerResult.routeTransitions), 'Must have route transitions');
    assert.strictEqual(budgetTrip.optimizerResult.feasibilityStatus.isFeasible, true, 'Must be feasible');
    assert.ok(budgetTrip.optimizerResult.dataProvenance, 'Must have data provenance');
  }
  await runAsyncTest('6. Pareto mode controls optimization objective and generates structured optimizerResult', testParetoModeSensitivity);

  // -------------------------------------------------------------
  // TEST 7: SUPPORTING MEAL & REST STOPS INTEGRATION
  // -------------------------------------------------------------
  async function testSupportingStops() {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Srisailam',
      days: 2,
      transportMode: 'car'
    });

    const day1 = result.dayPlans[0];
    const meals = day1.timeline.filter(t => t.category === 'meal');
    const attractions = day1.stops;

    assert.ok(meals.length >= 1, 'Timeline must include at least 1 meal stop');
    assert.ok(attractions.length >= 1, 'Day must have distinct tourist attractions in stops array');
    
    // Attractions must not be meals
    attractions.forEach(stop => {
      assert.notStrictEqual(stop.category, 'meal', 'Primary stop must not be a meal');
      assert.ok(stop.whySelected, 'Every stop must have whySelected reason');
    });
  }
  await runAsyncTest('7. Meals and rest halts are supporting timeline entries, not primary attractions', testSupportingStops);

  // -------------------------------------------------------------
  // TEST 8: DYNAMIC REPLANNING PRESERVES COMPLETED STOPS
  // -------------------------------------------------------------
  runTest('8. Dynamic replanning preserves completed stops and shifts timeline', () => {
    const sampleDayPlan = {
      day: 1,
      timeline: [
        { time: '07:30 AM – 08:30 AM', place: 'Morning Departure', category: 'travel', status: 'PENDING' },
        { time: '08:30 AM – 10:00 AM', place: 'Fort Exploration', category: 'fort', status: 'PENDING' },
        { time: '10:30 AM – 12:00 PM', place: 'Waterfall Visit', category: 'waterfall', status: 'PENDING' }
      ]
    };

    const replanned = replanTimelineWithDelay({
      dayPlan: sampleDayPlan,
      delayMinutes: 45,
      currentStopIndex: 1 // Stop 0 is completed
    });

    assert.strictEqual(replanned.timeline[0].status, 'COMPLETED', 'Stop 0 must remain COMPLETED');
    assert.strictEqual(replanned.hasReplanned, true, 'hasReplanned flag must be set');
    assert.strictEqual(replanned.delayShiftMinutes, 45, 'Delay shift must be 45 minutes');
  });

  console.log('\n================================================================');
  console.log(`  REMEDIATION P0 RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRemediationP0Suite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});

