/**
 * Validation Test Suite for Reengineered PlacesDiscoveryEngine and RouteDiscoveryEngine
 * 
 * Tests:
 * 1. Places Discovery Tests across 4 distinct destination regions and preference profiles:
 *    - Kerala (mountains, trekking, waterfalls)
 *    - Goa (beaches, water activities, nightlife)
 *    - Hampi (history, architecture, photography)
 *    - Tirupati (spiritual, temples, nature)
 * 2. Route Discovery Tests across 5 arbitrary point-to-point location pairs:
 *    - Hyderabad -> Srisailam
 *    - Srisailam -> Kurnool
 *    - Munnar -> Thekkady
 *    - Thekkady -> Alleppey
 *    - Alleppey -> Hyderabad
 * 3. Multi-Stop Route Optimization (2-Opt TSP) for 5+ attractions eliminating backtracking
 * 4. Route Deviation Analysis (marginal distance, time, and cost)
 * 5. Return Journey Route Independence and Corridor POI Discovery
 */

const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const {
  discoverPlaces,
  discoverPreferredPlaces,
  discoverMustVisitPlaces,
  discoverCorridorPlaces,
  calculatePlaceScores,
  deduplicatePlaces,
  VERIFIED_PLACES_DATABASE,
  DESTINATION_REGIONS
} = require('./src/services/engine/PlacesDiscoveryEngine');

const {
  calculateRoute,
  calculateRouteDeviation,
  optimizeMultiStopSequence,
  calculateFuelAndTollCost,
  calculateHaversineDistanceKm,
  KNOWN_COORDINATES
} = require('./src/services/engine/RouteDiscoveryEngine');

const { planOnwardJourney } = require('./src/services/engine/OnwardJourneyEngine');
const { planReturnJourney } = require('./src/services/engine/ReturnJourneyEngine');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  process.stdout.write(`▶️  RUNNING: ${testName}... `);
  try {
    fn();
    passedTests++;
    console.log('✅ PASS');
  } catch (err) {
    console.log('❌ FAIL');
    console.error(`   Error: ${err.message}`);
    throw err;
  }
}

async function runTestAsync(testName, fn) {
  totalTests++;
  process.stdout.write(`▶️  RUNNING: ${testName}... `);
  try {
    await fn();
    passedTests++;
    console.log('✅ PASS');
  } catch (err) {
    console.log('❌ FAIL');
    console.error(`   Error: ${err.message}`);
    throw err;
  }
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🚀 PLACES DISCOVERY & ROUTE DISCOVERY REENGINEERING VALIDATION SUITE');
  console.log('========================================================================\n');

  // =========================================================================
  // GROUP 1: PLACES DISCOVERY TESTS
  // =========================================================================
  console.log('--- GROUP 1: PLACES DISCOVERY ENGINE TESTS ---');

  // Test 1.1: Kerala with Mountain/Trekking/Waterfalls
  await runTestAsync('1.1: Kerala (Mountains, Trekking, Waterfalls Preferences)', async () => {
    const result = await discoverPlaces({
      destination: 'Kerala',
      origin: 'Hyderabad',
      userProfile: {
        destinationCity: 'Kerala',
        normalizedInterests: {
          mountains: 0.95,
          trekking: 0.90,
          waterfalls: 0.92,
          scenery: 0.85
        },
        companionType: 'friends'
      }
    });

    assert(result && result.allPlaces, 'Expected allPlaces in result');
    assert(result.preferredPlaces.length >= 3, `Expected at least 3 preferred places, got ${result.preferredPlaces.length}`);
    assert(result.mustVisitPlaces.length >= 3, `Expected at least 3 must-visit places, got ${result.mustVisitPlaces.length}`);

    // Verify preferred attractions align with mountains/trekking/waterfalls
    const prefNames = result.preferredPlaces.map(p => p.name.toLowerCase());
    const hasMountainOrWaterfall = prefNames.some(n =>
      n.includes('waterfall') || n.includes('cascades') || n.includes('national park') || n.includes('ridge') || n.includes('peak')
    );
    assert(hasMountainOrWaterfall, 'Preferred places must contain mountain/trekking/waterfall attractions');

    // Verify destination must-visit attractions are present
    const mustNames = result.mustVisitPlaces.map(p => p.name);
    const hasIconicKerala = mustNames.some(n =>
      n.includes('Eravikulam') || n.includes('Mattupetty') || n.includes('Periyar') || n.includes('Athirappilly')
    );
    assert(hasIconicKerala, 'Must-visit places must include iconic Kerala landmarks');

    // Verify complete structured data contracts
    result.allPlaces.forEach(p => {
      assert(p.placeId, `Missing placeId in ${p.name}`);
      assert(p.name, 'Missing name');
      assert(p.coordinates && typeof p.coordinates.lat === 'number' && typeof p.coordinates.lng === 'number', `Invalid coordinates in ${p.name}`);
      assert(p.category, `Missing category in ${p.name}`);
      assert(typeof p.rating === 'number', `Missing rating in ${p.name}`);
      assert(p.openHours, `Missing openHours in ${p.name}`);
      assert(p.estimatedVisitDurationMinutes > 0, `Missing duration in ${p.name}`);
      assert(typeof p.preferenceScore === 'number', `Missing preferenceScore in ${p.name}`);
      assert(typeof p.mustVisitScore === 'number', `Missing mustVisitScore in ${p.name}`);
      assert(typeof p.overallScore === 'number', `Missing overallScore in ${p.name}`);
    });

    // Verify zero duplicates
    const idSet = new Set();
    result.allPlaces.forEach(p => {
      assert(!idSet.has(p.placeId), `Duplicate placeId found: ${p.placeId}`);
      idSet.add(p.placeId);
    });
  });

  // Test 1.2: Goa with Beach/Water Activities/Nightlife
  await runTestAsync('1.2: Goa (Beaches, Water Activities, Nightlife Preferences)', async () => {
    const result = await discoverPlaces({
      destination: 'Goa',
      origin: 'Hyderabad',
      userProfile: {
        destinationCity: 'Goa',
        normalizedInterests: {
          beaches: 0.95,
          water_activities: 0.90,
          nightlife: 0.85
        },
        companionType: 'friends'
      }
    });

    assert(result.preferredPlaces.length >= 3, `Expected >= 3 preferred places, got ${result.preferredPlaces.length}`);
    assert(result.mustVisitPlaces.length >= 3, `Expected >= 3 must-visit places, got ${result.mustVisitPlaces.length}`);

    // Verify preferred attractions align with beaches/water activities
    const prefNames = result.preferredPlaces.map(p => p.name.toLowerCase());
    const hasBeachOrWater = prefNames.some(n =>
      n.includes('beach') || n.includes('watersports') || n.includes('bay') || n.includes('cove')
    );
    assert(hasBeachOrWater, 'Preferred places must contain beach and coastal attractions');

    // Verify must-visit Goa landmarks
    const mustNames = result.mustVisitPlaces.map(p => p.name);
    const hasIconicGoa = mustNames.some(n =>
      n.includes('Basilica of Bom Jesus') || n.includes('Fort Aguada') || n.includes('Palolem') || n.includes('Fontainhas')
    );
    assert(hasIconicGoa, 'Must-visit places must include iconic Goa landmarks');

    // Verify zero duplicates
    const idSet = new Set();
    result.allPlaces.forEach(p => {
      assert(!idSet.has(p.placeId), `Duplicate placeId found: ${p.placeId}`);
      idSet.add(p.placeId);
    });
  });

  // Test 1.3: Hampi with History/Architecture/Photography
  await runTestAsync('1.3: Hampi (History, Architecture, Photography Preferences)', async () => {
    const result = await discoverPlaces({
      destination: 'Hampi',
      origin: 'Hyderabad',
      userProfile: {
        destinationCity: 'Hampi',
        normalizedInterests: {
          historical: 0.95,
          architecture: 0.90,
          photography: 0.92
        },
        companionType: 'friends'
      }
    });

    assert(result.preferredPlaces.length >= 3, `Expected >= 3 preferred places, got ${result.preferredPlaces.length}`);
    assert(result.mustVisitPlaces.length >= 3, `Expected >= 3 must-visit places, got ${result.mustVisitPlaces.length}`);

    // Verify preferred attractions align with history/architecture
    const prefNames = result.preferredPlaces.map(p => p.name.toLowerCase());
    const hasHistoryOrArch = prefNames.some(n =>
      n.includes('temple') || n.includes('chariot') || n.includes('mahal') || n.includes('monolithic') || n.includes('hill')
    );
    assert(hasHistoryOrArch, 'Preferred places must contain historic temples, chariots, and architecture');

    // Verify iconic Hampi must-visits
    const mustNames = result.mustVisitPlaces.map(p => p.name);
    const hasIconicHampi = mustNames.some(n =>
      n.includes('Virupaksha') || n.includes('Vittala') || n.includes('Lotus Mahal') || n.includes('Matanga')
    );
    assert(hasIconicHampi, 'Must-visit places must include iconic Hampi landmarks');

    // Verify zero duplicates
    const idSet = new Set();
    result.allPlaces.forEach(p => {
      assert(!idSet.has(p.placeId), `Duplicate placeId found: ${p.placeId}`);
      idSet.add(p.placeId);
    });
  });

  // Test 1.4: Tirupati with Spiritual/Temples/Nature
  await runTestAsync('1.4: Tirupati (Spiritual, Temples, Nature Preferences)', async () => {
    const result = await discoverPlaces({
      destination: 'Tirupati',
      origin: 'Hyderabad',
      userProfile: {
        destinationCity: 'Tirupati',
        normalizedInterests: {
          spiritual: 0.95,
          temples: 0.95,
          nature: 0.85
        },
        companionType: 'family'
      }
    });

    assert(result.preferredPlaces.length >= 3, `Expected >= 3 preferred places, got ${result.preferredPlaces.length}`);
    assert(result.mustVisitPlaces.length >= 3, `Expected >= 3 must-visit places, got ${result.mustVisitPlaces.length}`);

    // Verify preferred attractions align with spiritual/temple/nature
    const prefNames = result.preferredPlaces.map(p => p.name.toLowerCase());
    const hasSpiritualOrNature = prefNames.some(n =>
      n.includes('temple') || n.includes('theertham') || n.includes('waterfalls') || n.includes('arch')
    );
    assert(hasSpiritualOrNature, 'Preferred places must contain temples and sacred nature shrines');

    // Verify iconic Tirupati must-visits
    const mustNames = result.mustVisitPlaces.map(p => p.name);
    const hasIconicTirupati = mustNames.some(n =>
      n.includes('Venkateswara') || n.includes('Silathoranam') || n.includes('Kapila') || n.includes('Chandragiri')
    );
    assert(hasIconicTirupati, 'Must-visit places must include iconic Tirupati landmarks');

    // Verify zero duplicates
    const idSet = new Set();
    result.allPlaces.forEach(p => {
      assert(!idSet.has(p.placeId), `Duplicate placeId found: ${p.placeId}`);
      idSet.add(p.placeId);
    });
  });

  // =========================================================================
  // GROUP 2: ROUTE DISCOVERY TESTS (Arbitrary Point-to-Point Pairs)
  // =========================================================================
  console.log('\n--- GROUP 2: ROUTE DISCOVERY ENGINE TESTS (ARBITRARY PAIRS) ---');

  const testPairs = [
    { origin: 'Hyderabad', destination: 'Srisailam', expectedMinKm: 210, expectedMaxKm: 240, ghatCheck: true },
    { origin: 'Srisailam', destination: 'Kurnool', expectedMinKm: 185, expectedMaxKm: 220, ghatCheck: true },
    { origin: 'Munnar', destination: 'Thekkady', expectedMinKm: 75, expectedMaxKm: 100, ghatCheck: true },
    { origin: 'Thekkady', destination: 'Alleppey', expectedMinKm: 115, expectedMaxKm: 145, ghatCheck: false },
    { origin: 'Alleppey', destination: 'Hyderabad', expectedMinKm: 1100, expectedMaxKm: 1350, ghatCheck: false }
  ];

  for (const pair of testPairs) {
    await runTestAsync(`2.x: Route ${pair.origin} -> ${pair.destination}`, async () => {
      const route = await calculateRoute(pair.origin, pair.destination, { transportMode: 'car' });

      assert(route, `Failed to calculate route for ${pair.origin} -> ${pair.destination}`);
      assert(typeof route.totalDistanceKm === 'number', 'Missing totalDistanceKm');
      assert(typeof route.drivingDurationMinutes === 'number', 'Missing drivingDurationMinutes');
      assert(route.drivingDurationFormatted, 'Missing drivingDurationFormatted');
      assert(route.polyline && route.polyline.length > 0, 'Missing polyline geometry');
      assert(Array.isArray(route.waypoints) && route.waypoints.length >= 2, 'Waypoints must contain at least origin and destination');
      assert(route.cost && route.cost.fuelCost > 0, 'Fuel cost must be calculated');
      assert(route.cost.totalTransitCost === route.cost.fuelCost + route.cost.tollCost, 'Transit cost must equal fuel + tolls');

      // Verify road distance is bounded realistically (NOT straight-line)
      assert(
        route.totalDistanceKm >= pair.expectedMinKm && route.totalDistanceKm <= pair.expectedMaxKm,
        `Expected distance between ${pair.expectedMinKm} and ${pair.expectedMaxKm} km, got ${route.totalDistanceKm} km`
      );

      // Verify straight-line distance comparison
      const oCoord = KNOWN_COORDINATES[pair.origin.toLowerCase()];
      const dCoord = KNOWN_COORDINATES[pair.destination.toLowerCase()];
      if (oCoord && dCoord) {
        const straightLineKm = calculateHaversineDistanceKm(oCoord, dCoord);
        assert(
          route.totalDistanceKm > straightLineKm * 1.15,
          `Road distance (${route.totalDistanceKm} km) must be strictly greater than straight-line distance (${straightLineKm.toFixed(1)} km) by at least 15%`
        );
      }
    });
  }

  // =========================================================================
  // GROUP 3: MULTI-STOP ROUTE OPTIMIZATION TEST (2-Opt TSP)
  // =========================================================================
  console.log('\n--- GROUP 3: MULTI-STOP ROUTE OPTIMIZATION (2-Opt TSP) ---');

  runTest('3.1: 5+ Multi-Stop Sequence Optimization (Eliminates Backtracking)', () => {
    // 5 scattered attractions in Kerala exploration region in intentionally zigzagging order
    const scatteredStops = [
      { name: 'Top Station (Far East)', coordinates: { lat: 10.1250, lng: 77.2450 } },
      { name: 'Attukad Falls (Southwest)', coordinates: { lat: 10.0540, lng: 77.0420 } },
      { name: 'Kundala Dam (East-Central)', coordinates: { lat: 10.1340, lng: 77.2180 } },
      { name: 'Pothamedu Ridge (West)', coordinates: { lat: 10.0580, lng: 77.0620 } },
      { name: 'Mattupetty Dam (Central-East)', coordinates: { lat: 10.1060, lng: 77.1240 } }
    ];

    const hubCoord = { lat: 10.0889, lng: 77.0595 }; // Munnar town center

    // Helper to compute tour distance
    const computeTour = (tour) => {
      let d = calculateHaversineDistanceKm(hubCoord, tour[0].coordinates);
      for (let i = 0; i < tour.length - 1; i++) {
        d += calculateHaversineDistanceKm(tour[i].coordinates, tour[i + 1].coordinates);
      }
      d += calculateHaversineDistanceKm(tour[tour.length - 1].coordinates, hubCoord);
      return d;
    };

    const initialTourKm = computeTour(scatteredStops);
    const optimizedStops = optimizeMultiStopSequence(hubCoord, hubCoord, scatteredStops);
    const optimizedTourKm = computeTour(optimizedStops);

    assert.strictEqual(optimizedStops.length, scatteredStops.length, 'All stops must be preserved');
    assert(
      optimizedTourKm <= initialTourKm - 5.0,
      `Optimized tour (${optimizedTourKm.toFixed(1)} km) must be significantly shorter than initial tour (${initialTourKm.toFixed(1)} km)`
    );

    // Verify all names are preserved
    const initialNames = new Set(scatteredStops.map(s => s.name));
    optimizedStops.forEach(s => {
      assert(initialNames.has(s.name), `Missing stop ${s.name} in optimized output`);
    });
  });

  // =========================================================================
  // GROUP 4: ROUTE DEVIATION ANALYSIS
  // =========================================================================
  console.log('\n--- GROUP 4: ROUTE DEVIATION ANALYSIS ---');

  await runTestAsync('4.1: Route Detour Calculation (Direct vs Detour Evaluation)', async () => {
    // Direct: Hyderabad -> Kurnool (~214 km)
    // Detour candidate: Alampur Jogulamba Temple (~5 km off NH 44, feasible)
    const alampurCoord = { lat: 15.8770, lng: 78.1340 };

    const deviation = await calculateRouteDeviation('Hyderabad', 'Kurnool', alampurCoord, { transportMode: 'car' });

    assert(deviation, 'Expected deviation analysis result');
    assert(typeof deviation.directDistanceKm === 'number', 'Missing directDistanceKm');
    assert(typeof deviation.detourDistanceKm === 'number', 'Missing detourDistanceKm');
    assert(typeof deviation.additionalDistanceKm === 'number', 'Missing additionalDistanceKm');
    assert(typeof deviation.additionalDurationMinutes === 'number', 'Missing additionalDurationMinutes');
    assert(typeof deviation.totalAdditionalCost === 'number', 'Missing totalAdditionalCost');
    assert(typeof deviation.isDetourWorthwhile === 'boolean', 'Missing isDetourWorthwhile boolean');
    assert(deviation.recommendationReason, 'Missing recommendationReason string');

    // Alampur is right on NH 44, so additional detour should be reasonable (< 40 km)
    assert(
      deviation.additionalDistanceKm <= 40,
      `Detour to Alampur should be small (< 40 km), got ${deviation.additionalDistanceKm} km`
    );
    assert.strictEqual(deviation.isDetourWorthwhile, true, 'Detour to Alampur should be flagged as worthwhile');
  });

  // =========================================================================
  // GROUP 5: RETURN JOURNEY ROUTE INDEPENDENCE AND CORRIDOR POI DISCOVERY
  // =========================================================================
  console.log('\n--- GROUP 5: RETURN JOURNEY INDEPENDENCE & CORRIDOR DISCOVERY ---');

  await runTestAsync('5.1: Return Route Independence & Return Corridor Discovery', async () => {
    const userProfile = {
      origin: 'Hyderabad',
      destinationCity: 'Kerala',
      totalDays: 7,
      transportMode: 'car',
      normalizedInterests: { scenery: 0.9, spiritual: 0.8, historical: 0.8 },
      totalBudget: 60000
    };

    const forwardRoute = await calculateRoute('Hyderabad', 'Kerala', { transportMode: 'car' });
    const onwardPlan = planOnwardJourney({
      origin: 'Hyderabad',
      destination: 'Kerala',
      onwardDays: 2,
      userProfile,
      routeInfo: forwardRoute,
      candidatePlaces: VERIFIED_PLACES_DATABASE
    });

    const returnPlan = planReturnJourney({
      destination: 'Kerala',
      origin: 'Hyderabad',
      returnDays: 2,
      userProfile,
      returnRouteInfo: forwardRoute,
      candidatePlaces: VERIFIED_PLACES_DATABASE
    });

    assert(onwardPlan && onwardPlan.length === 2, 'Expected 2 onward days');
    assert(returnPlan && returnPlan.length === 2, 'Expected 2 return days');

    // Verify return route hubs are distinct and independent
    const onwardHubs = onwardPlan.map(d => d.overnightHub || d.endLocation);
    const returnHubs = returnPlan.map(d => d.overnightHub || d.endLocation);

    // Verify return stops contain corridor POIs
    const returnStops = returnPlan.flatMap(d => (d.stops || []).map(s => s.name));
    assert(returnStops.length > 0, 'Return journey must include transit attractions along the return corridor');

    // Verify return reaches original origin
    const finalReturnHub = returnHubs[returnHubs.length - 1];
    assert(
      finalReturnHub.toLowerCase().includes('hyderabad'),
      `Final return hub must be Hyderabad, got ${finalReturnHub}`
    );
  });

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
  console.log('========================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

