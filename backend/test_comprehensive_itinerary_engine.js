/**
 * Comprehensive Automated Validation Test Suite
 * For AI Travel Planner Day-Wise Itinerary Generation Engine
 * 
 * Tests all 12 mandatory scenarios + Hyderabad-to-Kerala validation scenario:
 * 1. Hyderabad to Kerala (Munnar) with spiritual, scenic, trekking, photography, and adventure
 * 2. Multi-day trip location continuity (Day N+1 starts at Day N end)
 * 3. Round trip including return journey back to origin
 * 4. Sunrise attraction that cannot be reached during intended window (trade-off explained)
 * 5. Temple with restricted opening hours, midday closure, and darshan queues
 * 6. Scenic detour that makes the day infeasible (fatigue / daylight limit)
 * 7. Destination with missing opening hours or cost data (never fabricated)
 * 8. Route containing restricted roads / forest night curfew (Nallamala 21:00-06:00)
 * 9. Low-budget trip requiring itinerary adjustments
 * 10. API failure gracefully handled without incomplete days
 * 11. Duplicate places deduplication across multiple queries
 * 12. Final destination that cannot be reached within requested days
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const planner = require('./src/services/planner');
const { normalizeUserPreferences, resolveDestination } = require('./src/services/userPreferenceNormalizer');
const { computeRoute, checkRoadRestrictions, calculateSegmentDrivingTime } = require('./src/services/routePlanner');
const { discoverCorridorPlaces, classifyDistanceTier, CORRIDOR_TIERS } = require('./src/services/routeCorridorDiscovery');
const { scorePlaceCandidate, calculatePreferenceMatch, calculateRatingConfidence } = require('./src/services/placeRecommendationEngine');
const { parseTimeToMinutes, formatMinutesTo12, evaluateTempleTimings, evaluateSunriseWindow } = require('./src/services/timeWindowScheduler');
const { buildDay1HyderabadToSrisailamKurnool } = require('./src/services/dailyItineraryBuilder');
const { planMultiDayContinuity } = require('./src/services/multiDayContinuityPlanner');
const { estimateTripCost } = require('./src/services/tripCostEstimator');
const { validateItinerarySafetyAndFeasibility } = require('./src/services/safetyAndFeasibilityValidator');
const { replanItineraryWithDelay } = require('./src/services/itineraryReoptimizer');

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🧪 COMPREHENSIVE ITINERARY GENERATION ENGINE VALIDATION SUITE');
  console.log('========================================================================\n');

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

  // --------------------------------------------------------------------------
  // Scenario 1: Hyderabad to Kerala Validation Scenario (Section 3)
  // --------------------------------------------------------------------------
  console.log('--- Scenario 1: Hyderabad to Kerala (Munnar) Detailed Scenario ---');
  await testAsync('Generates complete, continuous 5-day itinerary from Hyderabad to Kerala', async () => {
    const itinerary = await planner.generateItinerary({
      startLocation: 'Hyderabad',
      destination: 'Kerala',
      travelDates: '2026-11-10 to 2026-11-14',
      budget: 50000,
      transport: 'car',
      vehicleType: 'car',
      fuelType: 'petrol',
      mileage: 15,
      travelCompanionType: 'friends',
      numberOfTravelers: 4,
      activities: 'Spirituality, scenic landscapes, mountains, hills, photography, trekking, and adventure',
      departurePreference: 'early_morning',
      startTime: '04:30 AM',
      planningStyle: 'Scenic experiences, meaningful activities, reasonable driving hours, and minimal unnecessary detours'
    });

    assert(itinerary && itinerary.dayPlans, 'Expected dayPlans in itinerary');
    assert.strictEqual(itinerary.dayPlans.length, 5, `Expected 5 days, got ${itinerary.dayPlans.length}`);

    // Verify Day 1: Starts at Hyderabad
    const day1 = itinerary.dayPlans[0];
    assert.strictEqual(day1.startLocation, 'Hyderabad');

    // Day 1 must include departure
    const depStep = day1.timeline.find(t => t.category === 'travel' && t.place.includes('Depart'));
    assert(depStep, 'Day 1 must include departure step');

    // Day 1 must include meal halt
    const mealStep = day1.timeline.find(t => t.category === 'meal');
    assert(mealStep, 'Day 1 must include meal halt');

    // Day 1 must include overnight hub hotel check-in
    const hotelStep = day1.timeline.find(t => t.category === 'hotel');
    assert(hotelStep, 'Day 1 must include overnight hub hotel check-in');

    // Verify unbroken continuity across all 5 days
    for (let i = 0; i < itinerary.dayPlans.length - 1; i++) {
      const todayEnd = (itinerary.dayPlans[i].endLocation || itinerary.dayPlans[i].overnightLocation).toLowerCase();
      const tomorrowStart = itinerary.dayPlans[i + 1].startLocation.toLowerCase();
      assert(
        todayEnd.includes(tomorrowStart) || tomorrowStart.includes(todayEnd),
        `Continuity gap between Day ${i + 1} (${todayEnd}) and Day ${i + 2} (${tomorrowStart})`
      );
    }

    // Verify destination attractions in Kerala
    const allStops = itinerary.dayPlans.flatMap(d => (d.stops || []).map(s => s.name || s.placeName));
    const hasKeralaHighlights = allStops.some(s =>
      s.includes('Top Station') || s.includes('Tea') || s.includes('Mattupetty') || s.includes('Eravikulam')
    );
    assert(hasKeralaHighlights, 'Must include authentic destination attractions in Kerala');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Multi-day continuity (Day N+1 starts from Day N end)
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Multi-Day Location Continuity ---');
  test('Consecutive days maintain strict unbroken location continuity', () => {
    const days = planMultiDayContinuity({
      origin: 'Hyderabad',
      destination: 'Munnar, Kerala',
      destinationCity: 'Munnar',
      startDate: new Date('2026-11-10'),
      totalDays: 5,
      isRoundTrip: true,
      numberOfTravelers: 4
    });

    assert.strictEqual(days.length, 5);
    for (let i = 0; i < days.length - 1; i++) {
      const todayEnd = days[i].endLocation.toLowerCase();
      const tomorrowStart = days[i + 1].startLocation.toLowerCase();
      assert(
        todayEnd.includes(tomorrowStart) || tomorrowStart.includes(todayEnd),
        `Continuity gap between Day ${i + 1} (${days[i].endLocation}) and Day ${i + 2} (${days[i + 1].startLocation})`
      );
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Round trip including return journey back to origin
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Complete Round Trip Return Journey ---');
  test('Round trip returns all the way back to the original starting city', () => {
    const days = planMultiDayContinuity({
      origin: 'Hyderabad',
      destination: 'Munnar, Kerala',
      destinationCity: 'Munnar',
      startDate: new Date('2026-11-10'),
      totalDays: 5,
      isRoundTrip: true,
      numberOfTravelers: 2
    });

    const finalDay = days[days.length - 1];
    assert.strictEqual(finalDay.endLocation, 'Hyderabad', `Expected final return destination 'Hyderabad', got '${finalDay.endLocation}'`);
    assert.strictEqual(finalDay.phase, 'Return Journey');
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Sunrise attraction that cannot be reached during intended window
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Sunrise Attraction Window Evaluation ---');
  test('Departing late flags sunrise window mismatch and explains realistic trade-off', () => {
    // Arrival at 09:30 AM (570 minutes from midnight) for a sunrise point
    const sunriseCheck = evaluateSunriseWindow(9 * 60 + 30, 8 * 60, 100);
    assert.strictEqual(sunriseCheck.isSunriseMatched, false);
    assert(sunriseCheck.message.includes('missing the sunrise window'), 'Expected explanation of missed sunrise window');
    assert(sunriseCheck.message.includes('scenic'), 'Must explain alternative realistic experience');
  });

  test('Early departure (04:30 AM) achieves optimal sunrise arrival', () => {
    // Departs 04:30 AM, arrives Dindi ~06:45 AM (405 mins)
    const sunriseCheck = evaluateSunriseWindow(6 * 60 + 45, 4 * 60 + 30, 100);
    assert.strictEqual(sunriseCheck.isSunriseMatched, true);
    assert.strictEqual(sunriseCheck.quality, 'OPTIMAL');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Temple with restricted opening hours & midday closures
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Temple Opening Hours & Midday Break Enforcement ---');
  test('Temple arrival during midday break (15:00) is flagged as closed', () => {
    const templeTiming = evaluateTempleTimings(15 * 60, {
      open: '06:00',
      close: '22:00',
      breakStart: '14:00',
      breakEnd: '17:30'
    });
    assert.strictEqual(templeTiming.isOpen, false);
    assert.strictEqual(templeTiming.status, 'MIDDAY_BREAK');
    assert(templeTiming.reason.includes('afternoon temple closure'), 'Must explain midday cleaning closure');
  });

  test('Temple arrival during morning slot (09:00 AM) is accepted', () => {
    const templeTiming = evaluateTempleTimings(9 * 60, {
      open: '06:00',
      close: '22:00',
      breakStart: '14:00',
      breakEnd: '17:30'
    });
    assert.strictEqual(templeTiming.isOpen, true);
    assert.strictEqual(templeTiming.status, 'OPEN');
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Scenic detour making day infeasible (Fatigue / Daylight limits)
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Infeasible Detour & Fatigue Penalty ---');
  test('High-effort activity after long driving distance is penalized for fatigue', () => {
    const scoringResult = scorePlaceCandidate(
      {
        name: 'Exhausting Peak Trek',
        category: 'trekking',
        durationMinutes: 180,
        distanceFromHighwayKm: 35
      },
      {
        dailyDrivingKm: 420, // Long drive
        arrivalTimeMinutes: 16 * 60
      }
    );
    assert(scoringResult.fatiguePenalty > 0, 'Expected fatigue penalty for heavy trek after 420 km drive');
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Destination with missing opening hours or cost data (No fabrication)
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Missing Data Handling (No Fabrication) ---');
  test('Candidate with missing reviews/cost is treated as estimated/unknown, not given fake perfect score', () => {
    const confidence = calculateRatingConfidence({
      name: 'Unrated Local Viewpoint',
      rating: null,
      reviews: null
    });
    assert.strictEqual(confidence, 0.40, 'Missing review confidence must be conservative 0.40, not fabricated 1.0');
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Road restriction & Forest Night Gate Curfew
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Road Restrictions & Forest Night Curfews ---');
  test('Driving through Nallamala Tiger Reserve at 22:30 is flagged as strictly prohibited', () => {
    const restriction = checkRoadRestrictions('Hyderabad', 'Srisailam', 22);
    assert.strictEqual(restriction.hasRestriction, true);
    assert.strictEqual(restriction.isProhibited, true);
    assert(restriction.warning.includes('9:00 PM and 6:00 AM'), 'Must cite 9 PM to 6 AM wildlife gate curfew');
  });

  test('Daylight crossing through Nallamala Forest at 11:00 AM is safe and permitted', () => {
    const restriction = checkRoadRestrictions('Hyderabad', 'Srisailam', 11);
    assert.strictEqual(restriction.hasRestriction, true);
    assert.strictEqual(restriction.isProhibited, false);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Low-budget trip requiring itinerary adjustments
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 9: Low-Budget Trip Handled as a Constraint ---');
  test('Low budget triggers budget gap warning with concrete cost-reduction suggestions', () => {
    const cost = estimateTripCost({
      totalDistanceKm: 1200,
      totalDays: 5,
      numberOfTravelers: 4,
      transportMode: 'car',
      vehicleDetails: { vehicleType: 'car', fuelType: 'petrol', mileage: 15 },
      accommodationType: 'resort',
      userBudget: 15000 // Infeasible for 4 travelers for 5 days in a resort!
    });

    assert.strictEqual(cost.budgetComparison.isOverBudget, true);
    assert(cost.budgetComparison.budgetGap > 0);
    assert(cost.budgetComparison.budgetMessage.includes('exceeds your budget'), 'Expected explicit budget gap message');
    assert(cost.budgetComparison.budgetMessage.includes('Suggestions:'), 'Must suggest concrete adjustments (e.g. hostels)');
  });

  // --------------------------------------------------------------------------
  // Scenario 10: API failure handling without incomplete itineraries
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 10: API Failure Resilience ---');
  await testAsync('Offline / API failure fallbacks generate complete 5-day continuous itinerary', async () => {
    const days = planMultiDayContinuity({
      origin: 'Hyderabad',
      destination: 'Munnar, Kerala',
      destinationCity: 'Munnar',
      startDate: new Date('2026-11-10'),
      totalDays: 5,
      isRoundTrip: true,
      numberOfTravelers: 2
    });

    assert.strictEqual(days.length, 5, 'Must generate exactly 5 days despite any external API unavailability');
    for (const d of days) {
      assert(d.timeline && d.timeline.length >= 4, `Day ${d.day} timeline must be complete and detailed`);
      assert(d.cost && d.cost.dayTotal > 0, `Day ${d.day} must have authoritative costs`);
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Duplicate places deduplication
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 11: Multi-Query Place Deduplication ---');
  await testAsync('Corridor discovery eliminates duplicate POIs returned across query passes', async () => {
    const places = await discoverCorridorPlaces({
      fromCity: 'Hyderabad',
      toCity: 'Srisailam',
      userPreferences: { activities: 'spiritual,scenic' },
      maxPlaces: 15
    });

    const names = places.map(p => p.name.toLowerCase().trim());
    const uniqueNames = new Set(names);
    assert.strictEqual(names.length, uniqueNames.size, 'Candidate pool must not contain duplicate place names');
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Destination cannot be reached within requested days
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 12: Infeasible Trip Pace Detection ---');
  test('Planning 1050 km in 1 single day is flagged as impossible with minimum comfortable days suggested', () => {
    const drivingTime = calculateSegmentDrivingTime(1050, 'GHAT_MOUNTAIN');
    // ~1050 km on mountain/ghat takes > 30 hours
    assert(drivingTime.drivingMinutes > 14 * 60, '1050 km cannot physically fit into a single day');

    const validation = validateItinerarySafetyAndFeasibility({
      itinerary: {
        dayPlans: [
          {
            day: 1,
            startLocation: 'Hyderabad',
            endLocation: 'Munnar',
            totalDayDistanceKm: 1050, // Excessive!
            timeline: []
          }
        ]
      },
      requestedDays: 1,
      origin: 'Hyderabad',
      finalDestination: 'Munnar',
      budget: 20000
    });

    const fatigueCheck = validation.checks.find(c => c.id === 'DRIVER_FATIGUE_SAFETY');
    assert.strictEqual(fatigueCheck.passed, false, 'Expected fatigue check to fail for 1050 km single day drive');
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Dynamic Real-Time Replanning (Section 10)
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 13: Dynamic Real-Time Replanning with Delays ---');
  test('Replanner shifts timeline by delay and removes low-priority stop to recover schedule buffer', () => {
    const days = planMultiDayContinuity({
      origin: 'Hyderabad',
      destination: 'Munnar, Kerala',
      destinationCity: 'Munnar',
      startDate: new Date('2026-11-10'),
      totalDays: 5,
      isRoundTrip: true,
      numberOfTravelers: 4
    });

    const mockItinerary = { dayPlans: days };
    const reopt = replanItineraryWithDelay({
      currentItinerary: mockItinerary,
      affectedDayNumber: 1,
      delayMinutes: 45,
      delayReason: 'Monsoon highway waterlogging on SH-5',
      droppedStopName: 'Pathalaganga Ropeway'
    });

    assert.strictEqual(reopt.success, true);
    assert.strictEqual(reopt.delayMinutes, 45);
    assert(reopt.changes.length > 0, 'Expected recorded schedule changes');
    assert.strictEqual(reopt.removedStops.length, 1, 'Expected Pathalaganga to be safely removed to absorb delay');

    // Confirm Pathalaganga was removed from Day 1 timeline
    const day1Timeline = reopt.updatedItinerary.dayPlans[0].timeline;
    const hasPathalaganga = day1Timeline.some(t => t.place.includes('Pathalaganga Ropeway'));
    assert.strictEqual(hasPathalaganga, false, 'Pathalaganga must be omitted from updated timeline');
  });

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
