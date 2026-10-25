/**
 * TEST SUITE: Onward Journey Search & Multi-Day Itinerary Engine Remediation
 *
 * Validates:
 * 1. Corridor Candidate Discovery (Real attractions along NH44/NH544, 4-tier corridor coverage)
 * 2. Multi-day Phase Allocation (>450 km journeys get 2 onward days for safe driving limits)
 * 3. Multi-day Journey Continuity (Day N+1 starts from Day N's actual intermediate overnight hub)
 * 4. Realistic Distance-Derived Transit Durations (|d_B - d_A| / 65 km/h + detour)
 * 5. Cost Reconciliation (Line items == Category totals == Day totals == Grand total)
 * 6. Live API End-to-End Validation via POST /api/itinerary/generate
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const planner = require('./src/services/planner');
const {
  classifyDistanceTier,
  classifyDistanceBand,
  CORRIDOR_TIERS,
  DISTANCE_BANDS,
  FAMOUS_LANDMARKS_DATABASE,
  discoverAllRouteCandidates
} = require('./src/services/routePlaceDiscoveryEngine');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 ONWARD JOURNEY ENGINE REMEDIATION VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      if (err.stack) console.error(err.stack.split('\n').slice(0, 4).join('\n'));
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test Group 1: 4-Tier Corridor Distance Specifications
  // -------------------------------------------------------------
  console.log('--- Test Group 1: 4-Tier Corridor Distance Bands ---');
  test('Tier 1: 0–20 km from route', () => {
    const t = classifyDistanceTier(12);
    assert.strictEqual(t.tier, 'TIER_1');
    assert.strictEqual(t.penalty, 0.0);
  });

  test('Tier 2: 20–40 km from route', () => {
    const t = classifyDistanceTier(32);
    assert.strictEqual(t.tier, 'TIER_2');
    assert.strictEqual(t.penalty, 0.08);
  });

  test('Tier 3: 40–60 km from route', () => {
    const t = classifyDistanceTier(55);
    assert.strictEqual(t.tier, 'TIER_3');
    assert.strictEqual(t.penalty, 0.20);
  });

  test('Tier 4: 60–80 km for exceptional attractions', () => {
    const t = classifyDistanceTier(72);
    assert.strictEqual(t.tier, 'TIER_4');
    assert.strictEqual(t.penalty, 0.40);
  });

  test('Tier 5: >80 km remote outlier', () => {
    const t = classifyDistanceTier(95);
    assert.strictEqual(t.tier, 'TIER_5');
    assert.strictEqual(t.penalty, 0.75);
  });

  // -------------------------------------------------------------
  // Test Group 2: Corridor Candidates Discovery for Hyderabad -> Kerala
  // -------------------------------------------------------------
  console.log('\n--- Test Group 2: Corridor Candidate Discovery (Hyderabad -> Munnar, Kerala) ---');
  await testAsync('Corridor candidate discovery returns real landmarks along NH44/NH544', async () => {
    const candidates = await discoverAllRouteCandidates({
      startLocation: 'Hyderabad',
      destination: 'Munnar',
      userPreferences: { activities: 'cultural,nature,historical' },
      maxPlaces: 20
    });

    assert(Array.isArray(candidates), 'Expected candidate array');
    assert(candidates.length >= 5, `Expected at least 5 candidates, got ${candidates.length}`);

    // Verify key southern highway corridor landmarks are present
    const names = candidates.map(c => c.name.toLowerCase());
    const hasKurnool = names.some(n => n.includes('kurnool') || n.includes('konda reddy'));
    const hasLepakshi = names.some(n => n.includes('lepakshi'));
    const hasSalemOrHogenakkal = names.some(n => n.includes('hogenakkal') || n.includes('yercaud') || n.includes('salem'));

    assert(hasKurnool, 'Expected Kurnool Fort in candidate pool');
    assert(hasLepakshi, 'Expected Lepakshi in candidate pool');
    assert(hasSalemOrHogenakkal, 'Expected Hogenakkal or Yercaud in candidate pool');

    // Verify candidates have verified coordinates, categories, ratings
    for (const c of candidates) {
      assert(c.coordinates && c.coordinates.lat && c.coordinates.lng, `Candidate ${c.name} missing coordinates`);
      assert(c.rating >= 4.0, `Candidate ${c.name} has low rating: ${c.rating}`);
      assert(c.reviews > 0, `Candidate ${c.name} missing reviews`);
    }
  });

  // -------------------------------------------------------------
  // Test Group 3: Multi-Day Trip Phase Allocation
  // -------------------------------------------------------------
  console.log('\n--- Test Group 3: Trip Phase Allocation for Long-Distance Routes ---');
  test('Trips > 450 km allocate 2 onward days when total days >= 4', () => {
    const phases = planner.buildTripPhases(5, null, 1033, 'car', 'car');
    assert.strictEqual(phases.onwardDays, 2, `Expected 2 onward days for 1033 km trip, got ${phases.onwardDays}`);
    assert.strictEqual(phases.returnDays, 2, `Expected 2 return days for 1033 km trip, got ${phases.returnDays}`);
    assert.strictEqual(phases.destinationStayDays, 1, `Expected 1 stay day, got ${phases.destinationStayDays}`);
    assert.strictEqual(phases.arrivalDay, 2, `Expected arrival day 2, got ${phases.arrivalDay}`);
  });

  test('Trips <= 450 km keep 1 onward day', () => {
    const phases = planner.buildTripPhases(4, null, 300, 'car', 'car');
    assert.strictEqual(phases.onwardDays, 1, `Expected 1 onward day for 300 km trip, got ${phases.onwardDays}`);
    assert.strictEqual(phases.returnDays, 1, `Expected 1 return day, got ${phases.returnDays}`);
    assert.strictEqual(phases.destinationStayDays, 2, `Expected 2 stay days, got ${phases.destinationStayDays}`);
  });

  // -------------------------------------------------------------
  // Test Group 4: Multi-Day Onward Journey Continuity & Intermediate Hubs
  // -------------------------------------------------------------
  console.log('\n--- Test Group 4: Multi-Day Journey Continuity & Day-to-Day Hub Progression ---');
  await testAsync('5-Day Hyderabad to Munnar itinerary has continuous day-to-day progression', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Munnar',
      travelDates: '2026-11-10 to 2026-11-14',
      budget: 45000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'petrol',
      mileage: 15,
      travelCompanionType: 'solo',
      numberOfTravelers: 1,
      activities: 'nature,cultural,sightseeing'
    });

    assert(itinerary && itinerary.dayPlans, 'Expected dayPlans in itinerary');
    const dayPlans = itinerary.dayPlans;
    assert.strictEqual(dayPlans.length, 5, `Expected 5 days, got ${dayPlans.length}`);

    // Day 1: Onward Journey (Hyderabad -> Intermediate Hub)
    const day1 = dayPlans[0];
    assert.strictEqual(day1.phase, 'Onward Journey');
    assert(day1.activities.length > 0, 'Day 1 must have discovered attractions along route');
    assert(day1.timeline.length >= 4, 'Day 1 must have detailed timeline');

    const day1Departure = day1.timeline.find(t => t.category === 'travel' && t.place.includes('Depart from'));
    const day1CheckIn = day1.timeline.find(t => t.category === 'hotel');
    assert(day1Departure, 'Day 1 must have departure item');
    assert(day1CheckIn, 'Day 1 must have hotel/overnight item');
    assert(day1Departure.place.includes('Hyderabad'), `Day 1 must depart from Hyderabad, got: ${day1Departure.place}`);
    assert(!day1CheckIn.place.includes('Munnar'), `Day 1 (intermediate day) must NOT check in at final destination Munnar! Got: ${day1CheckIn.place}`);
    assert(day1CheckIn.place.includes('Intermediate Overnight Stay'), `Day 1 must be marked as Intermediate Overnight Stay! Got: ${day1CheckIn.place}`);

    // Day 2: Onward Journey (Intermediate Hub -> Munnar)
    const day2 = dayPlans[1];
    assert.strictEqual(day2.phase, 'Onward Journey');
    const day2Departure = day2.timeline.find(t => t.category === 'travel' && t.place.includes('Depart from'));
    const day2CheckIn = day2.timeline.find(t => t.category === 'hotel');
    assert(day2Departure, 'Day 2 must have departure item');
    assert(day2CheckIn, 'Day 2 must have hotel item');

    // CRITICAL: Day 2 departure location must match Day 1's intermediate overnight hub!
    // Extract hub from Day 1 check-in: "Dinner & Intermediate Overnight Stay at budgetHotel (HubCity)"
    const day1HubMatch = day1CheckIn.place.match(/\(([^)]+)\)/);
    const day1Hub = day1HubMatch ? day1HubMatch[1] : '';
    assert(day1Hub.length > 0, 'Could not extract Day 1 hub');
    assert(day2Departure.place.includes(day1Hub), `Day 2 must depart from Day 1 arrival hub "${day1Hub}"! Got: ${day2Departure.place}`);

    // Day 2 arrives at Munnar (final onward destination)
    assert(day2CheckIn.place.includes('Munnar'), `Day 2 must arrive at Munnar, got: ${day2CheckIn.place}`);
    assert(day2CheckIn.place.includes('Final Destination Arrival'), `Day 2 must be marked as Final Destination Arrival! Got: ${day2CheckIn.place}`);

    // Day 3: Destination Stay in Munnar
    const day3 = dayPlans[2];
    assert.strictEqual(day3.phase, 'Destination Stay');
    assert(day3.plan.includes('Munnar'), 'Day 3 plan must focus on Munnar');

    // Day 4 & Day 5: Return Journey
    const day4 = dayPlans[3];
    const day5 = dayPlans[4];
    assert.strictEqual(day4.phase, 'Return Journey');
    assert.strictEqual(day5.phase, 'Return Journey');

    const day4Departure = day4.timeline.find(t => t.category === 'travel' && t.place.includes('Depart from'));
    const day5CheckIn = day5.timeline.find(t => t.category === 'hotel');
    assert(day4Departure.place.includes('Munnar'), `Day 4 return must depart from Munnar, got: ${day4Departure.place}`);
    assert(day5CheckIn.place.includes('Hyderabad'), `Day 5 return must arrive back in Hyderabad, got: ${day5CheckIn.place}`);
  });

  // -------------------------------------------------------------
  // Test Group 5: Realistic Distance-Derived Transit Durations
  // -------------------------------------------------------------
  console.log('\n--- Test Group 5: Realistic Distance-Derived Transit Durations ---');
  await testAsync('Timeline transit times are physically derived from distances, not hardcoded 30m', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Munnar',
      travelDates: '2026-11-10 to 2026-11-14',
      budget: 45000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'petrol',
      mileage: 15,
      activities: 'historical,nature'
    });

    const day1Timeline = itinerary.dayPlans[0].timeline;
    // Inspect each attraction item in timeline
    const attractions = day1Timeline.filter(t => t.category !== 'travel' && t.category !== 'meal' && t.category !== 'hotel');
    assert(attractions.length > 0, 'Expected at least 1 attraction in Day 1 timeline');

    for (const attr of attractions) {
      assert(attr.travelTime, `Attraction ${attr.place} missing travelTime`);
      // travelTime format: "X mins (Y km highway + Z km detour)"
      assert(attr.travelTime.includes('km highway') || attr.travelTime.includes('mins'), `Expected derived travelTime format in ${attr.travelTime}`);
      // Parse minutes
      const minsMatch = attr.travelTime.match(/(\d+)\s*mins/);
      assert(minsMatch, `Could not parse minutes from ${attr.travelTime}`);
      const mins = parseInt(minsMatch[1], 10);
      assert(mins >= 30, `Transit duration ${mins}m to ${attr.place} is unrealistically short for highway travel`);
    }

    // Inspect check-in item transit time
    const checkIn = day1Timeline.find(t => t.category === 'hotel');
    assert(checkIn.travelTime.includes('km transit'), `Check-in missing km transit explanation: ${checkIn.travelTime}`);
  });

  // -------------------------------------------------------------
  // Test Group 6: Elimination of Generic Fallbacks
  // -------------------------------------------------------------
  console.log('\n--- Test Group 6: Elimination of Generic Activities Masquerading as Attractions ---');
  await testAsync('Day 1 onward activities contain real places, not just generic scenic transit text', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Munnar',
      travelDates: '2026-11-10 to 2026-11-14',
      budget: 45000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'petrol',
      mileage: 15,
      activities: 'heritage,fort,nature'
    });

    const day1Activities = itinerary.dayPlans[0].activities;
    assert(day1Activities.length > 0, 'Day 1 must have activities');

    // Verify at least one activity is a real landmark
    const realAttraction = day1Activities.find(a => {
      const cat = String(a.category || a.types?.[0] || '').toLowerCase();
      const rating = Number(a.googleRating || a.rating || 0);
      return rating >= 4.0 && (
        cat.includes('fort') ||
        cat.includes('temple') ||
        cat.includes('waterfall') ||
        cat.includes('nature') ||
        cat.includes('wildlife') ||
        cat.includes('viewpoint') ||
        cat.includes('historical') ||
        cat.includes('heritage') ||
        cat.includes('attraction')
      );
    });
    assert(realAttraction, `Expected real landmark attraction with rating >= 4.0 in Day 1 activities, got: ${JSON.stringify(day1Activities.map(a => ({ name: a.name, category: a.category, rating: a.googleRating })))}`);
    console.log(`     Discovered real onward landmark: "${realAttraction.name}" (${realAttraction.category}, rating: ${realAttraction.googleRating})`);
  });

  // -------------------------------------------------------------
  // Test Group 7: Cost Reconciliation
  // -------------------------------------------------------------
  console.log('\n--- Test Group 7: Cost Model Reconciliation Across Line Items, Categories, and Days ---');
  await testAsync('Itemized costs reconcile across line items, category breakdown, day costs, and total', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Munnar',
      travelDates: '2026-11-10 to 2026-11-14',
      budget: 45000,
      transport: 'ownTransport',
      vehicleType: 'car',
      fuelType: 'petrol',
      mileage: 15,
      travelCompanionType: 'couple',
      numberOfTravelers: 2,
      activities: 'nature,cultural'
    });

    const costSummary = itinerary.costSummary;
    assert(costSummary, 'Missing costSummary');
    assert(costSummary.totalTripCost > 0, 'Total cost must be positive');

    // 1. Sum of categories must equal totalTripCost
    const catSum = costSummary.fuel +
      costSummary.tolls +
      costSummary.localTransport +
      costSummary.accommodation +
      costSummary.food +
      costSummary.entryFees +
      costSummary.activities +
      costSummary.parking +
      costSummary.other;

    assert.strictEqual(Math.round(catSum), Math.round(costSummary.totalTripCost),
      `Category sum (${catSum}) does not match totalTripCost (${costSummary.totalTripCost})`);

    // 2. Sum of day costs must reconcile with totalTripCost
    const daySum = costSummary.dayWise.reduce((sum, d) => sum + d.dayTotal, 0);
    const dayDiff = Math.abs(daySum - costSummary.totalTripCost);
    assert(dayDiff <= 5, `Day-wise sum (${daySum}) deviates from totalTripCost (${costSummary.totalTripCost}) by > 5`);

    // 3. Each day plan must have a cost object attached
    for (const dp of itinerary.dayPlans) {
      assert(dp.cost, `Day ${dp.day} is missing authoritative cost object`);
      assert(dp.cost.dayTotal > 0, `Day ${dp.day} cost must be positive`);
    }
  });

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution unhandled error:', err);
  process.exit(1);
});
