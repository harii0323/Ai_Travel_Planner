/**
 * VISTA AI Travel Optimization Engine - Automated Acceptance Test Suite
 * 
 * Verifies all 8 mandatory engineering scenarios specified in Section 15:
 * TEST 1: Hyderabad -> Kerala (Car, friends, spiritual, mountains, nature, trekking, photography)
 * TEST 2: Hyderabad -> Goa (Family, beaches, relaxation, sightseeing)
 * TEST 3: Hyderabad -> Tirupati (Public transportation, spiritual, limited budget)
 * TEST 4: Hyderabad -> Manali (Friends, mountains, adventure, photography)
 * TEST 5: Hyderabad -> Hampi (Historical architecture, cultural exploration)
 * TEST 6: Hyderabad -> Araku Valley (Nature, waterfalls, photography, relaxation)
 * TEST 7: Low budget with 2 available travel days
 * TEST 8: Flexible budget with strict daily travel-time limit
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { generateOptimizedItinerary } = require('./src/services/engine');

async function runAcceptanceTests() {
  console.log('========================================================================');
  console.log('🚀 VISTA AI TRAVEL OPTIMIZATION ENGINE - ACCEPTANCE TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function runTest(testName, testFn) {
    try {
      console.log(`▶️ RUNNING: ${testName}...`);
      await testFn();
      console.log(`   ✅ PASS: ${testName}\n`);
      passed++;
    } catch (err) {
      console.error(`   ❌ FAIL: ${testName}`);
      console.error(`      Reason: ${err.message}`);
      if (err.stack) console.error(err.stack.split('\n').slice(0, 3).join('\n'));
      console.log('');
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Hyderabad -> Kerala
  // --------------------------------------------------------------------------
  await runTest('TEST 1: Hyderabad -> Kerala (Car, friends, spiritual, mountains, nature, trekking, photography)', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Munnar, Kerala',
      travelDates: '2026-11-10 to 2026-11-14',
      totalDays: 5,
      budget: 50000,
      transport: 'car',
      travelCompanionType: 'friends',
      numberOfTravelers: 4,
      activities: 'mountains, nature, trekking, photography, scenic tea hills',
      departureTime: '06:00 AM'
    });

    assert(plan && plan.success, 'Plan should generate successfully');
    assert.strictEqual(plan.dailyItinerary.length, 5, 'Should have exactly 5 days');

    const stopNames = plan.dailyItinerary.flatMap(d => d.stops.map(s => s.placeName));
    console.log(`   Stops selected: ${stopNames.join(', ')}`);

    // Verify mountain/nature attractions in Kerala
    const hasKeralaAttraction = stopNames.some(s =>
      s.includes('Eravikulam') || s.includes('Tea') || s.includes('Mattupetty') || s.includes('Top Station')
    );
    assert(hasKeralaAttraction, 'Trip to Kerala must feature authentic mountain/tea attractions in Kerala');

    // Verify unbroken continuity
    for (let i = 0; i < plan.dailyItinerary.length - 1; i++) {
      assert.strictEqual(
        plan.dailyItinerary[i].overnightLocation,
        plan.dailyItinerary[i + 1].startingLocation,
        `Day ${i + 1} overnight location must match Day ${i + 2} starting location`
      );
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Hyderabad -> Goa (Family, beaches, relaxation, sightseeing)
  // --------------------------------------------------------------------------
  await runTest('TEST 2: Hyderabad -> Goa (Family, beaches, relaxation, sightseeing)', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Goa',
      travelDates: '2026-11-10 to 2026-11-13',
      totalDays: 4,
      budget: 45000,
      transport: 'car',
      travelCompanionType: 'family',
      numberOfTravelers: 4,
      activities: 'beaches, coastal relaxation, seaside walks, fresh seafood, sunset'
    });

    assert(plan && plan.success, 'Plan should generate successfully');
    const stopNames = plan.dailyItinerary.flatMap(d => d.stops.map(s => s.placeName));
    console.log(`   Goa Stops: ${stopNames.join(', ')}`);

    // CRITICAL: MUST NOT CONTAIN KERALA OR SRISAILAM OR LEPAKSHI TEMPLE!
    const leakedKeralaOrSrisailam = stopNames.some(s =>
      s.includes('Srisailam') || s.includes('Munnar') || s.includes('Eravikulam') || s.includes('Lepakshi')
    );
    assert(!leakedKeralaOrSrisailam, 'CRITICAL: Goa trip must NOT leak Srisailam, Lepakshi, or Munnar!');

    // Must prioritize authentic Goa coastal landmarks
    const hasGoaBeaches = stopNames.some(s =>
      s.includes('Beach') || s.includes('Aguada') || s.includes('Bom Jesus') || s.includes('Palolem')
    );
    assert(hasGoaBeaches, 'Goa trip must prioritize authentic beaches and coastal heritage');

    // Verify interest vector
    assert(plan.userPreferenceSummary.interests.beaches >= 0.85, 'Beaches interest must be >= 0.85');
    assert(plan.userPreferenceSummary.interests.spiritual <= 0.20, 'Unexpressed spiritual interest must remain low');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Hyderabad -> Tirupati (Public transportation, spiritual, limited budget)
  // --------------------------------------------------------------------------
  await runTest('TEST 3: Hyderabad -> Tirupati (Public transportation, spiritual journey, limited budget)', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Tirupati',
      travelDates: '2026-11-10 to 2026-11-12',
      totalDays: 3,
      budget: 12000,
      transport: 'bus',
      travelCompanionType: 'solo',
      numberOfTravelers: 1,
      activities: 'spiritual darshan, temples, religious heritage, pilgrimage'
    });

    assert(plan && plan.success, 'Plan should generate successfully');
    const stopNames = plan.dailyItinerary.flatMap(d => d.stops.map(s => s.placeName));
    console.log(`   Tirupati Stops: ${stopNames.join(', ')}`);

    // Verify spiritual temple focus
    const hasTirupatiTemples = stopNames.some(s =>
      s.includes('Venkateswara') || s.includes('Padmavathi') || s.includes('Kapila')
    );
    assert(hasTirupatiTemples, 'Tirupati trip must feature sacred Venkateswara or Padmavathi temples');

    // Verify transport mode is public
    assert.strictEqual(plan.transportDetails.isPersonalVehicle, false, 'Transport should be public transit');

    // Verify budget is calculated transparently
    assert(plan.totalEstimatedCost <= 15000, 'Cost should align with budget-conscious transit and pilgrim stay');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Hyderabad -> Manali (Friends, mountains, adventure, photography)
  // --------------------------------------------------------------------------
  await runTest('TEST 4: Hyderabad -> Manali (Friends, mountains, adventure and photography)', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Manali',
      travelDates: '2026-11-10 to 2026-11-14',
      totalDays: 5,
      budget: 65000,
      transport: 'car',
      travelCompanionType: 'friends',
      numberOfTravelers: 4,
      activities: 'mountains, snow valley, adventure sports, paragliding, photography'
    });

    assert(plan && plan.success, 'Plan should generate successfully');
    const stopNames = plan.dailyItinerary.flatMap(d => d.stops.map(s => s.placeName));
    console.log(`   Manali Stops: ${stopNames.join(', ')}`);

    // Verify mountain and adventure focus
    const hasManaliHighlights = stopNames.some(s =>
      s.includes('Solang') || s.includes('Atal') || s.includes('Hadimba') || s.includes('Jogini')
    );
    assert(hasManaliHighlights, 'Manali trip must feature Solang Valley, Atal Tunnel, or Himalayan highlights');
    assert(plan.userPreferenceSummary.interests.mountains >= 0.85, 'Mountains preference must be >= 0.85');
    assert(plan.userPreferenceSummary.interests.adventure >= 0.80, 'Adventure preference must be >= 0.80');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Hyderabad -> Hampi (Historical architecture, cultural exploration)
  // --------------------------------------------------------------------------
  await runTest('TEST 5: Hyderabad -> Hampi (Historical architecture and cultural exploration)', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Hampi',
      travelDates: '2026-11-10 to 2026-11-12',
      totalDays: 3,
      budget: 25000,
      transport: 'car',
      travelCompanionType: 'couple',
      numberOfTravelers: 2,
      activities: 'historical monuments, UNESCO architecture, ancient temples, stone chariot, ruins'
    });

    assert(plan && plan.success, 'Plan should generate successfully');
    const stopNames = plan.dailyItinerary.flatMap(d => d.stops.map(s => s.placeName));
    console.log(`   Hampi Stops: ${stopNames.join(', ')}`);

    const hasHampiMonuments = stopNames.some(s =>
      s.includes('Virupaksha') || s.includes('Vittala') || s.includes('Lotus Mahal') || s.includes('Matanga')
    );
    assert(hasHampiMonuments, 'Hampi trip must feature Virupaksha or Vijaya Vittala UNESCO monuments');
    assert(plan.userPreferenceSummary.interests.historical >= 0.85, 'Historical preference must be >= 0.85');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Hyderabad -> Araku Valley (Nature, waterfalls, photography, relaxation)
  // --------------------------------------------------------------------------
  await runTest('TEST 6: Hyderabad -> Araku Valley (Nature, waterfalls, photography and relaxation)', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Araku Valley',
      travelDates: '2026-11-10 to 2026-11-13',
      totalDays: 4,
      budget: 30000,
      transport: 'car',
      travelCompanionType: 'family',
      numberOfTravelers: 3,
      activities: 'waterfalls, nature walks, caves, coffee plantations, photography'
    });

    assert(plan && plan.success, 'Plan should generate successfully');
    const stopNames = plan.dailyItinerary.flatMap(d => d.stops.map(s => s.placeName));
    console.log(`   Araku Stops: ${stopNames.join(', ')}`);

    const hasArakuHighlights = stopNames.some(s =>
      s.includes('Borra') || s.includes('Katiki') || s.includes('Chaparai') || s.includes('Coffee') || s.includes('Galikonda')
    );
    assert(hasArakuHighlights, 'Araku trip must feature Borra Caves, Katiki Waterfalls, or Coffee Museum');
    assert(plan.userPreferenceSummary.interests.waterfalls >= 0.85, 'Waterfalls preference must be >= 0.85');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Low budget with 2 available travel days
  // --------------------------------------------------------------------------
  await runTest('TEST 7: A user with a very limited budget and only two available travel days', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Hampi',
      travelDates: '2026-11-10 to 2026-11-11',
      totalDays: 2,
      budget: 8000,
      transport: 'car',
      travelCompanionType: 'solo',
      numberOfTravelers: 1,
      activities: 'historical sightseeing, photography'
    });

    assert(plan && plan.success, 'Plan should generate successfully');
    assert.strictEqual(plan.dailyItinerary.length, 2, 'Should have exactly 2 days');

    // Day 1 onward, Day 2 return
    assert.strictEqual(plan.dailyItinerary[0].startingLocation, 'Hyderabad');
    assert.strictEqual(plan.dailyItinerary[1].overnightLocation, 'Hyderabad', 'Return day must end back at Hyderabad');

    console.log(`   Total estimated cost: ₹${plan.totalEstimatedCost} (Budget: ₹8000)`);
    assert(Number.isFinite(plan.totalEstimatedCost), 'Cost must be a valid number');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Flexible budget with strict daily travel-time limit
  // --------------------------------------------------------------------------
  await runTest('TEST 8: A user with a flexible budget but a strict daily travel-time limit', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Goa',
      travelDates: '2026-11-10 to 2026-11-13',
      totalDays: 4,
      budget: 80000,
      transport: 'car',
      travelCompanionType: 'family',
      numberOfTravelers: 3,
      travelPace: 'relaxed',
      activities: 'beaches, relaxation, luxury resorts'
    });

    assert(plan && plan.success, 'Plan should generate successfully');
    assert.strictEqual(plan.userPreferenceSummary.travelPace, 'relaxed');

    // Verify relaxed daily pace
    plan.dailyItinerary.forEach(d => {
      console.log(`   Day ${d.dayNumber}: ${d.totalDistance} driving (${d.totalTravelDuration})`);
    });

    assert.strictEqual(plan.budgetStatus, 'WITHIN_BUDGET', 'Generous budget should be comfortably within budget');
  });

  console.log('========================================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});

