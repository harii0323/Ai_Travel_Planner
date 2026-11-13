const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const planner = require('./src/services/planner');

async function run() {
  console.log('Testing planner with Nalgonda to Kanniyakumari...\n');
  const input = {
    startLocation: 'Nalgonda',
    destination: 'Kanniyakumari',
    travelDates: '2026-11-10 to 2026-11-14',
    budget: 35000,
    transport: 'ownTransport',
    vehicleType: 'car',
    fuelType: 'petrol',
    mileage: 15,
    travelCompanionType: 'family',
    numberOfTravelers: 2,
    activities: 'culture,nature,beach,heritage'
  };

  try {
    const result = await planner.generateItinerary(input);
    assert.strictEqual(result.success, true, 'Planner should return success: true');
    console.log('Trip Overview:', {
      startLocation: result.tripOverview?.startLocation,
      destination: result.tripOverview?.destination,
      totalDistance: `${result.tripOverview?.totalDistance} km`,
      numDays: result.tripOverview?.numDays,
      travelers: result.tripOverview?.numTravelers
    });

    assert.ok(result.tripOverview.totalDistance >= 1100, `Expected realistic road distance >= 1100 km, got ${result.tripOverview.totalDistance}`);
    assert.strictEqual(result.dayPlans.length, 5, `Expected 5 days, got ${result.dayPlans.length}`);

    // Verify phases for 1,300 km long-distance route
    assert.strictEqual(result.dayPlans[0].phase, 'Onward Journey', 'Day 1 should be Onward Journey');
    assert.strictEqual(result.dayPlans[1].phase, 'Onward Journey', 'Day 2 should be Onward Journey');
    assert.strictEqual(result.dayPlans[2].phase, 'Destination Stay', 'Day 3 should be Destination Stay');
    assert.strictEqual(result.dayPlans[3].phase, 'Return Journey', 'Day 4 should be Return Journey');
    assert.strictEqual(result.dayPlans[4].phase, 'Return Journey', 'Day 5 should be Return Journey');

    // Verify Day 3 in Kanniyakumari features authentic attractions
    const day3Stops = result.dayPlans[2].stops || [];
    assert.ok(day3Stops.length >= 2, `Day 3 must feature at least 2 attractions in Kanniyakumari, got ${day3Stops.length}`);
    console.log('\nDay 3 Kanniyakumari Attractions:', day3Stops.map(s => s.name || s.placeName));

    if (result.dayPlans) {
      result.dayPlans.forEach((dp) => {
        console.log(`\n--- Day ${dp.day} (${dp.phase}): ${dp.startLocation} → ${dp.endLocation} ---`);
        console.log(`Activities count: ${dp.activities?.length || dp.stops?.length || 0}`);
        if (dp.timeline) {
          console.log(`Timeline items (${dp.timeline.length}):`);
          dp.timeline.forEach(t => {
            console.log(`  [${t.time}] ${t.category}: ${t.place} (${t.travelTime || 'no transit'})`);
          });
        }
      });
    }

    console.log('\nBudget breakdown:', result.budgetBreakdown);
    console.log('\nFeasibility isFeasible:', result.feasibilityAnalysis?.isFeasible);
    console.log('Feasibility Score:', result.feasibilityAnalysis?.feasibilityScore);
    if (result.feasibilityAnalysis?.checks) {
      console.log('Checks:');
      result.feasibilityAnalysis.checks.forEach(c => {
        console.log(`  - [${c.passed ? 'PASS' : 'WARN'}] ${c.name}: ${c.details}`);
      });
    }
    if (result.feasibilityAnalysis?.warnings?.length > 0) {
      console.log('Warnings:', result.feasibilityAnalysis.warnings);
    }
    if (result.feasibilityAnalysis?.actionableRecommendations?.length > 0) {
      console.log('Recommendations:', result.feasibilityAnalysis.actionableRecommendations);
    }

    console.log('\n✅ All Nalgonda to Kanniyakumari integration assertions passed successfully!');
  } catch (err) {
    console.error('💥 Test assertion or runtime failure:', err);
    process.exit(1);
  }
}

run();
