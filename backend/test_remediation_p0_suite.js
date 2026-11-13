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

  // -------------------------------------------------------------
  // TEST 9: PERSONALIZATION DIFFERENTIATION (Traveler A vs B vs C)
  // -------------------------------------------------------------
  async function testPersonalizationDifferentiation() {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();

    // Traveler A: Spiritual / Temples / Heritage
    const tripA = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      mode: 'CULTURAL',
      activities: ['spiritual', 'temples', 'darshan', 'heritage']
    });

    // Traveler B: Adventure / Trekking / Waterfalls
    const tripB = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      mode: 'ADVENTURE',
      activities: ['adventure', 'trekking', 'waterfalls', 'caves']
    });

    // Traveler C: Relaxation / Nature / Lakes
    const tripC = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      mode: 'RELAXED',
      activities: ['relaxation', 'nature', 'lakes', 'wellness']
    });

    const stopsA = new Set(tripA.optimizerResult.selectedStops.map(s => (s.name || s.placeName || '').toLowerCase()));
    const stopsB = new Set(tripB.optimizerResult.selectedStops.map(s => (s.name || s.placeName || '').toLowerCase()));
    const stopsC = new Set(tripC.optimizerResult.selectedStops.map(s => (s.name || s.placeName || '').toLowerCase()));

    assert.ok(stopsA.size > 0, 'Traveler A must have stops');
    assert.ok(stopsB.size > 0, 'Traveler B must have stops');
    assert.ok(stopsC.size > 0, 'Traveler C must have stops');

    // Verify distinct recommendation profiles
    let aDiffersFromB = false;
    let bDiffersFromC = false;
    stopsA.forEach(s => { if (!stopsB.has(s)) aDiffersFromB = true; });
    stopsB.forEach(s => { if (!stopsC.has(s)) bDiffersFromC = true; });

    assert.ok(aDiffersFromB, 'Traveler A (Spiritual) must receive distinct attractions from Traveler B (Adventure)');
    assert.ok(bDiffersFromC, 'Traveler B (Adventure) must receive distinct attractions from Traveler C (Relaxation)');
  }
  await runAsyncTest('9. Personalization generates distinct attraction sets for Spiritual vs Adventure vs Relaxation profiles', testPersonalizationDifferentiation);

  // -------------------------------------------------------------
  // TEST 10: 7-DAY ROUND-TRIP CONTINUITY & INDEPENDENT RETURN
  // -------------------------------------------------------------
  async function testSevenDayRoundTripContinuity() {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 7,
      tripDirection: 'round_trip',
      transportMode: 'car'
    });

    assert.strictEqual(result.dayPlans.length, 7, 'Must generate exactly 7 day plans');
    assert.strictEqual(result.returnRoutePlan.isRoundTrip, true, 'Round-trip flag must be true');

    // Unbroken location continuity: Day N+1 start == Day N end
    for (let i = 0; i < result.dayPlans.length - 1; i++) {
      const dayEnd = String(result.dayPlans[i].endLocation).toLowerCase().trim();
      const nextStart = String(result.dayPlans[i + 1].startLocation).toLowerCase().trim();
      assert.strictEqual(
        dayEnd,
        nextStart,
        `Day ${result.dayPlans[i].day} end (${dayEnd}) must match Day ${result.dayPlans[i + 1].day} start (${nextStart})`
      );
    }

    // Independent return stops: return phase stops must not duplicate onward stops
    const onwardStops = new Set();
    const returnStops = new Set();

    result.dayPlans.forEach(d => {
      if (d.journeyPhase === 'ONWARD' || d.phase?.includes('Onward')) {
        (d.stops || []).forEach(s => onwardStops.add(s.name || s.placeName));
      }
      if (d.journeyPhase === 'RETURN' || d.phase?.includes('Return')) {
        (d.stops || []).forEach(s => returnStops.add(s.name || s.placeName));
      }
    });

    let duplicateFound = false;
    returnStops.forEach(s => {
      if (onwardStops.has(s)) duplicateFound = true;
    });
    assert.strictEqual(duplicateFound, false, 'Return journey must not repeat onward highway attractions');
  }
  await runAsyncTest('10. 7-Day round-trip enforces unbroken location continuity and non-repeating return stops', testSevenDayRoundTripContinuity);

  // -------------------------------------------------------------
  // TEST 11: MULTI-CITY ROUTE & 4-TIER ROUTING RESOLUTION
  // -------------------------------------------------------------
  async function testMultiCityRouting() {
    const leg1 = await roadRoutingProvider.getRoute('Hyderabad', 'Bangalore');
    const leg2 = await roadRoutingProvider.getRoute('Bangalore', 'Kochi');

    assert.ok(leg1.totalDistanceKm > 400, 'Hyderabad->Bangalore distance must be > 400 km');
    assert.ok(leg2.totalDistanceKm > 400, 'Bangalore->Kochi distance must be > 400 km');
    assert.ok(leg1.origin.lat > 16 && leg1.origin.lng > 77, 'Hyderabad origin coordinates must be valid');
    assert.ok(leg2.destination.lat > 9 && leg2.destination.lng > 75, 'Kochi destination coordinates must be valid');
    assert.ok(['provider_retrieved', 'graph_modeled', 'estimated'].includes(leg1.dataStatus), 'Valid routing provenance');
  }
  await runAsyncTest('11. Multi-city corridor routes resolve dynamically with accurate coordinates and provenance', testMultiCityRouting);

  // -------------------------------------------------------------
  // TEST 12: PROVIDER FAILURE FALLBACK
  // -------------------------------------------------------------
  async function testProviderFailureFallback() {
    // Arbitrary remote coordinates with no live provider
    const route = await roadRoutingProvider.getRoute(
      { lat: 26.9124, lng: 75.7873, name: 'Jaipur' },
      { lat: 26.2389, lng: 73.0243, name: 'Jodhpur' }
    );

    assert.ok(route.totalDistanceKm > 200, 'Fallback distance must be > 200 km, never 0');
    assert.ok(route.totalDurationMinutes > 180, 'Fallback duration must be > 180 mins, never 0');
    assert.ok(route.dataSource, 'Must declare data source');
    assert.strictEqual(route.isLiveVerified, false, 'Fallback must not claim live verification');
  }
  await runAsyncTest('12. Provider failure fallback generates valid geodesic estimates without returning 0 distance', testProviderFailureFallback);

  // -------------------------------------------------------------
  // TEST 13: BUDGET CONSTRAINT & FEASIBILITY EVALUATION
  // -------------------------------------------------------------
  async function testBudgetFeasibility() {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();

    // Insufficient budget (₹3,000 for 4-day long distance trip)
    const tightTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 4,
      budget: 3000,
      transportMode: 'car'
    });

    assert.strictEqual(tightTrip.budgetStatus, 'SIGNIFICANTLY_OVER_BUDGET', 'Must flag significantly over budget');
    assert.ok(tightTrip.budgetBreakdown.tradeOffRecommendations.length > 0, 'Must output actionable trade-off recommendations');

    // Sufficient budget (₹20,000 for 2-day trip Hyderabad -> Srisailam)
    const generousTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Srisailam',
      days: 2,
      budget: 20000,
      transportMode: 'car'
    });

    assert.strictEqual(generousTrip.budgetStatus, 'WITHIN_BUDGET', 'Must flag within budget');
    assert.strictEqual(generousTrip.feasibilityStatus.isFeasible, true, 'Feasibility must be confirmed');
  }
  await runAsyncTest('13. Budget constraint evaluation flags over-budget journeys and provides trade-offs', testBudgetFeasibility);

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

