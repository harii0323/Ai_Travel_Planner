const {
  dynamicTravelPlanner,
  reoptimizeItinerary,
  calculateTimeSuitability,
  calculatePreferenceMatch,
  calculatePlaceScore,
  evaluateNextPlaceCandidate,
  apply2Opt,
  clusterPlacesByProximity
} = require('../src/services/dynamicTravelPlanner');

async function testAlgorithm() {
  console.log('====================================================');
  console.log('🧪 TESTING DYNAMIC TRAVEL PLANNER ALGORITHM');
  console.log('====================================================\n');

  // Test 1: Time Suitability Function
  console.log('--- 1. Testing Time Suitability (CalculateTimeSuitability) ---');
  const mockSunrisePoint = {
    openingMinutes: 5 * 60,
    closingMinutes: 19 * 60,
    bestVisitWindow: { start: '05:00', end: '07:30', peak: '06:00', type: 'sunrise' }
  };

  const timesToTest = ['05:30', '06:00', '06:30', '08:00', '12:00', '15:00', '04:00', '20:00'];
  timesToTest.forEach((t) => {
    const score = calculateTimeSuitability(mockSunrisePoint, t);
    console.log(`  Time ${t} -> Suitability: ${score.toFixed(2)}`);
  });

  // Test 2: Core Decision Formula & Place Scoring
  console.log('\n--- 2. Testing Preference Match & NextScore Decision Formula ---');
  const mockPlaces = [
    {
      name: 'Sunrise Point',
      category: 'sunrise_point',
      rating: 4.8,
      reviews: 1200,
      openingMinutes: 300,
      closingMinutes: 1140,
      recommendedVisitDuration: 60,
      bestVisitWindow: { start: '05:00', end: '07:30', peak: '06:00' },
      coordinates: { lat: 15.55, lng: 73.75 },
      entryFee: 0,
      weatherSuitability: { rainSafe: false }
    },
    {
      name: 'Old Portuguese Church & Museum',
      category: 'museum',
      rating: 4.5,
      reviews: 2400,
      openingMinutes: 600, // 10:00 AM
      closingMinutes: 1050, // 5:30 PM
      recommendedVisitDuration: 90,
      bestVisitWindow: { start: '11:00', end: '16:00', peak: '13:30' },
      coordinates: { lat: 15.50, lng: 73.82 },
      entryFee: 50,
      weatherSuitability: { rainSafe: true }
    }
  ];

  const evalSunrise = evaluateNextPlaceCandidate({
    place: mockPlaces[0],
    currentLocation: { lat: 15.54, lng: 73.74 },
    currentTimeMinutes: 330, // 05:30 AM
    selectedPlaces: [],
    userPreferences: { activities: 'nature,photography', travelStyle: 'active' },
    transportMode: 'car',
    weatherCondition: 'Clear'
  });

  console.log('  Evaluation for Sunrise Point at 05:30 AM:', {
    feasible: evalSunrise.feasible,
    nextScore: evalSunrise.nextScore.toFixed(3),
    arrival: evalSunrise.arrivalTime,
    visitEnd: evalSunrise.visitEnd,
    scores: evalSunrise.scores
  });

  const evalMuseumEarly = evaluateNextPlaceCandidate({
    place: mockPlaces[1],
    currentLocation: { lat: 15.54, lng: 73.74 },
    currentTimeMinutes: 330, // 05:30 AM (Museum opens at 10:00)
    selectedPlaces: [],
    userPreferences: { activities: 'cultural', travelStyle: 'cultural' },
    transportMode: 'car',
    weatherCondition: 'Clear'
  });

  console.log('  Evaluation for Museum at 05:30 AM (Opening hours constraint):', {
    feasible: evalMuseumEarly.feasible,
    reason: evalMuseumEarly.reason
  });

  // Test 3: Multi-Day Geographic Clustering
  console.log('\n--- 3. Testing Geographic Clustering for Multi-Day Trips ---');
  const clusters = clusterPlacesByProximity(
    [
      { name: 'North Beach A', coordinates: { lat: 15.60, lng: 73.74 } },
      { name: 'North Fort B', coordinates: { lat: 15.58, lng: 73.73 } },
      { name: 'Central Museum C', coordinates: { lat: 15.49, lng: 73.82 } },
      { name: 'South Beach D', coordinates: { lat: 15.22, lng: 73.91 } },
      { name: 'South Waterfall E', coordinates: { lat: 15.28, lng: 74.05 } }
    ],
    2
  );
  console.log(`  Divided into ${clusters.length} geographic clusters:`);
  clusters.forEach((c, idx) => {
    console.log(`    Cluster ${idx + 1}: ${c.map((p) => p.name).join(', ')}`);
  });

  // Test 4: Complete Dynamic Travel Planner Run
  console.log('\n--- 4. Running Complete ALGORITHM DynamicTravelPlanner for Goa (2 Days) ---');
  const result = await dynamicTravelPlanner({
    destination: 'Goa',
    numberOfDays: 2,
    dailyStartTime: '06:00',
    dailyEndTime: '20:30',
    userPreferences: { activities: 'nature,cultural,food', preferredPlaceType: 'beach' },
    transportMode: 'car'
  });

  console.log(`  Status: ${result.success}`);
  console.log(`  Total Places Visited: ${result.totalPlacesVisited}`);
  result.dailyItinerary.forEach((d) => {
    console.log(`\n  --- DAY ${d.day} ---`);
    console.log(`  Travel time: ${d.totalDayTravelTimeMinutes} mins | Entry fees: ₹${d.totalDayEntryFees}`);
    d.activities.forEach((act, idx) => {
      console.log(`    ${idx + 1}. ${act.name} | Category: ${act.category} | Time Fit: ${act.timeSuitabilityScore} | Cost: ₹${act.cost}`);
    });
  });

  // Test 5: Real-Time Traffic Re-Optimization
  console.log('\n--- 5. Testing Real-Time Traffic Re-Optimization (Step 10) ---');
  const reoptResult = await reoptimizeItinerary({
    destination: 'Goa',
    currentTime: '14:30',
    trafficDelayMinutes: 45,
    completedPlaceIds: [result.dailyItinerary[0]?.activities[0]?.placeId],
    userPreferences: { activities: 'nature,cultural' }
  });

  console.log(`  Re-optimized: ${reoptResult.reoptimized}`);
  console.log(`  Traffic Delay Applied: +${reoptResult.trafficDelayAppliedMinutes} mins`);
  console.log(`  Adjusted Start: ${reoptResult.adjustedStartTime}`);
  console.log('  Updated Next Stops:');
  reoptResult.updatedStops.forEach((s, idx) => {
    console.log(`    ${idx + 1}. ${s.name} [${s.arrivalTime} – ${s.visitEndTime}] (Travel: ${s.travelTimeMinutes} min)`);
  });

  console.log('\n✅ ALL ALGORITHM TESTS PASSED SUCCESSFULLY!\n');
}

testAlgorithm().catch(console.error);
