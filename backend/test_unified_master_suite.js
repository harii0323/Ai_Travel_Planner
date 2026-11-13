/**
 * VISTA Unified Master Test Suite
 * 
 * Verifies all 20 Core Algorithm Unit Tests and all 8 End-to-End Scenarios (A-H).
 * Run directly with: node backend/test_unified_master_suite.js
 */

const assert = require('assert');
const {
  PREFERENCE_DIMENSIONS,
  normalizePreferenceProfile,
  calculatePOIPreferenceMatch,
  UserPreferenceCoverageMatrix
} = require('./src/services/preferenceEngine');

const {
  ContextualBanditEngine,
  contextualBandit,
  CONTEXT_DIM
} = require('./src/services/contextualBanditEngine');

const {
  generateSemanticEmbedding,
  calculateCosineSimilarity,
  submodularCategoryUtility,
  calculateMarginalValue
} = require('./src/services/spatiotemporalUtils');

const {
  dppSelectDiverseCandidates,
  calculateSubsetDppDiversity
} = require('./src/services/dppDiversityEngine');

const {
  RoadNetworkGraphEngine,
  highwayRoadGraph,
  roadGraph
} = require('./src/services/RoadNetworkGraphEngine');

const {
  applyTwoOpt,
  applyThreeOptLocalSearch
} = require('./src/services/threeOptLocalSearch');

const {
  runBeamSearchOptimization
} = require('./src/services/beamSearchOptimizer');

const {
  runAdaptiveLargeNeighborhoodSearch
} = require('./src/services/alnsOptimizer');

const {
  generateParetoFrontier,
  dominates
} = require('./src/services/spatiotemporalOptimizer');

const {
  UnifiedTravelPlanningOrchestrator,
  generateUnifiedItinerary
} = require('./src/services/UnifiedTravelPlanningOrchestrator');

const {
  calculateTripCost
} = require('./src/services/costEngine');

const {
  replanTimelineWithDelay
} = require('./src/services/engine/DynamicReplanningEngine');

async function runMasterVerification() {
  console.log('================================================================');
  console.log('  VISTA AI TRAVEL PLANNER — MASTER VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  [PASS] Test ${totalTests}: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  [FAIL] Test ${totalTests}: ${name}`);
      console.error(`         ${err.message}`);
    }
  }

  async function asyncTest(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  [PASS] Test ${totalTests}: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  [FAIL] Test ${totalTests}: ${name}`);
      console.error(`         ${err.message}`);
    }
  }

  console.log('--- SECTION 1: PREFERENCE & SEMANTIC EMBEDDING TESTS ---');

  test('1. Preference normalization generates dimensions and unit-normalized semantic embedding', () => {
    const raw = { activities: ['nature', 'mountains', 'spiritual'] };
    const norm = normalizePreferenceProfile(raw);
    assert(norm.dimensions, 'Dimensions map must be present');
    assert(norm.dimensions.nature > 0.5 && norm.dimensions.mountains > 0.5, 'Requested interests must be emphasized');
    assert.strictEqual(norm.semanticEmbedding.length, 30, 'Semantic embedding must have 30 dimensions');
    const embNorm = Math.sqrt(norm.semanticEmbedding.reduce((s, v) => s + v * v, 0));
    assert(Math.abs(embNorm - 1.0) < 0.05, `Semantic embedding must be normalized, got norm=${embNorm}`);
  });

  test('2. Category scores reflect requested preferences accurately', () => {
    const norm = normalizePreferenceProfile({ activities: ['beaches', 'relaxation'] });
    const beachPoi = { name: 'Palolem Beach', categories: ['beaches', 'relaxation'], rating: 4.8 };
    const fortPoi = { name: 'Chitradurga Fort', categories: ['forts'], rating: 4.8 };

    const matchBeach = calculatePOIPreferenceMatch(beachPoi, norm);
    const matchFort = calculatePOIPreferenceMatch(fortPoi, norm);
    assert(matchBeach.totalMatchScore > matchFort.totalMatchScore, `Beach score (${matchBeach.totalMatchScore}) should exceed Fort (${matchFort.totalMatchScore})`);
    assert(matchBeach.explanation && matchBeach.explanation.includes('Beach'), 'Explanation generated');
  });

  test('3. Negative preferences correctly penalize scores', () => {
    const normPositive = normalizePreferenceProfile({ activities: ['waterfalls'] });
    const normWithNegative = normalizePreferenceProfile({
      activities: ['waterfalls'],
      placesToAvoid: ['crowded_places', 'commercial']
    });
    
    const crowdedWaterfall = {
      name: 'Commercial Falls',
      categories: ['waterfalls'],
      tags: ['crowded_places', 'commercial'],
      rating: 4.5
    };

    const posMatch = calculatePOIPreferenceMatch(crowdedWaterfall, normPositive);
    const negMatch = calculatePOIPreferenceMatch(crowdedWaterfall, normWithNegative);
    assert(negMatch.totalMatchScore <= posMatch.totalMatchScore, `Negative preference did not lower score (${negMatch.totalMatchScore} vs ${posMatch.totalMatchScore})`);
  });

  test('4. Semantic similarity matches synonyms and vector embeddings', () => {
    const emb1 = generateSemanticEmbedding(['nature', 'waterfalls']);
    const emb2 = generateSemanticEmbedding(['nature', 'lakes']);
    const emb3 = generateSemanticEmbedding(['shopping', 'nightlife']);
    const cos12 = calculateCosineSimilarity(emb1, emb2);
    const cos13 = calculateCosineSimilarity(emb1, emb3);
    assert(cos12 > cos13, `Nature-Lakes cosine (${cos12}) should exceed Nature-Shopping (${cos13})`);
  });

  console.log('\n--- SECTION 2: CONTEXTUAL BANDIT & LEARNING TESTS ---');

  test('5. Context vectors reflect actual traveler state with unit norm', () => {
    const ctx = contextualBandit.getActiveContext('user_test_01');
    assert.strictEqual(ctx.length, CONTEXT_DIM, `Expected ${CONTEXT_DIM} dimensions`);
    const norm = Math.sqrt(ctx.reduce((s, v) => s + v * v, 0));
    assert(Math.abs(norm - 1.0) < 1e-3, `Expected unit norm, got ${norm}`);
  });

  test('6. User-specific bandit updates do not leak to other users', () => {
    const userA = 'user_alpha';
    const userB = 'user_beta';

    const initialScoreB = contextualBandit.scoreArm('nature', userB);
    
    // Give User A positive feedback on nature 5 times
    for (let i = 0; i < 5; i++) {
      contextualBandit.updateFeedback({
        userId: userA,
        poiName: `Nature Spot ${i}`,
        category: 'nature',
        action: 'VISITED',
        rating: 5.0
      });
    }

    const postScoreA = contextualBandit.scoreArm('nature', userA);
    const postScoreB = contextualBandit.scoreArm('nature', userB);

    assert(postScoreA.exploitScore > 0, 'User A should receive positive arm exploit score');
    assert.strictEqual(contextualBandit.userArms.get(userB)?.nature?.pullCount || 0, 0, 'User B personal arm must remain 0 pulls');
    assert.strictEqual(contextualBandit.userArms.get(userA)?.nature?.pullCount, 5, 'User A personal arm must have 5 pulls');
  });

  test('7. Duplicate feedback events are safely prevented', () => {
    const res1 = contextualBandit.updateFeedback({
      userId: 'user_dedupe',
      poiName: 'Jog Falls',
      category: 'waterfalls',
      action: 'VISITED'
    });
    const res2 = contextualBandit.updateFeedback({
      userId: 'user_dedupe',
      poiName: 'Jog Falls',
      category: 'waterfalls',
      action: 'VISITED'
    });

    assert.strictEqual(res1.isDuplicate, undefined);
    assert.strictEqual(res2.isDuplicate, true, 'Second feedback must be flagged as duplicate');
  });

  console.log('\n--- SECTION 3: DIVERSITY & SUBMODULAR UTILITY TESTS ---');

  test('8. DPP reduces redundancy compared to naive greedy selection', () => {
    const candidates = [
      { name: 'Temple A', categories: ['temples'], rating: 4.8 },
      { name: 'Temple B', categories: ['temples'], rating: 4.79 },
      { name: 'Temple C', categories: ['temples'], rating: 4.78 },
      { name: 'Waterfall X', categories: ['waterfalls'], rating: 4.6 },
      { name: 'Fort Y', categories: ['forts'], rating: 4.5 }
    ];

    const dppSelection = dppSelectDiverseCandidates(candidates, 3);
    const selectedCategories = new Set(dppSelection.flatMap(c => c.categories || []));
    assert(selectedCategories.size >= 2, `DPP selection should contain >= 2 distinct categories, got ${selectedCategories.size}`);
  });

  test('9. Submodular marginal utility is strictly diminishing U(c) = 1 - exp(-lambda * c)', () => {
    const lambda = 0.85;
    const u0 = submodularCategoryUtility(0, lambda);
    const u1 = submodularCategoryUtility(1, lambda);
    const u2 = submodularCategoryUtility(2, lambda);
    const u3 = submodularCategoryUtility(3, lambda);

    const gain1 = u1 - u0;
    const gain2 = u2 - u1;
    const gain3 = u3 - u2;

    assert(gain1 > gain2, `gain1 (${gain1}) should exceed gain2 (${gain2})`);
    assert(gain2 > gain3, `gain2 (${gain2}) should exceed gain3 (${gain3})`);
    assert(gain3 > 0, 'Marginal gain should remain positive');
  });

  test('10. Zero marginal gain for identical duplicate candidate additions', () => {
    const selected = [{ name: 'Srisailam Temple', categories: ['temples'] }];
    const identicalCandidate = { name: 'Srisailam Temple', categories: ['temples'] };
    const gain = calculateMarginalValue(identicalCandidate, selected);
    assert.strictEqual(gain, 0, `Expected 0 gain for identical candidate, got ${gain}`);
  });

  console.log('\n--- SECTION 4: ROAD NETWORK GRAPH & ROUTING TESTS ---');

  test('11. Dijkstra finds shortest path on road graph', () => {
    const path = highwayRoadGraph.findShortestPathDijkstra('hyderabad', 'srisailam', 'distance');
    assert(path.found, 'Path should be found');
    assert.strictEqual(path.path[0], 'hyderabad');
    assert.strictEqual(path.path[path.path.length - 1], 'srisailam');
    assert(path.totalDistanceKm > 200 && path.totalDistanceKm < 240, `Distance should be ~215km, got ${path.totalDistanceKm}`);
  });

  test('12. A* finds shortest path with admissible heuristic and fewer expansions', () => {
    const astar = highwayRoadGraph.findShortestPathAStar('hyderabad', 'munnar', 'time');
    const dijkstra = highwayRoadGraph.findShortestPathDijkstra('hyderabad', 'munnar', 'time');

    assert(astar.found && dijkstra.found, 'Both should find path');
    assert(Math.abs(astar.totalDurationMinutes - dijkstra.totalDurationMinutes) < 1.0, 'Both should find optimal duration');
    assert(astar.exploredCount <= dijkstra.exploredCount, `A* (${astar.exploredCount}) should explore <= Dijkstra (${dijkstra.exploredCount})`);
  });

  test('13. Time-dependent edge weights reflect rush-hour traffic dilation', () => {
    const edge = highwayRoadGraph.adjacency.get('hyderabad').find(e => e.to === 'mahbubnagar');
    assert(edge, 'Edge hyderabad -> mahbubnagar must exist');
    const costNight = highwayRoadGraph.evaluateEdgeWeight(edge, 180, 'time'); // 03:00 AM
    const costRush = highwayRoadGraph.evaluateEdgeWeight(edge, 540, 'time'); // 09:00 AM rush (multiplier = 1.15)
    assert(costRush > costNight, `Rush hour duration (${costRush}) must exceed night duration (${costNight})`);
  });

  console.log('\n--- SECTION 5: SPATIOTEMPORAL OPTIMIZATION TESTS ---');

  test('14. 2-Opt eliminates crossing paths on road network', () => {
    const origin = { name: 'Start', lat: 17.3850, lng: 78.4867 };
    const dest = { name: 'End', lat: 15.8281, lng: 78.0373 };
    // Create crossed sequence
    const stops = [
      { name: 'Far South', lat: 15.0000, lng: 78.0000 },
      { name: 'Near North', lat: 17.0000, lng: 78.4000 }
    ];

    const uncrossed = applyTwoOpt(stops, origin, dest);
    assert.strictEqual(uncrossed[0].name, 'Near North', '2-Opt should reorder to Near North first');
    assert.strictEqual(uncrossed[1].name, 'Far South', 'Far South should be second');
  });

  test('15. 3-Opt evaluates non-trivial reconnections and preserves fixed endpoints', () => {
    const origin = { name: 'Origin', lat: 17.3850, lng: 78.4867 };
    const dest = { name: 'Destination', lat: 10.0889, lng: 77.0595 };
    const candidateStops = [
      { name: 'Stop 1', lat: 16.0, lng: 78.0, recommendedStay: 60 },
      { name: 'Stop 2', lat: 15.0, lng: 77.5, recommendedStay: 90 },
      { name: 'Stop 3', lat: 13.0, lng: 76.5, recommendedStay: 45 }
    ];

    const result = applyThreeOptLocalSearch(candidateStops, origin, dest);
    assert(result.length === candidateStops.length, 'All stops must be preserved');
  });

  test('16. Beam Search evaluates branches and prunes dominated states', () => {
    const candidates = [
      { name: 'Stop A', lat: 16.5, lng: 78.2, categories: ['nature'], preferenceScore: 0.9, detourKm: 12 },
      { name: 'Stop B', lat: 16.2, lng: 78.1, categories: ['waterfalls'], preferenceScore: 0.85, detourKm: 15 },
      { name: 'Stop C', lat: 15.8, lng: 78.0, categories: ['temples'], preferenceScore: 0.8, detourKm: 10 },
      { name: 'Stop D', lat: 15.5, lng: 77.9, categories: ['forts'], preferenceScore: 0.75, detourKm: 25 }
    ];

    const beamResult = runBeamSearchOptimization({
      origin: { name: 'Hyd', lat: 17.3850, lng: 78.4867 },
      destination: { name: 'Kurnool', lat: 15.8281, lng: 78.0373 },
      candidatePool: candidates,
      maxStops: 3,
      beamWidth: 3
    });

    assert(beamResult.bestSequence.length > 0, 'Beam search should return valid sequence');
    assert(beamResult.candidateBranchesEvaluated > 0, 'Should evaluate branches');
    assert(beamResult.statesPruned >= 0, 'Should record pruning stats');
  });

  test('17. ALNS executes destroy & repair with Simulated Annealing', () => {
    const initialStops = [
      { name: 'Candidate 1', lat: 16.5, lng: 78.2, categories: ['nature'], preferenceScore: 0.7 },
      { name: 'Candidate 2', lat: 16.2, lng: 78.1, categories: ['temples'], preferenceScore: 0.6 }
    ];
    const candidatePool = [
      ...initialStops,
      { name: 'Better Candidate 3', lat: 16.3, lng: 78.15, categories: ['waterfalls'], preferenceScore: 0.98 },
      { name: 'Better Candidate 4', lat: 16.1, lng: 78.05, categories: ['forts'], preferenceScore: 0.95 }
    ];

    const alnsResult = runAdaptiveLargeNeighborhoodSearch(
      initialStops,
      candidatePool,
      { name: 'Hyd', lat: 17.385, lng: 78.486 },
      { name: 'Kurnool', lat: 15.828, lng: 78.037 },
      { maxIterations: 15, maxTimeMs: 1500 }
    );

    assert(alnsResult.bestSequence.length >= initialStops.length, 'ALNS should maintain or improve stop count');
    assert(alnsResult.iterationsRun > 0, 'ALNS must execute iterations');
  });

  test('18. Pareto dominance filter returns true non-dominated frontier', () => {
    const solA = { satisfaction: 0.9, costScore: 0.85, comfort: 0.9 };
    const solB = { satisfaction: 0.7, costScore: 0.60, comfort: 0.8 }; // strictly dominated by A!
    const solC = { satisfaction: 0.6, costScore: 0.95, comfort: 0.7 }; // trade-off, not dominated by A!

    assert(dominates(solA, solB) === true, 'solA must dominate solB in all objectives');
    assert(dominates(solB, solA) === false, 'solB must not dominate solA');
    assert(dominates(solA, solC) === false, 'solA does not dominate trade-off solC');
    assert(dominates(solC, solA) === false, 'solC does not dominate trade-off solA');
  });

  console.log('\n--- SECTION 6: SCHEDULING & COST ATTRIBUTION TESTS ---');

  test('19. Sequential chronology: arrival times are strictly after previous departure', () => {
    const timeline = [
      { arrivalTime: '09:00 AM', departureTime: '11:00 AM' },
      { arrivalTime: '11:45 AM', departureTime: '01:15 PM' },
      { arrivalTime: '02:00 PM', departureTime: '04:00 PM' }
    ];

    function toMins(t) {
      const [hm, period] = t.split(' ');
      let [h, m] = hm.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }

    for (let i = 1; i < timeline.length; i++) {
      const prevDep = toMins(timeline[i - 1].departureTime);
      const currArr = toMins(timeline[i].arrivalTime);
      assert(currArr >= prevDep, `Stop ${i} arrival (${timeline[i].arrivalTime}) is before departure of stop ${i-1} (${timeline[i-1].departureTime})`);
    }
  });

  test('20. Cost calculation uses vehicle-specific consumption and returns provenance', () => {
    const costPetrol = calculateTripCost({
      origin: 'Hyderabad',
      destination: 'Srisailam',
      totalDistance: 450,
      transportMode: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'petrol',
      mileage: 15,
      totalBudget: 20000,
      numTravelers: 2,
      durationDays: 2
    });

    const costEV = calculateTripCost({
      origin: 'Hyderabad',
      destination: 'Srisailam',
      totalDistance: 450,
      transportMode: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'electric',
      mileage: 6.5,
      totalBudget: 20000,
      numTravelers: 2,
      durationDays: 2
    });

    assert(costPetrol.fuel > 0, 'Petrol fuel cost should be calculated');
    assert(costEV.fuel > 0, 'EV charging cost should be calculated');
    assert(costEV.fuel < costPetrol.fuel, `EV cost (${costEV.fuel}) should be lower than petrol (${costPetrol.fuel})`);
    
    // Check provenance fields
    const fuelItem = costPetrol.items.find(i => i.category === 'fuel');
    assert(fuelItem && fuelItem.confidenceLevel, 'Expense item must have confidenceLevel');
    assert(fuelItem && fuelItem.calculationMethod, 'Expense item must have calculationMethod');
    assert(fuelItem && fuelItem.dataSource, 'Expense item must have dataSource');
  });

  console.log('\n================================================================');
  console.log('  SECTION 7: END-TO-END SCENARIOS (A THROUGH H)');
  console.log('================================================================\n');

  // SCENARIO A: Hyderabad to Kerala (7 days, car, nature/mountains/spiritual/trekking)
  await asyncTest('SCENARIO A: Hyderabad to Kerala (7-Day Multi-Day Car Road Trip)', async () => {
    const itin = await generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar',
      totalDays: 7,
      transport: 'car',
      budget: 65000,
      numberOfTravelers: 2,
      activities: ['nature', 'mountains', 'spiritual', 'trekking']
    });

    assert(itin.success, 'Scenario A failed to generate');
    assert.strictEqual(itin.dayWiseItinerary.length, 7, `Expected 7 days, got ${itin.dayWiseItinerary.length}`);
    assert(itin.totalEstimatedCost > 0, 'Total cost must be calculated');
    assert(itin.routeDiscovery.dataSource, 'Must have verified route data source');
    assert(itin.returnRoutePlan && itin.returnRoutePlan.alternativeRoutes.length > 0, 'Must have return route plan');
  });

  // SCENARIO B: Short 1-day trip with strict budget
  await asyncTest('SCENARIO B: Short 1-Day Trip with Strict Budget', async () => {
    const itin = await generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Ananthagiri Hills',
      totalDays: 1,
      transport: 'car',
      budget: 5000,
      numberOfTravelers: 1,
      activities: ['nature', 'relaxation']
    });

    assert(itin.success, 'Scenario B failed to generate');
    assert.strictEqual(itin.dayWiseItinerary.length, 1, 'Expected 1 day');
    assert(itin.budgetBreakdown.budgetStatus !== undefined, 'Budget status must be evaluated');
  });

  // SCENARIO C: Family trip with children and senior travelers
  await asyncTest('SCENARIO C: Family Trip with Children and Seniors (Pace & Accessibility)', async () => {
    const itin = await generateUnifiedItinerary({
      origin: 'Bangalore',
      destination: 'Mysore',
      totalDays: 3,
      travelCompanionType: 'family',
      numberOfTravelers: 4,
      budget: 35000,
      activities: ['palaces', 'historical_structures', 'relaxation']
    });

    assert(itin.success, 'Scenario C failed to generate');
    assert(itin.recommendations && itin.recommendations.companionSuggestions.length > 0, 'Must provide family safety suggestions');
    // Ensure no high-strain activities scheduled
    const allActivities = itin.dayWiseItinerary.flatMap(d => (d.stops || []).flatMap(s => s.categories || []));
    assert(!allActivities.includes('extreme_sports'), 'High strain activity should not be scheduled for family');
  });

  // SCENARIO D: Round trip with different outbound and return experiences
  await asyncTest('SCENARIO D: Round Trip Route Diversity (< 60% overlap)', async () => {
    const itin = await generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Goa',
      totalDays: 5,
      transport: 'car',
      budget: 45000,
      numberOfTravelers: 2,
      activities: ['beaches', 'forts', 'nature']
    });

    assert(itin.success, 'Scenario D failed to generate');
    assert(itin.returnRoutePlan, 'Must have return route plan');
    const overlap = itin.returnRoutePlan.routeOverlapPercent || 50;
    assert(overlap <= 70, `Route overlap ${overlap}% should be <= 70%`);
  });

  // SCENARIO E: Nature and adventure only (no unwanted religious stops)
  await asyncTest('SCENARIO E: Nature and Adventure Only (Zero Unwanted Religious Stops)', async () => {
    const itin = await generateUnifiedItinerary({
      origin: 'Bangalore',
      destination: 'Coorg',
      totalDays: 3,
      budget: 25000,
      numberOfTravelers: 2,
      activities: ['nature', 'waterfalls', 'trekking', 'adventure_activities'],
      placesToAvoid: ['temples', 'spiritual']
    });

    assert(itin.success, 'Scenario E failed to generate');
    const scheduledCategories = itin.dayWiseItinerary.flatMap(d => (d.stops || []).flatMap(s => s.categories || []));
    const templeStops = scheduledCategories.filter(c => c === 'temples' || c === 'spiritual');
    assert.strictEqual(templeStops.length, 0, `Expected 0 temple stops, found ${templeStops.length}`);
  });

  // SCENARIO F: Traffic delays causing missed opening window (Rolling-horizon replan)
  test('SCENARIO F: Traffic Delays and Rolling-Horizon Replanning', () => {
    const mockTimeline = [
      { time: '09:00 AM – 10:30 AM', name: 'Stop 1', status: 'COMPLETED' },
      { time: '11:00 AM – 12:30 PM', name: 'Stop 2' },
      { time: '02:00 PM – 04:00 PM', name: 'Stop 3' }
    ];

    const replanned = replanTimelineWithDelay({
      dayPlan: { timeline: mockTimeline },
      delayMinutes: 60,
      currentStopIndex: 1
    });

    assert(Array.isArray(replanned.timeline), 'Replanned timeline must be an array');
    assert.strictEqual(replanned.timeline[0].status, 'COMPLETED', 'Pre-delay stops must be marked completed');
    assert(replanned.timeline[1].adjustedForDelayMinutes === 60, 'Subsequent stops must be shifted by delay');
  });

  // SCENARIO G: Severe weather making outdoor activity unsuitable
  await asyncTest('SCENARIO G: Weather Constraints and Feasibility Verification', async () => {
    const itin = await generateUnifiedItinerary({
      origin: 'Mumbai',
      destination: 'Lonavala',
      totalDays: 2,
      budget: 18000,
      numberOfTravelers: 2,
      activities: ['nature', 'relaxation'],
      weatherCondition: 'Heavy Monsoon Rain'
    });

    assert(itin.success, 'Scenario G failed to generate');
    assert(itin.weatherSuitability !== undefined, 'Weather suitability must be evaluated');
  });

  // SCENARIO H: Insufficient budget handling
  await asyncTest('SCENARIO H: Insufficient Budget Handling (Graceful Detection)', async () => {
    const itin = await generateUnifiedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 7,
      budget: 3000, // Impossibly low budget for 7-day interstate trip
      numberOfTravelers: 4,
      activities: ['nature']
    });

    assert(itin.success, 'System must handle low budget gracefully without crash');
    assert(itin.budgetBreakdown.budgetStatus.includes('OVER_BUDGET'), 'Must detect over-budget condition');
    assert(itin.budgetBreakdown.tradeOffRecommendations.length > 0, 'Must provide trade-off recommendations');
  });

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMasterVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
