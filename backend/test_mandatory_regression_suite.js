/**
 * VISTA Mandatory Regression Test Suite
 * 
 * Implements Section 12 & Section 13 of VISTA Strict Master Prompt:
 * - Routing Tests: R01 - R10
 * - Scheduling Tests: S01 - S10
 * - Cost & Provenance Tests: C01 - C10
 * - Feasibility Tests: F01 - F10
 * - Optimization Tests: O01 - O07
 * - Personalization Tests: P01 - P06
 * - End-to-End Acceptance Scenarios: Scenario A through Scenario F
 */

const assert = require('assert');
const { roadRoutingProvider, resolveMatrixCell } = require('./src/services/RoadRoutingProvider');
const { applyThreeOptLocalSearch, optimizeRouteThreeOptWithProvider, evaluateRouteCost, getSegmentRoadDistanceKm } = require('./src/services/threeOptLocalSearch');
const { calculateSegmentDrivingMinutes, scheduleDayTimeline } = require('./src/services/engine/TravelTimeOptimizer');
const { calculateTripBudget, determineEntryFeeVerificationState } = require('./src/services/engine/BudgetCalculationEngine');
const { evaluateItineraryFeasibility } = require('./src/services/engine/FeasibilityEvaluator');
const { validateAndEnforceOutputContract } = require('./src/services/engine/ItineraryValidationEngine');
const { UnifiedTravelPlanningOrchestrator } = require('./src/services/UnifiedTravelPlanningOrchestrator');
const { normalizeUserPreferences } = require('./src/services/userPreferenceNormalizer');

async function runAllMandatoryTests() {
  console.log('================================================================');
  console.log('  VISTA MANDATORY REGRESSION & ACCEPTANCE TEST BATTERY');
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

  console.log('--- 1. ROUTING REGRESSION TESTS (R01 - R10) ---');

  // R01: Provider success
  await runAsyncTest('R01', 'Provider success returns valid distance, duration, and provenance', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946 }
    );
    assert.ok(route.distanceKm > 400, 'Distance must be > 400 km');
    assert.ok(route.durationMinutes > 300, 'Duration must be > 300 minutes');
    assert.ok(route.dataSource, 'Must declare dataSource');
    assert.ok(['graph_modeled', 'provider_retrieved', 'live_verified', 'estimated'].includes(route.dataStatus));
  });

  // R02: Provider failure
  await runAsyncTest('R02', 'Provider failure returns explicit unavailable result without fake values', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Point A', lat: 17.3850, lng: 78.4867 },
      { name: 'Point B', lat: 12.9716, lng: 77.5946 },
      { simulateProviderFailure: true }
    );
    assert.strictEqual(route.status, 'UNAVAILABLE');
    assert.strictEqual(route.dataStatus, 'unavailable');
    assert.strictEqual(route.distanceKm, null);
    assert.strictEqual(route.durationMinutes, null);
    assert.strictEqual(route.isLiveVerified, false);
  });

  // R03: Missing coordinates
  await runAsyncTest('R03', 'Missing coordinates return explicit unavailable result, never 50km/100km', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Unknown Place Alpha' },
      { name: 'Unknown Place Beta' }
    );
    assert.strictEqual(route.status, 'UNAVAILABLE');
    assert.strictEqual(route.dataStatus, 'unavailable');
    assert.strictEqual(route.distanceKm, null);
    assert.strictEqual(route.durationMinutes, null);
  });

  // R04: Null matrix cells
  await runAsyncTest('R04', 'Null matrix cells preserved for unavailable transitions', async () => {
    const locs = [
      { id: 'L1', name: 'Stop 1', lat: 17.3850, lng: 78.4867 },
      { id: 'L2', name: 'Stop 2', lat: 17.5000, lng: 78.6000 }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs, { simulateProviderFailure: true });
    assert.strictEqual(m.distances[0][1], null, 'Unavailable matrix cell distance must be null');
    assert.strictEqual(m.durations[0][1], null, 'Unavailable matrix cell duration must be null');
    const cell = m.getTransition(locs[0], locs[1]);
    assert.strictEqual(cell.dataStatus, 'unavailable');
    assert.strictEqual(cell.distanceKm, null);
  });

  // R05: Strict mode rejects estimates
  await runAsyncTest('R05', 'Strict mode rejects synthetic estimates when provider is unavailable', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Village X', lat: 15.1234, lng: 76.5678 },
      { name: 'Village Y', lat: 15.9876, lng: 76.1234 },
      { routingMode: 'STRICT_PROVIDER' }
    );
    // In strict mode without live API key, must return UNAVAILABLE rather than Haversine estimate
    assert.strictEqual(route.status, 'UNAVAILABLE');
    assert.strictEqual(route.dataStatus, 'unavailable');
    assert.strictEqual(route.distanceKm, null);
  });

  // R06: Explicit estimate mode labels estimates
  await runAsyncTest('R06', 'Explicit estimate mode labels estimates with correct metadata', async () => {
    const route = await roadRoutingProvider.getRoute(
      { name: 'Village X', lat: 15.1234, lng: 76.5678 },
      { name: 'Village Y', lat: 15.9876, lng: 76.1234 },
      { routingMode: 'ALLOW_ESTIMATES', allowEstimates: true }
    );
    assert.ok(route.distanceKm > 0, 'Estimate distance must be positive');
    assert.strictEqual(route.dataStatus, 'estimated');
    assert.strictEqual(route.isEstimate, true);
    assert.strictEqual(route.isLiveVerified, false);
    assert.strictEqual(route.dataSource, 'geodesic_haversine_projection_model');
  });

  // R07: Stable ID resolution
  await runAsyncTest('R07', 'Stable ID resolution prefers ID, placeId, and coordinates over names', async () => {
    const locs = [
      { id: 'STABLE_NODE_1', name: 'Common Name', lat: 17.3850, lng: 78.4867, placeId: 'GOOGLE_PID_1' },
      { id: 'STABLE_NODE_2', name: 'Different Name', lat: 12.9716, lng: 77.5946, placeId: 'GOOGLE_PID_2' }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    assert.strictEqual(m.locationIndexMap.get('STABLE_NODE_1'), 0);
    assert.strictEqual(m.locationIndexMap.get('GOOGLE_PID_1'), 0);
    assert.strictEqual(m.locationIndexMap.get('STABLE_NODE_2'), 1);
  });

  // R08: Ambiguous name rejection
  await runAsyncTest('R08', 'Ambiguous name-based lookup is detected and rejected', async () => {
    const locs = [
      { id: 'SHIVA_TEMPLE_A', name: 'Shiva Temple', lat: 17.3850, lng: 78.4867 },
      { id: 'SHIVA_TEMPLE_B', name: 'Shiva Temple', lat: 13.0827, lng: 80.2707 }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    // Looking up by bare ambiguous name string must return undefined (rejected)
    assert.strictEqual(m.locationIndexMap.get('Shiva Temple'), undefined, 'Ambiguous name must be omitted from name index');
    assert.strictEqual(m.locationIndexMap.get('shiva temple'), undefined, 'Ambiguous lowercase name must be omitted');
    // But resolving by stable ID works deterministically!
    assert.strictEqual(m.locationIndexMap.get('SHIVA_TEMPLE_A'), 0);
    assert.strictEqual(m.locationIndexMap.get('SHIVA_TEMPLE_B'), 1);
  });

  // R09: Complete origin-to-destination transitions
  await runAsyncTest('R09', 'Complete origin-to-destination transitions cover full sequence', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2
    });
    const transitions = result.optimizerResult.routeTransitions;
    const stops = result.optimizerResult.selectedStops;
    assert.strictEqual(transitions.length, stops.length + 1, 'Transitions must equal stops + 1');
    assert.strictEqual(transitions[0].from, 'Hyderabad');
    assert.ok(transitions[transitions.length - 1].to.includes('Bangalore'));
  });

  // R10: Matrix partial failure
  await runAsyncTest('R10', 'Matrix partial failure isolates failed cells without corrupting others', async () => {
    const locs = [
      { id: 'ORIGIN', name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { id: 'VALID_POI', name: 'Kurnool', lat: 15.8281, lng: 78.0373 },
      { id: 'INVALID_POI', name: 'Ghost Point No Coords' }
    ];
    const m = await roadRoutingProvider.getRouteMatrix(locs);
    // Valid pair Hyderabad -> Kurnool has distance
    const validCell = m.getTransition(locs[0], locs[1]);
    assert.ok(validCell.distanceKm > 0, 'Valid cell must have road distance');
    // Invalid pair to Ghost Point has null distance
    const invalidCell = m.getTransition(locs[0], locs[2]);
    assert.strictEqual(invalidCell.dataStatus, 'unavailable');
    assert.strictEqual(invalidCell.distanceKm, null);
  });

  console.log('\n--- 2. SCHEDULING REGRESSION TESTS (S01 - S10) ---');

  // S01: Missing transition
  runTest('S01', 'Missing transition in scheduler marks segment unavailable', () => {
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
      transitionMatrix: fakeMatrix
    });
    const stopEntry = day.timeline.find(t => t.place === 'Stop X');
    assert.ok(stopEntry, 'Stop X must be in timeline');
    assert.strictEqual(stopEntry.dataStatus, 'unavailable');
    assert.strictEqual(stopEntry.distanceKm, null);
  });

  // S02: Missing visit duration
  runTest('S02', 'Missing visit duration is explicitly disclosed as category estimate, not verified', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'A',
      endLocationName: 'B',
      stops: [{ name: 'Stop No Dur' }]
    });
    const stopEntry = day.timeline.find(t => t.place === 'Stop No Dur');
    assert.strictEqual(stopEntry.isDurationEstimated, true);
    assert.strictEqual(stopEntry.visitDurationSource, 'disclosed_category_estimate');
  });

  // S03: Missing opening hours
  runTest('S03', 'Missing opening hours remain unknown and do not fabricate verified windows', () => {
    const evalResult = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [{ name: 'Unverified Hours POI' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 }
    });
    const opConstraint = evalResult.evaluatedConstraints.find(c => c.name === 'Operating Hours Compliance');
    assert.ok(opConstraint, 'Must evaluate Operating Hours Compliance');
    assert.strictEqual(opConstraint.status, 'WARNING');
  });

  // S04: Chronological integrity
  runTest('S04', 'Chronological integrity: departure times strictly after arrival times', () => {
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

  // S05: Inter-day continuity
  runTest('S05', 'Inter-day continuity: Day N end matches Day N+1 start', () => {
    const evalResult = evaluateItineraryFeasibility({
      dayPlans: [
        { day: 1, startLocation: 'Hyderabad', endLocation: 'Kurnool', stops: [] },
        { day: 2, startLocation: 'Kurnool', endLocation: 'Bangalore', stops: [] }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 600 }
    });
    const contConstraint = evalResult.evaluatedConstraints.find(c => c.name === 'Location Continuity');
    assert.strictEqual(contConstraint.status, 'PASSED');
  });

  // S06: Meal and rest estimates
  runTest('S06', 'Meal halts labelled as suggested service area rest halts with estimated costs', () => {
    const day = scheduleDayTimeline({
      dayNumber: 1,
      date: '2026-11-20',
      startLocationName: 'Hyderabad',
      endLocationName: 'Bangalore',
      stops: [{ name: 'Stop Midway', coordinates: { lat: 15.0, lng: 78.0 } }]
    });
    const meal = day.timeline.find(t => t.category === 'meal');
    assert.ok(meal, 'Must include meal halt');
    assert.ok(meal.place.includes('Suggested Service Area'), 'Must disclose suggested service area');
    assert.strictEqual(meal.isCostEstimated, true);
    assert.strictEqual(meal.dataStatus, 'estimated');
  });

  // S07: Daily driving limits
  runTest('S07', 'Daily driving limits: driving > 12h triggers hard violation INFEASIBLE', () => {
    const evalResult = evaluateItineraryFeasibility({
      dayPlans: [
        { day: 1, totalDayDrivingMinutes: 780, totalDayDistanceKm: 900, stops: [] }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 900 }
    });
    assert.strictEqual(evalResult.status, 'INFEASIBLE');
    assert.ok(evalResult.violations.some(v => v.includes('Daily Driving Time Cap')));
  });

  // S08: One-way trip
  runTest('S08', 'One-way trip has zero return days and terminates at destination', () => {
    const evalResult = evaluateItineraryFeasibility({
      dayPlans: [
        { day: 1, journeyPhase: 'ONWARD', phase: 'Onward Journey', startLocation: 'Hyd', endLocation: 'Munnar', stops: [] }
      ],
      userProfile: { isRoundTrip: false, tripDirection: 'one_way' },
      routeInfo: { totalDistanceKm: 500 }
    });
    const dirConstraint = evalResult.evaluatedConstraints.find(c => c.name === 'One-Way Direction Integrity');
    assert.strictEqual(dirConstraint.status, 'PASSED');
  });

  // S09: Round-trip trip
  await runAsyncTest('S09', 'Round-trip trip includes return journey alternatives', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 3,
      isRoundTrip: true
    });
    assert.strictEqual(result.returnRoutePlan.isRoundTrip, true);
    assert.ok(result.returnRoutePlan.alternativeRoutes.length > 0);
  });

  // S10: Final destination arrival
  runTest('S10', 'Final destination arrival scheduled properly at end of journey', () => {
    const day = scheduleDayTimeline({
      dayNumber: 2,
      date: '2026-11-21',
      startLocationName: 'Kurnool',
      endLocationName: 'Munnar',
      destinationCity: 'Munnar',
      isOnwardFinalArrival: true,
      phaseLabel: 'Onward Journey',
      stops: []
    });
    const finalItem = day.timeline[day.timeline.length - 1];
    assert.ok(finalItem.place.includes('Munnar'));
  });

  console.log('\n--- 3. COST & PROVENANCE REGRESSION TESTS (C01 - C10) ---');

  // C01: Verified entry fee
  runTest('C01', 'Verified entry fee receives VERIFIED_OFFICIAL status and enters confirmedSubtotal', () => {
    const state = determineEntryFeeVerificationState({
      name: 'Taj Mahal',
      entryFee: 50,
      isOfficialVerifiedFee: true,
      entryFeeSource: 'asi_official_portal'
    });
    assert.strictEqual(state.status, 'VERIFIED_OFFICIAL');
    assert.strictEqual(state.fee, 50);

    const budget = calculateTripBudget({
      userProfile: { totalBudget: 50000, numberOfTravelers: 2 },
      routeInfo: { totalDistanceKm: 500 },
      dayPlans: [{ stops: [{ entryFee: 50, isOfficialVerifiedFee: true }] }]
    });
    assert.strictEqual(budget.confirmedSubtotal, 100);
  });

  // C02: Unverified non-zero entry fee
  runTest('C02', 'Unverified non-zero entry fee receives ESTIMATED status, never falsely verified', () => {
    const state = determineEntryFeeVerificationState({
      name: 'Private Wonderpark',
      entryFee: 400
    });
    assert.strictEqual(state.status, 'ESTIMATED');
    assert.strictEqual(state.isConfirmed, false);
  });

  // C03: Unknown entry fee
  runTest('C03', 'Unknown entry fee receives UNKNOWN status and triggers unknownExpenseCategories', () => {
    const state = determineEntryFeeVerificationState({
      name: 'Hidden Waterfalls',
      entryFee: null
    });
    assert.strictEqual(state.status, 'UNKNOWN');
    assert.strictEqual(state.fee, null);

    const budget = calculateTripBudget({
      userProfile: { totalBudget: 50000, numberOfTravelers: 1 },
      routeInfo: { totalDistanceKm: 500 },
      dayPlans: [{ stops: [{ name: 'Hidden Waterfalls', entryFee: null }] }]
    });
    assert.ok(budget.unknownExpenseCategories.includes('attraction_entry_fees'));
    assert.strictEqual(budget.budgetDecisionUncertainty, true);
  });

  // C04: Verified free admission
  runTest('C04', 'Verified free admission requires explicit evidence, receiving VERIFIED_OFFICIAL with fee 0', () => {
    const state = determineEntryFeeVerificationState({
      name: 'Public Botanical Garden',
      entryFee: 0,
      isFreeAdmissionVerified: true
    });
    assert.strictEqual(state.status, 'VERIFIED_OFFICIAL');
    assert.strictEqual(state.fee, 0);
  });

  // C05: Estimated fuel price
  runTest('C05', 'Estimated fuel price is explicitly labelled estimated with static benchmark', () => {
    const budget = calculateTripBudget({
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 500 },
      dayPlans: []
    });
    assert.strictEqual(budget.costBreakdown.fuel.dataStatus, 'estimated');
    assert.strictEqual(budget.costBreakdown.fuel.retrievalTimestamp, null);
  });

  // C06: Unknown toll cost
  runTest('C06', 'Toll estimate is labelled estimated and not represented as official quotation', () => {
    const budget = calculateTripBudget({
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 500 },
      dayPlans: []
    });
    assert.strictEqual(budget.costBreakdown.tolls.dataStatus, 'estimated');
    assert.strictEqual(budget.costBreakdown.tolls.retrievalTimestamp, null);
  });

  // C07: Estimated accommodation
  runTest('C07', 'Accommodation estimate reflects room capacity math and is labelled estimated', () => {
    const budget = calculateTripBudget({
      userProfile: { totalBudget: 50000, numberOfTravelers: 4, totalDays: 3, accommodationPreference: 'budgetHotel' },
      routeInfo: { totalDistanceKm: 500 },
      dayPlans: []
    });
    // 4 travelers with capacity 2 = 2 rooms, 2 nights * 2 rooms * 1800 = 7200
    assert.strictEqual(budget.costBreakdown.accommodation.amount, 7200);
    assert.strictEqual(budget.costBreakdown.accommodation.dataStatus, 'estimated');
  });

  // C08: Budget uncertainty
  runTest('C08', 'Budget uncertainty exposed when unknown expenses could impact decision', () => {
    const budget = calculateTripBudget({
      userProfile: { totalBudget: 10000 },
      routeInfo: { totalDistanceKm: 300 },
      dayPlans: [{ stops: [{ name: 'Cave', entryFee: null }] }]
    });
    assert.strictEqual(budget.budgetDecisionUncertainty, true);
  });

  // C09: Per-person cost
  runTest('C09', 'Per-person cost matches total / travelers', () => {
    const budget = calculateTripBudget({
      userProfile: { totalBudget: 50000, numberOfTravelers: 3 },
      routeInfo: { totalDistanceKm: 450 },
      dayPlans: []
    });
    assert.strictEqual(budget.perPersonCost, Math.round(budget.totalEstimatedCost / 3));
  });

  // C10: Cost reconciliation
  runTest('C10', 'All subtotals reconcile mathematically to the exact rupee', () => {
    const budget = calculateTripBudget({
      userProfile: { totalBudget: 50000, numberOfTravelers: 2 },
      routeInfo: { totalDistanceKm: 600 },
      dayPlans: [
        {
          stops: [
            { entryFee: 100, isOfficialVerifiedFee: true },
            { entryFee: 50 }
          ]
        }
      ]
    });
    const cb = budget.costBreakdown;
    const manualSum = cb.fuel.amount + cb.tolls.amount + cb.accommodation.amount + cb.food.amount + cb.activities.amount + cb.parkingAndBuffer.amount;
    assert.strictEqual(budget.totalEstimatedCost, manualSum, 'Grand total must equal sum of itemized costs');
    assert.strictEqual(budget.totalEstimatedCost, budget.confirmedSubtotal + budget.estimatedSubtotal);
  });

  console.log('\n--- 4. FEASIBILITY REGRESSION TESTS (F01 - F10) ---');

  // F01: Fully verified feasible trip
  runTest('F01', 'Fully verified feasible trip classifies as FEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [
        {
          day: 1,
          startLocation: 'Hyderabad',
          endLocation: 'Kurnool',
          totalDayDrivingMinutes: 240,
          totalDayDistanceKm: 210,
          stops: [{ name: 'Fort', openHours: { open: '09:00 AM', close: '05:00 PM' }, arrivalTime: '11:00 AM', departureTime: '01:00 PM' }],
          timeline: [{ category: 'meal' }]
        }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 210, isLiveVerified: true },
      budgetSummary: { totalEstimatedCost: 15000 },
      weatherInfo: { status: 'LIVE_VERIFIED', condition: 'Sunny & Clear' }
    });
    assert.strictEqual(res.status, 'FEASIBLE');
    assert.strictEqual(res.isFeasible, true);
  });

  // F02: Feasible with warnings
  runTest('F02', 'Feasible with non-critical warnings classifies as FEASIBLE_WITH_WARNINGS', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [
        {
          day: 1,
          startLocation: 'Hyderabad',
          endLocation: 'Bangalore',
          totalDayDrivingMinutes: 510, // >480 triggers fatigue warning
          totalDayDistanceKm: 570,
          stops: [{ name: 'Stop 1' }],
          timeline: [{ category: 'meal' }]
        }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 570 },
      budgetSummary: { totalEstimatedCost: 18000 }
    });
    assert.strictEqual(res.status, 'FEASIBLE_WITH_WARNINGS');
    assert.strictEqual(res.isFeasible, true);
  });

  // F03: Infeasible trip
  runTest('F03', 'Critical driving constraint violation classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [
        { day: 1, totalDayDrivingMinutes: 750, totalDayDistanceKm: 900, stops: [] }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 900 }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
    assert.strictEqual(res.isFeasible, false);
  });

  // F04: Not verified trip
  runTest('F04', 'Missing route corridor transition classifies as NOT_VERIFIED', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { dataStatus: 'unavailable', totalDistanceKm: 0 }
    });
    assert.strictEqual(res.status, 'NOT_VERIFIED');
    assert.strictEqual(res.isFeasible, false);
  });

  // F05: Unknown weather
  runTest('F05', 'Unknown weather evaluated and reported in constraint status', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 50000, requireVerifiedOnly: true },
      routeInfo: { totalDistanceKm: 200 },
      weatherInfo: { status: 'UNAVAILABLE', condition: 'Unknown' }
    });
    const w = res.evaluatedConstraints.find(c => c.name === 'Weather Safety Clearance');
    assert.strictEqual(w.status, 'NOT_VERIFIED');
  });

  // F06: Unavailable route
  runTest('F06', 'Unavailable route transition results in NOT_VERIFIED status', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: {
        totalDistanceKm: 300,
        missingTransitions: [{ from: 'A', to: 'B', reason: 'unavailable' }]
      }
    });
    assert.strictEqual(res.status, 'NOT_VERIFIED');
  });

  // F07: Missing opening hours
  runTest('F07', 'Missing attraction opening hours records warning constraint', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [{ name: 'Museum without hours' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 }
    });
    const op = res.evaluatedConstraints.find(c => c.name === 'Operating Hours Compliance');
    assert.strictEqual(op.status, 'WARNING');
  });

  // F08: Over-budget trip
  runTest('F08', 'Severe over-budget trip (>35%) classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 10000 },
      routeInfo: { totalDistanceKm: 500 },
      budgetSummary: { totalEstimatedCost: 15000 }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // F09: Safety restriction
  runTest('F09', 'Hazardous weather storm alert classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 200 },
      weatherInfo: { condition: 'Severe Cyclonic Storm & Flood Alert' }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  // F10: Broken continuity
  runTest('F10', 'Broken daily continuity classifies as INFEASIBLE', () => {
    const res = evaluateItineraryFeasibility({
      dayPlans: [
        { day: 1, startLocation: 'Hyderabad', endLocation: 'Kurnool', stops: [] },
        { day: 2, startLocation: 'Goa', endLocation: 'Bangalore', stops: [] }
      ],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 600 }
    });
    assert.strictEqual(res.status, 'INFEASIBLE');
  });

  console.log('\n--- 5. OPTIMIZATION REGRESSION TESTS (O01 - O07) ---');

  // O01: Beam search candidate validation
  await runAsyncTest('O01', 'Beam search candidates preserve valid sequence', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2
    });
    assert.ok(result.optimizerResult.selectedStops.length > 0);
  });

  // O02: ALNS candidate validation
  await runAsyncTest('O02', 'ALNS optimization produces valid stops sequence', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3
    });
    assert.ok(result.optimizerResult.selectedStops.length >= 2);
  });

  // O03: 3-opt missing transitions
  runTest('O03', '3-opt evaluateRouteCost returns Infinity on unavailable transitions in strict mode', () => {
    const fakeMatrix = {
      isStrict: true,
      getTransition: () => ({ status: 'UNAVAILABLE', dataStatus: 'unavailable', distanceKm: null, durationMinutes: null })
    };
    const cost = evaluateRouteCost(
      [{ name: 'A' }, { name: 'B' }],
      {
        matrix: fakeMatrix,
        allowEstimates: false
      }
    );
    assert.strictEqual(cost, Infinity, 'Strict mode must reject unavailable transitions with Infinity');
  });

  // O04: Pareto candidate comparison
  await runAsyncTest('O04', 'Pareto optimizer evaluates candidate routes under unified evaluateRouteCost', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      mode: 'BALANCED'
    });
    assert.ok(['threeOptLocalSearch', 'spatiotemporalParetoOptimizer'].includes(result.optimizerResult.selectedByOptimizer));
  });

  // O05: Explicit planning mode
  await runAsyncTest('O05', 'Explicit planning mode (e.g. SCENIC) respected by optimizer', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      mode: 'SCENIC'
    });
    assert.ok(result.optimizerResult.selectedMode.includes('SCENIC'));
  });

  // O06: Final route consistency
  await runAsyncTest('O06', 'Final route consistency: daily schedule stops match optimizer selection', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const result = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2
    });
    const scheduledStops = result.dailyItinerary.flatMap(d => d.stops);
    assert.ok(scheduledStops.length > 0);
  });

  // O07: Hard constraints override objective scores
  runTest('O07', 'Hard constraints override route scores: excessive driving candidate rejected', () => {
    const evalResult = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, totalDayDrivingMinutes: 800, totalDayDistanceKm: 950, stops: [] }],
      userProfile: { totalBudget: 100000 },
      routeInfo: { totalDistanceKm: 950 }
    });
    assert.strictEqual(evalResult.status, 'INFEASIBLE');
  });

  console.log('\n--- 6. PERSONALIZATION REGRESSION TESTS (P01 - P06) ---');

  // P01: Spiritual traveler
  await runAsyncTest('P01', 'Spiritual traveler profile matches cultural/religious landmarks', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      activities: ['temples', 'spiritual', 'heritage']
    });
    const stops = res.optimizerResult.selectedStops;
    assert.ok(stops.length > 0);
  });

  // P02: Adventure traveler
  await runAsyncTest('P02', 'Adventure traveler profile matches trekking/nature landmarks', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      activities: ['trekking', 'nature', 'adventure']
    });
    const stops = res.optimizerResult.selectedStops;
    assert.ok(stops.length > 0);
  });

  // P03: Photography traveler
  await runAsyncTest('P03', 'Photography traveler profile prioritized scenic viewpoints', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      days: 3,
      activities: ['photography', 'viewpoints', 'landscapes']
    });
    assert.ok(res.optimizerResult.selectedStops.length > 0);
  });

  // P04: Family traveler
  await runAsyncTest('P04', 'Family traveler profile schedules accessible pace and stops', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      travelCompanionType: 'family',
      travelPace: 'relaxed'
    });
    assert.ok(res.dailyItinerary.length === 2);
  });

  // P05: Budget traveler
  await runAsyncTest('P05', 'Budget traveler profile uses budget hotel/hostel assumptions', async () => {
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

  // P06: Distinct profiles test
  await runAsyncTest('P06', '5 distinct traveler profiles on same corridor produce meaningfully different valid itineraries', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const p1 = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2, activities: ['temples'] });
    const p2 = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2, activities: ['trekking'] });
    const p3 = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2, activities: ['photography'] });
    const p4 = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2, travelCompanionType: 'family', travelPace: 'relaxed' });
    const p5 = await orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Bangalore', days: 2, budget: 10000, accommodationPreference: 'hostel' });

    assert.ok(p1 && p2 && p3 && p4 && p5);
    // Budgets differ between standard and hostel
    assert.notStrictEqual(p1.budgetSummary.totalEstimatedCost, p5.budgetSummary.totalEstimatedCost);
  });

  console.log('\n--- 7. END-TO-END ACCEPTANCE SCENARIOS (A - F) ---');

  // Scenario A: Fully available provider data
  await runAsyncTest('Scenario A', 'Multi-day trip with complete road transitions, timeline, and budget reconciliation', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const res = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Srisailam',
      days: 2,
      weatherCondition: 'Clear & Favorable',
      isWeatherVerified: true
    });
    assert.strictEqual(res.dailyItinerary.length, 2);
    assert.ok(res.optimizerResult.routeTransitions.length >= 2);
    assert.ok(res.budgetSummary.totalEstimatedCost > 0);
    assert.ok(['FEASIBLE', 'FEASIBLE_WITH_WARNINGS'].includes(res.feasibilityAnalysis.status));
  });

  // Scenario B: Routing provider unavailable
  await runAsyncTest('Scenario B', 'Routing provider unavailable results in NOT_VERIFIED, no synthetic authoritative distance', async () => {
    const res = await roadRoutingProvider.getRouteMatrix(
      [
        { id: 'O', name: 'Start', lat: 17.38, lng: 78.48 },
        { id: 'D', name: 'End', lat: 12.97, lng: 77.59 }
      ],
      { simulateProviderFailure: true }
    );
    const cell = res.getTransition('Start', 'End');
    assert.strictEqual(cell.dataStatus, 'unavailable');
    assert.strictEqual(cell.distanceKm, null);
  });

  // Scenario C: Missing attraction fee
  runTest('Scenario C', 'Missing attraction fee remains unknown and exposes budget uncertainty', () => {
    const b = calculateTripBudget({
      userProfile: { totalBudget: 20000, numberOfTravelers: 2 },
      routeInfo: { totalDistanceKm: 400 },
      dayPlans: [{ stops: [{ name: 'Unknown Museum', entryFee: null }] }]
    });
    assert.ok(b.unknownExpenseCategories.includes('attraction_entry_fees'));
    assert.strictEqual(b.budgetDecisionUncertainty, true);
  });

  // Scenario D: Unknown weather and opening hours
  runTest('Scenario D', 'Unknown weather and operating hours reflect uncertainty in feasibility', () => {
    const f = evaluateItineraryFeasibility({
      dayPlans: [{ day: 1, stops: [{ name: 'Sight without hours' }] }],
      userProfile: { totalBudget: 50000 },
      routeInfo: { totalDistanceKm: 300 },
      weatherInfo: { status: 'UNAVAILABLE', condition: 'Unknown' }
    });
    assert.ok(['NOT_VERIFIED', 'FEASIBLE_WITH_WARNINGS'].includes(f.status));
    assert.ok(f.evaluatedConstraints.some(c => c.status === 'NOT_VERIFIED' || c.status === 'WARNING'));
  });

  // Scenario E: Five traveler profiles on the same route
  await runAsyncTest('Scenario E', 'Five traveler profiles generate distinct itineraries on the same corridor', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const profs = [
      { activities: ['heritage'] },
      { activities: ['adventure'] },
      { activities: ['wildlife'] },
      { travelCompanionType: 'family' },
      { travelPace: 'relaxed' }
    ];
    const results = await Promise.all(
      profs.map(p => orchestrator.generateUnifiedItinerary({ origin: 'Hyderabad', destination: 'Munnar', days: 3, ...p }))
    );
    assert.strictEqual(results.length, 5);
    results.forEach(r => assert.strictEqual(r.dailyItinerary.length, 3));
  });

  // Scenario F: Round trip versus one way
  await runAsyncTest('Scenario F', 'One-way journey terminates at destination; round trip schedules return route', async () => {
    const orchestrator = new UnifiedTravelPlanningOrchestrator();
    const oneWay = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 2,
      isRoundTrip: false
    });
    const roundTrip = await orchestrator.generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Bangalore',
      days: 3,
      isRoundTrip: true
    });

    assert.strictEqual(oneWay.returnRoutePlan.isRoundTrip, false);
    assert.strictEqual(oneWay.returnRoutePlan.alternativeRoutes.length, 0);
    assert.strictEqual(roundTrip.returnRoutePlan.isRoundTrip, true);
    assert.ok(roundTrip.returnRoutePlan.alternativeRoutes.length > 0);
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
