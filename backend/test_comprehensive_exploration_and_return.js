/**
 * Test Suite: Destination Regional Exploration & Independent Return Journey Verification
 * 
 * Verifies all criteria from user prompt:
 * - TEST A: Hyderabad -> Kerala (7 Days, Car, Friends, Mountains, Scenery, Trekking, Spirituality, Adventure, Photography)
 * - TEST B: Hyderabad -> Goa (5 Days, Car, Friends, Beaches, Water Activities, Photography, Relaxation)
 * - TEST C: Hyderabad -> Hampi (4 Days, Car, History, Architecture, Culture, Photography)
 * - TEST D: Hyderabad -> Araku Valley (4 Days, Car, Friends, Nature, Waterfalls, Scenic Viewpoints, Photography)
 * - TEST E: Hyderabad -> Tirupati (3 Days, Family, Spirituality, Temples, Comfortable Travel)
 * - Zero Stop Overlap between Onward and Return
 * - Regional Multi-Zone Exploration
 * - Non-empty, purposeful sightseeing on Return
 * - Full Cost Reconciliation
 */

const assert = require('assert');
const planner = require('./src/services/planner');

let passed = 0;
let failed = 0;

async function testAsync(testName, fn) {
  process.stdout.write(`▶️  RUNNING: ${testName}...\n`);
  try {
    await fn();
    console.log(`   ✅ PASS: ${testName}\n`);
    passed++;
  } catch (err) {
    console.error(`   ❌ FAIL: ${testName}`);
    console.error(`      Reason: ${err.message}`);
    if (err.stack) console.error(err.stack);
    console.error('\n');
    failed++;
  }
}

async function runAcceptanceSuite() {
  console.log('========================================================================');
  console.log('🚀 DESTINATION EXPLORATION & RETURN JOURNEY OPTIMIZATION ACCEPTANCE SUITE');
  console.log('========================================================================\n');

  // =========================================================================
  // TEST A: Hyderabad to Kerala (7 Days, Car, Friends)
  // =========================================================================
  await testAsync('TEST A: Hyderabad -> Kerala (7 Days, Multi-Zone Exploration & Independent Return)', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Kerala',
      travelDates: '2026-11-10 to 2026-11-16',
      totalDays: 7,
      budget: 65000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'diesel',
      mileage: 18,
      travelCompanionType: 'friends',
      numberOfTravelers: 3,
      activities: 'mountains,scenery,trekking,spirituality,adventure,photography'
    });

    assert(itinerary && itinerary.dayPlans, 'Expected dayPlans in response');
    const dayPlans = itinerary.dayPlans;
    assert.strictEqual(dayPlans.length, 7, `Expected 7 days, got ${dayPlans.length}`);

    // Verify 3 distinct journey phases:
    const onwardDays = dayPlans.filter(d => d.phase === 'Onward Journey' || d.journeyPhase === 'ONWARD');
    const destDays = dayPlans.filter(d => d.phase === 'Destination Stay' || d.journeyPhase === 'DESTINATION_EXPLORATION');
    const returnDays = dayPlans.filter(d => d.phase === 'Return Journey' || d.journeyPhase === 'RETURN');

    assert(onwardDays.length >= 1, `Expected onward days, got ${onwardDays.length}`);
    assert(destDays.length >= 2, `Expected at least 2 destination days, got ${destDays.length}`);
    assert(returnDays.length >= 1, `Expected return days, got ${returnDays.length}`);

    console.log(`     Phase breakdown: ${onwardDays.length} Onward Days, ${destDays.length} Destination Exploration Days, ${returnDays.length} Return Days`);

    // Verify destination exploration explores multiple zones and distinct places across days
    const destStops = destDays.flatMap(d => d.stops);
    const destStopNames = destStops.map(s => s.placeName || s.name);
    console.log(`     Destination Exploration Stops: ${destStopNames.join(', ')}`);
    assert(destStops.length >= 4, `Expected at least 4 destination attractions across Kerala, got ${destStops.length}`);

    // Verify that multiple categories are explored (scenic/mountains, wildlife, waterfalls, nature)
    const destCats = new Set(destStops.map(s => s.category));
    assert(destCats.size >= 2, `Expected diverse categories across Kerala destination stay, got: ${[...destCats].join(', ')}`);

    // Verify Independent Return Journey contains actual sightseeing attractions (not empty!)
    const returnStops = returnDays.flatMap(d => d.stops);
    const returnStopNames = returnStops.map(s => s.placeName || s.name);
    console.log(`     Return Journey Sightseeing Stops: ${returnStopNames.join(', ')}`);
    assert(returnStops.length >= 1, 'Return journey must contain meaningful sightseeing stops, not just highway travel');

    // CRITICAL: Verify NO overlap between onward stops and return stops
    const onwardStopNames = onwardDays.flatMap(d => d.stops).map(s => (s.placeName || s.name).toLowerCase());
    returnStops.forEach(rs => {
      const rsName = (rs.placeName || rs.name).toLowerCase();
      assert(!onwardStopNames.includes(rsName), `Return stop "${rsName}" duplicates an onward stop! Onward and return must be independent.`);
    });

    // Verify strict location continuity
    for (let i = 0; i < dayPlans.length - 1; i++) {
      const currentEnd = dayPlans[i].endLocation;
      const nextStart = dayPlans[i + 1].startLocation;
      assert.strictEqual(currentEnd, nextStart, `Day ${i + 1} end "${currentEnd}" does not match Day ${i + 2} start "${nextStart}"`);
    }

    // Verify final day arrives back at Hyderabad
    const finalDay = dayPlans[dayPlans.length - 1];
    assert(finalDay.endLocation.includes('Hyderabad'), `Final day must arrive back at Hyderabad, got: ${finalDay.endLocation}`);
  });

  // =========================================================================
  // TEST B: Hyderabad to Goa (5 Days, Car, Friends)
  // =========================================================================
  await testAsync('TEST B: Hyderabad -> Goa (5 Days, Coastal Exploration & Heritage Return)', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Goa',
      travelDates: '2026-11-10 to 2026-11-14',
      totalDays: 5,
      budget: 40000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'petrol',
      mileage: 15,
      travelCompanionType: 'friends',
      numberOfTravelers: 3,
      activities: 'beaches,water activities,photography,relaxation'
    });

    const dayPlans = itinerary.dayPlans;
    assert.strictEqual(dayPlans.length, 5, `Expected 5 days, got ${dayPlans.length}`);

    // Destination stay must focus on Goa coastal/heritage experiences
    const destDays = dayPlans.filter(d => d.phase === 'Destination Stay' || d.journeyPhase === 'DESTINATION_EXPLORATION');
    const destStops = destDays.flatMap(d => d.stops);
    const destStopNames = destStops.map(s => s.placeName || s.name);
    console.log(`     Goa Exploration Stops: ${destStopNames.join(', ')}`);

    // Verify coastal / beach presence
    const hasBeaches = destStops.some(s => {
      const name = (s.placeName || s.name).toLowerCase();
      const cat = (s.category || '').toLowerCase();
      return name.includes('beach') || name.includes('fort') || cat.includes('beach') || cat.includes('coastal');
    });
    assert(hasBeaches, 'Goa itinerary must prioritize coastal/beach attractions for beach preference');

    // Verify independent return stops (e.g. Badami, Pattadakal, or Mantralayam)
    const returnDays = dayPlans.filter(d => d.phase === 'Return Journey' || d.journeyPhase === 'RETURN');
    const returnStops = returnDays.flatMap(d => d.stops);
    const returnStopNames = returnStops.map(s => s.placeName || s.name);
    console.log(`     Goa Return Stops: ${returnStopNames.join(', ')}`);
    assert(returnStops.length >= 1, 'Return journey from Goa must contain meaningful sightseeing stops');
  });

  // =========================================================================
  // TEST C: Hyderabad to Hampi (4 Days, Car)
  // =========================================================================
  await testAsync('TEST C: Hyderabad -> Hampi (4 Days, Architectural & Kishkindha Multi-Zone)', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Hampi',
      travelDates: '2026-11-10 to 2026-11-13',
      totalDays: 4,
      budget: 28000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'petrol',
      mileage: 15,
      travelCompanionType: 'friends',
      numberOfTravelers: 2,
      activities: 'history,architecture,culture,photography'
    });

    const dayPlans = itinerary.dayPlans;
    assert.strictEqual(dayPlans.length, 4, `Expected 4 days, got ${dayPlans.length}`);

    const destDays = dayPlans.filter(d => d.phase === 'Destination Stay' || d.journeyPhase === 'DESTINATION_EXPLORATION');
    const destStops = destDays.flatMap(d => d.stops);
    const destStopNames = destStops.map(s => s.placeName || s.name);
    console.log(`     Hampi Exploration Stops: ${destStopNames.join(', ')}`);

    // Verify Hampi historical / architectural landmarks
    const hasVijayanagaraHeritage = destStops.some(s => {
      const name = (s.placeName || s.name).toLowerCase();
      return name.includes('virupaksha') || name.includes('vittala') || name.includes('chariot') || name.includes('lotus mahal') || name.includes('hemakuta');
    });
    assert(hasVijayanagaraHeritage, 'Hampi itinerary must prioritize authentic Vijayanagara architectural landmarks');

    // Verify return journey has an independent stop
    const returnDays = dayPlans.filter(d => d.phase === 'Return Journey' || d.journeyPhase === 'RETURN');
    const returnStops = returnDays.flatMap(d => d.stops);
    assert(returnStops.length >= 1, 'Return journey from Hampi must contain sightseeing');
    console.log(`     Hampi Return Stops: ${returnStops.map(s => s.placeName || s.name).join(', ')}`);
  });

  // =========================================================================
  // TEST D: Hyderabad to Araku Valley (4 Days, Car, Friends)
  // =========================================================================
  await testAsync('TEST D: Hyderabad -> Araku Valley (4 Days, Waterfalls, Caves & Valley Highlands)', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Araku Valley',
      travelDates: '2026-11-10 to 2026-11-13',
      totalDays: 4,
      budget: 32000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'petrol',
      mileage: 14,
      travelCompanionType: 'friends',
      numberOfTravelers: 3,
      activities: 'nature,waterfalls,scenic viewpoints,photography'
    });

    const dayPlans = itinerary.dayPlans;
    assert.strictEqual(dayPlans.length, 4, `Expected 4 days, got ${dayPlans.length}`);

    const destDays = dayPlans.filter(d => d.phase === 'Destination Stay' || d.journeyPhase === 'DESTINATION_EXPLORATION');
    const destStops = destDays.flatMap(d => d.stops);
    const destStopNames = destStops.map(s => s.placeName || s.name);
    console.log(`     Araku Exploration Stops: ${destStopNames.join(', ')}`);

    // Verify Borra Caves, Chaparai or Katiki falls presence
    const hasArakuNature = destStops.some(s => {
      const name = (s.placeName || s.name).toLowerCase();
      return name.includes('borra') || name.includes('chaparai') || name.includes('katiki') || name.includes('galikonda') || name.includes('coffee');
    });
    assert(hasArakuNature, 'Araku itinerary must prioritize caves, waterfalls and Eastern Ghats viewpoints');
  });

  // =========================================================================
  // TEST E: Hyderabad to Tirupati (3 Days, Family, Spiritual)
  // =========================================================================
  await testAsync('TEST E: Hyderabad -> Tirupati (3 Days, Sacred Temples & Comfortable Travel)', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Tirupati',
      travelDates: '2026-11-10 to 2026-11-12',
      totalDays: 3,
      budget: 25000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'diesel',
      mileage: 16,
      travelCompanionType: 'family',
      numberOfTravelers: 4,
      activities: 'spirituality,temples,comfortable travel'
    });

    const dayPlans = itinerary.dayPlans;
    assert.strictEqual(dayPlans.length, 3, `Expected 3 days, got ${dayPlans.length}`);

    const allStops = dayPlans.flatMap(d => d.stops);
    const allStopNames = allStops.map(s => s.placeName || s.name);
    console.log(`     Tirupati Trip Stops: ${allStopNames.join(', ')}`);

    // Verify Tirumala/Tirupati temple presence
    const hasTemples = allStops.some(s => {
      const name = (s.placeName || s.name).toLowerCase();
      return name.includes('venkateswara') || name.includes('tirumala') || name.includes('padmavathi') || name.includes('kapila');
    });
    assert(hasTemples, 'Tirupati trip must feature authentic Tirumala and sacred foothill shrines');

    // Verify no nightlife or extreme adventure stops for family spiritual trip
    allStops.forEach(s => {
      const cat = (s.category || '').toLowerCase();
      assert(!cat.includes('nightlife') && !cat.includes('pub'), `Inappropriate category "${cat}" in family spiritual trip`);
    });
  });

  // =========================================================================
  // TEST F: Cost Model Reconciliation Across Line Items and Total
  // =========================================================================
  await testAsync('TEST F: Global Cost Reconciliation Across Categories and Day Totals', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Kerala',
      travelDates: '2026-11-10 to 2026-11-16',
      totalDays: 7,
      budget: 65000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'diesel',
      mileage: 18,
      travelCompanionType: 'friends',
      numberOfTravelers: 3,
      activities: 'mountains,scenery,trekking,adventure'
    });

    const cs = itinerary.costSummary;
    assert(cs, 'Missing costSummary');
    assert(cs.totalTripCost > 0, 'Total trip cost must be positive');

    const catSum = cs.fuel + cs.tolls + cs.localTransport + cs.accommodation + cs.food + cs.entryFees + cs.activities + cs.parking + cs.other;
    assert.strictEqual(Math.round(catSum), Math.round(cs.totalTripCost), `Category sum (${catSum}) does not match totalTripCost (${cs.totalTripCost})`);

    const daySum = cs.dayWise.reduce((sum, d) => sum + d.dayTotal, 0);
    assert.strictEqual(Math.round(daySum), Math.round(cs.totalTripCost), `Day total sum (${daySum}) does not match totalTripCost (${cs.totalTripCost})`);

    console.log(`     Reconciled Total Cost: ₹${cs.totalTripCost} (Fuel: ₹${cs.fuel}, Tolls: ₹${cs.tolls}, Acc: ₹${cs.accommodation}, Food: ₹${cs.food}, Tickets: ₹${cs.entryFees})`);
  });

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceSuite();

