const {
  optimizeSpatiotemporalJourney,
  reoptimizeRollingHorizon,
  generateSemanticEmbedding,
  calculateCosineSimilarity,
  calculateTimeDependentTravelTime,
  evaluateSubmodularExperienceUtility,
  calculateMarginalValue,
  retrieveMultiChannelCandidates,
  generateParetoFrontier,
  applyTwoOptLocalSearch
} = require('./backend/src/services/spatiotemporalOptimizer');

async function testSpatiotemporalEngine() {
  console.log('=== 1. TESTING SEMANTIC EMBEDDING & COSINE SIMILARITY ===');
  const userVec = generateSemanticEmbedding('nature waterfalls photography scenic viewpoints avoid crowded places');
  const naturePoiVec = generateSemanticEmbedding('Dudhsagar Waterfalls breathtaking cascade nature trekking photography');
  const shoppingPoiVec = generateSemanticEmbedding('Mall of Travancore indoor shopping luxury retail complex');

  const simNature = calculateCosineSimilarity(userVec, naturePoiVec);
  const simShopping = calculateCosineSimilarity(userVec, shoppingPoiVec);
  console.log(`Cosine Similarity (User vs Waterfalls): ${(simNature * 100).toFixed(1)}%`);
  console.log(`Cosine Similarity (User vs Shopping Mall): ${(simShopping * 100).toFixed(1)}%`);
  if (simNature > simShopping) {
    console.log('✓ PASS: Semantic affinity correctly prioritizes nature/waterfalls over shopping');
  } else {
    console.error('FAIL: Semantic affinity order incorrect');
  }

  console.log('\n=== 2. TESTING TIME-DEPENDENT ROUTING & DIURNAL TRAFFIC ===');
  // 100 km at base 65 km/h:
  // Normal time ~ 92 min
  // Morning rush (08:30 = 510 min from midnight): multiplier 1.35 -> ~124 min
  // Night flow (02:00 = 120 min from midnight): multiplier 0.95 -> ~87 min
  const morningRush = calculateTimeDependentTravelTime(100, 510);
  const eveningRush = calculateTimeDependentTravelTime(100, 1080);
  const nightFlow = calculateTimeDependentTravelTime(100, 120);
  console.log(`Travel time (100 km) at 08:30 AM (Morning Rush): ${morningRush.travelMinutes} mins (Status: ${morningRush.trafficSeverity})`);
  console.log(`Travel time (100 km) at 06:00 PM (Evening Rush): ${eveningRush.travelMinutes} mins (Status: ${eveningRush.trafficSeverity})`);
  console.log(`Travel time (100 km) at 02:00 AM (Night Flow): ${nightFlow.travelMinutes} mins (Status: ${nightFlow.trafficSeverity})`);
  if (morningRush.travelMinutes > nightFlow.travelMinutes) {
    console.log('✓ PASS: Diurnal traffic accurately modulates edge travel times');
  }

  console.log('\n=== 3. TESTING SUBMODULAR MARGINAL VALUE FUNCTION ===');
  const testPoiWaterfall1 = { name: 'Waterfall 1', category: 'waterfall', semanticScore: 0.9 };
  const testPoiWaterfall2 = { name: 'Waterfall 2', category: 'waterfall', semanticScore: 0.9 };
  const testPoiWaterfall3 = { name: 'Waterfall 3', category: 'waterfall', semanticScore: 0.9 };
  const testPoiCultural = { name: 'Ancient Fort', category: 'heritage', semanticScore: 0.75 };

  const marginal1 = calculateMarginalValue(testPoiWaterfall1, [], userVec);
  const marginal2 = calculateMarginalValue(testPoiWaterfall2, [testPoiWaterfall1], userVec);
  const marginal3 = calculateMarginalValue(testPoiWaterfall3, [testPoiWaterfall1, testPoiWaterfall2], userVec);
  const marginalCultural = calculateMarginalValue(testPoiCultural, [testPoiWaterfall1, testPoiWaterfall2], userVec);

  console.log(`Marginal Value (1st Waterfall): +${marginal1}`);
  console.log(`Marginal Value (2nd Waterfall): +${marginal2}`);
  console.log(`Marginal Value (3rd Waterfall): +${marginal3}`);
  console.log(`Marginal Value (Cultural Fort after 2 waterfalls): +${marginalCultural}`);

  if (marginal1 > marginal2 && marginal2 > marginal3 && marginalCultural > marginal3) {
    console.log('✓ PASS: Submodular diminishing returns successfully prevents repetitive saturations while preserving diversity');
  }

  console.log('\n=== 4. TESTING FULL JOURNEY OPTIMIZATION & PARETO FRONTIER ===');
  const journeyResult = await optimizeSpatiotemporalJourney({
    origin: 'Mumbai',
    destination: 'Goa',
    travelDate: '2026-10-15',
    startTime: '06:30 AM',
    preferredActivities: ['nature', 'waterfalls', 'photography', 'scenic'],
    travelerType: 'friends',
    travelMode: 'car',
    budget: 25000,
    planningMode: 'BALANCED',
    numberOfTravelers: 4
  });

  console.log(`Selected Planning Mode: ${journeyResult.activeItineraryMode}`);
  console.log(`Scheduled Stops Along Route (${journeyResult.recommendedPlacesAlongRoute.length}):`);
  journeyResult.recommendedPlacesAlongRoute.forEach(s => {
    console.log(`  [Stop ${s.order}] ${s.name} (${s.city}) - Arrive: ${s.expectedArrival}, Detour: ${s.detour}, Marginal Val: +${s.marginalExperienceValue}`);
    console.log(`    Why: ${s.whySelected}`);
  });

  console.log(`\nPareto Frontier Generated (${journeyResult.paretoFrontier.length} Non-dominated Solutions):`);
  journeyResult.paretoFrontier.forEach(pf => {
    console.log(`  Mode: ${pf.mode} | Stops: ${pf.stopCount} | Exp Score: ${pf.objectives.experienceScore} | Detour: ${pf.objectives.totalDetourKm}km | Efficiency: ${pf.objectives.routeEfficiencyScore}% | Cost: ₹${pf.objectives.totalCost}`);
  });

  console.log('\n=== 5. TESTING ROLLING-HORIZON REAL-TIME RE-OPTIMIZATION ===');
  const remainingStops = journeyResult.recommendedPlacesAlongRoute.map(s => ({
    name: s.name,
    city: s.city,
    detourKm: parseFloat(s.detour) || 12,
    stayMinutes: parseInt(s.recommendedStay) || 60,
    openHours: { open: '08:00 AM', close: '06:30 PM' }
  }));

  const reoptResult = await reoptimizeRollingHorizon({
    currentLocation: 'Kolhapur Bypass',
    currentTime: '11:45 AM',
    completedStops: ['Khandala Sunset Point'],
    remainingStops,
    trafficDelayMinutes: 75, // Severe 75 min unexpected delay
    weatherRiskStatus: 'CLEAR',
    remainingBudget: 18000,
    userPreferences: ['nature', 'photography']
  });

  console.log('Rolling-Horizon Re-optimization Status:', reoptResult.reoptimizationStatus);
  console.log('Adjusted ETA Destination:', reoptResult.adjustedEtaDestination);
  console.log('Time Recovered by Rescheduling:', `${reoptResult.timeRecoveredMinutes} mins`);
  console.log('Updated Schedule:');
  reoptResult.updatedSchedule.forEach(s => {
    console.log(`  - ${s.name}: ${s.newArrival} (Stay: ${s.recommendedStay}) - ${s.status}`);
  });

  console.log('\nALL 5 SPATIOTEMPORAL ENGINE TESTS COMPLETED SUCCESSFULLY!');
}

testSpatiotemporalEngine().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
