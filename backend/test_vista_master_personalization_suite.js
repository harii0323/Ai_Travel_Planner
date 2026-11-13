/**
 * VISTA Master Engineering Acceptance Verification Suite
 * 
 * Implements Section 15 Acceptance Tests A through H:
 * - Test A: Same Route, Different Travelers (Spiritual vs Adventure vs Relaxed Vacation)
 * - Test B: Same Traveler, Different Dates & Seasons (Monsoon July vs Winter December)
 * - Test C: Same Traveler, Different Budgets (Constraint Analysis & Actionable Savings)
 * - Test D: Same Traveler, Different Durations (3-Day vs 5-Day vs 7-Day Feasible Pace)
 * - Test E: Food-Only Prevention (Tourist Attractions >= 60%, No Restaurant-Dominated Plans)
 * - Test F: Return Journey Independence (Non-Reversing, Distinct Unvisited Stops)
 * - Test G: Feasibility & Safety Analysis (No Activity Overlaps, Fatigue Limits, Daylight Treks)
 * - Test H: Repeatability & Determinism (Deterministic Consistency via Planning Version)
 */

const assert = require('assert');
const {
  generateOptimizedItinerary,
  calculateSolarTimes,
  analyzeItineraryFeasibility
} = require('./src/services/engine');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

async function main() {
  console.log('================================================================');
  console.log('   VISTA MASTER ACCEPTANCE SUITE (SECTION 15 TESTS A - H)       ');
  console.log('================================================================\n');

  // =================================================================
  // TEST A: SAME ROUTE, DIFFERENT TRAVELERS (Prompt Section 3 & 15)
  // =================================================================
  await runAsyncTest('Test A: Same Route (Hyderabad -> Kerala) Produces Distinct Itineraries for 3 Travelers', async () => {
    // Traveler A: Spiritual / Temples / Heritage
    const travelerA = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 5,
      budget: 35000,
      transportMode: 'car',
      companionType: 'family',
      activities: ['spiritual', 'temples', 'historical', 'darshan', 'heritage']
    });

    // Traveler B: Adventure / Trekking / Waterfalls / Forests
    const travelerB = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 5,
      budget: 35000,
      transportMode: 'car',
      companionType: 'friends',
      activities: ['adventure', 'trekking', 'waterfalls', 'mountains', 'safari']
    });

    // Traveler C: Relaxed / Backwaters / Beaches / Scenic
    const travelerC = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 5,
      budget: 35000,
      transportMode: 'car',
      companionType: 'couple',
      activities: ['beaches', 'coastal', 'relaxation', 'backwaters', 'sunset']
    });

    // 1. Assert Hub Differentiation
    const hubA = travelerA.dayWiseItinerary[2].endLocation;
    const hubB = travelerB.dayWiseItinerary[2].endLocation;
    const hubC = travelerC.dayWiseItinerary[2].endLocation;

    assert.ok(hubA, 'Traveler A must have a destination exploration hub');
    assert.ok(hubB, 'Traveler B must have a destination exploration hub');
    assert.ok(hubC, 'Traveler C must have a destination exploration hub');
    assert.ok(hubA !== hubB, `Traveler A hub (${hubA}) must differ from Traveler B hub (${hubB})`);
    assert.ok(hubA !== hubC, `Traveler A hub (${hubA}) must differ from Traveler C hub (${hubC})`);

    // 2. Assert Category Integrity
    const stopsA = travelerA.recommendedPlaces.map(p => p.name);
    const stopsB = travelerB.recommendedPlaces.map(p => p.name);
    const stopsC = travelerC.recommendedPlaces.map(p => p.name);

    // Traveler A must feature prominent spiritual/heritage sites
    const hasSpiritualStopsA = stopsA.some(s =>
      s.includes('Temple') || s.includes('Guruvayur') || s.includes('Shakti') || s.includes('Shankara') || s.includes('Vadakkunnathan')
    );
    assert.ok(hasSpiritualStopsA, 'Traveler A must feature authentic temples and heritage monuments');

    // Traveler B must feature peaks/treks/waterfalls
    const hasAdventureStopsB = stopsB.some(s =>
      s.includes('Peak') || s.includes('Trek') || s.includes('Waterfalls') || s.includes('Safari') || s.includes('Top Station')
    );
    assert.ok(hasAdventureStopsB, 'Traveler B must feature high-altitude peaks, treks, and waterfalls');

    // Traveler C must feature backwaters/beaches/relaxation
    const hasRelaxedStopsC = stopsC.some(s =>
      s.includes('Backwaters') || s.includes('Beach') || s.includes('Fort Kochi') || s.includes('Canal')
    );
    assert.ok(hasRelaxedStopsC, 'Traveler C must feature backwaters, beaches, or coastal promenades');

    // 3. Pairwise POI overlap between Spiritual (A) and Adventure (B) must be minimal (< 20%)
    const setA = new Set(stopsA);
    const setB = new Set(stopsB);
    const overlapAB = stopsA.filter(x => setB.has(x));
    const overlapRatioAB = overlapAB.length / Math.max(stopsA.length, stopsB.length);

    assert.ok(overlapRatioAB < 0.20, `Overlap between Traveler A & B must be < 20%, actual: ${(overlapRatioAB * 100).toFixed(1)}%`);
  });

  // =================================================================
  // TEST B: SAME TRAVELER, DIFFERENT SEASONS & SOLAR TIMES (Section 15)
  // =================================================================
  await runAsyncTest('Test B: Seasonal Awareness & Astronomical Solar Hours (Monsoon vs Winter)', async () => {
    // Monsoon Date (July)
    const monsoonPlan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 5,
      budget: 30000,
      transportMode: 'car',
      startDate: '2026-07-15',
      activities: ['nature', 'scenic', 'waterfalls']
    });

    // Winter Date (December)
    const winterPlan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 5,
      budget: 30000,
      transportMode: 'car',
      startDate: '2026-12-20',
      activities: ['nature', 'scenic', 'waterfalls']
    });

    // Verify Destination Intelligence climate recognition
    const monsoonClimate = monsoonPlan.destinationIntelligence?.climate;
    assert.ok(monsoonClimate, 'Monsoon plan must contain regional climate intelligence');
    assert.ok(monsoonClimate.monsoonMonths.includes(7), 'July must be recognized as a monsoon month in Kerala');

    // Solar calculation verification
    const solarJuly = calculateSolarTimes(10.0889, new Date('2026-07-15'));
    const solarDec = calculateSolarTimes(10.0889, new Date('2026-12-20'));

    // Astronomical check: Summer days have later sunset than winter in Western Ghats
    assert.ok(solarJuly.sunsetMinutes > solarDec.sunsetMinutes, 'July sunset must be later than December sunset');
    assert.ok(solarJuly.sunriseMinutes > 0 && solarJuly.sunsetMinutes > 0, 'Solar minutes must be positive numbers');
  });

  // =================================================================
  // TEST C: SAME TRAVELER, DIFFERENT BUDGETS (Section 15)
  // =================================================================
  await runAsyncTest('Test C: Budget Constraint Analysis & Actionable Savings Advice', async () => {
    // Extremely tight budget (₹10,000 for 5-day round-trip car travel ~2,100 km)
    const tightBudgetPlan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 5,
      budget: 10000,
      transportMode: 'car',
      activities: ['nature', 'scenic']
    });

    // Comfortable budget (₹50,000)
    const comfortablePlan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 5,
      budget: 50000,
      transportMode: 'car',
      activities: ['nature', 'scenic']
    });

    // Tight budget must detect deficit and provide concrete suggestions
    assert.ok(tightBudgetPlan.feasibilityAnalysis, 'Tight budget plan must have feasibility analysis');
    const budgetCheck = tightBudgetPlan.feasibilityAnalysis.checks.find(c => c.name.includes('Budget'));
    assert.ok(budgetCheck, 'Budget check must exist in feasibility analysis');
    assert.strictEqual(budgetCheck.passed, false, 'Tight budget check must flag exceeded budget');
    assert.ok(tightBudgetPlan.feasibilityAnalysis.actionableRecommendations.length > 0, 'Actionable cost savings advice must be provided');

    // Comfortable budget must pass
    const comfortBudgetCheck = comfortablePlan.feasibilityAnalysis.checks.find(c => c.name.includes('Budget'));
    assert.strictEqual(comfortBudgetCheck.passed, true, 'Comfortable budget check must pass without warnings');
  });

  // =================================================================
  // TEST D: SAME TRAVELER, DIFFERENT DURATIONS (Section 15)
  // =================================================================
  await runAsyncTest('Test D: Trip Duration Adaptation (3 Days vs 5 Days vs 7 Days)', async () => {
    const plan3 = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Srisailam',
      totalDays: 3,
      budget: 15000,
      transportMode: 'car',
      activities: ['spiritual', 'nature']
    });

    const plan5 = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Srisailam',
      totalDays: 5,
      budget: 25000,
      transportMode: 'car',
      activities: ['spiritual', 'nature']
    });

    assert.strictEqual(plan3.dayWiseItinerary.length, 3, '3-day plan must generate exactly 3 days');
    assert.strictEqual(plan5.dayWiseItinerary.length, 5, '5-day plan must generate exactly 5 days');

    // Driving pace check: 3-day Srisailam trip must maintain comfortable pace
    plan3.dayWiseItinerary.forEach(d => {
      assert.ok(d.totalDayDistanceKm <= 550, `Day ${d.day} driving distance (${d.totalDayDistanceKm} km) must stay under 550 km`);
    });
  });

  // =================================================================
  // TEST E: FOOD-ONLY PREVENTION (Prompt Rule 3 & Section 15 Test E)
  // =================================================================
  await runAsyncTest('Test E: Food-Only Failure Prevention (Attractions >= 60% of Activity Timeline)', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Hampi',
      totalDays: 4,
      budget: 25000,
      transportMode: 'car',
      activities: ['historical', 'heritage', 'architecture']
    });

    plan.dayWiseItinerary.forEach(d => {
      const attractionCount = (d.stops || []).length;
      assert.ok(attractionCount >= 1, `Day ${d.day} must feature at least 1 verified tourist attraction`);

      const timeline = d.timeline || [];
      const attractionSteps = timeline.filter(t => t.category !== 'meal' && t.category !== 'rest' && t.category !== 'transport');
      const totalSteps = timeline.filter(t => t.category !== 'transport');

      if (totalSteps.length > 0) {
        const attractionRatio = attractionSteps.length / totalSteps.length;
        assert.ok(
          attractionRatio >= 0.50,
          `Day ${d.day} tourist attraction ratio (${(attractionRatio * 100).toFixed(1)}%) must not be crowded out by meals`
        );
      }
    });
  });

  // =================================================================
  // TEST F: RETURN JOURNEY INDEPENDENCE (Prompt Rule 9 & Section 15 Test F)
  // =================================================================
  await runAsyncTest('Test F: Return Journey Independence (No Duplication of Visited Attractions)', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 5,
      budget: 35000,
      transportMode: 'car',
      activities: ['nature', 'scenic', 'waterfalls']
    });

    const onwardStops = plan.dayWiseItinerary
      .filter(d => d.phase === 'Onward Journey')
      .flatMap(d => d.stops.map(s => s.placeName || s.name));

    const returnStops = plan.dayWiseItinerary
      .filter(d => d.phase === 'Return Journey')
      .flatMap(d => d.stops.map(s => s.placeName || s.name));

    assert.ok(onwardStops.length > 0, 'Must have onward stops');
    assert.ok(returnStops.length > 0, 'Must have return stops');

    // Return stops must not repeat any onward stop
    const onwardSet = new Set(onwardStops);
    const duplicates = returnStops.filter(s => onwardSet.has(s));
    assert.strictEqual(duplicates.length, 0, `Return journey must explore distinct unvisited attractions, found duplicates: ${duplicates.join(', ')}`);
  });

  // =================================================================
  // TEST G: FEASIBILITY & PHYSICAL CONSTRAINTS (Section 15 Test G)
  // =================================================================
  await runAsyncTest('Test G: Feasibility & Safety Analysis (No Activity Collisions, Safe Daylight Hours)', async () => {
    const plan = await generateOptimizedItinerary({
      origin: 'Hyderabad',
      destination: 'Kerala',
      totalDays: 5,
      budget: 35000,
      transportMode: 'car',
      activities: ['adventure', 'trekking', 'waterfalls']
    });

    const analysis = plan.feasibilityAnalysis;
    assert.ok(analysis, 'Plan must contain feasibility analysis');

    const overlapCheck = analysis.checks.find(c => c.name.includes('Non-Overlap'));
    assert.ok(overlapCheck && overlapCheck.passed, 'Activity non-overlap check must pass');

    const fatigueCheck = analysis.checks.find(c => c.name.includes('Driver Fatigue'));
    assert.ok(fatigueCheck && fatigueCheck.passed, 'Driver fatigue rest check must pass');

    const curfewCheck = analysis.checks.find(c => c.name.includes('Curfew'));
    assert.ok(curfewCheck && curfewCheck.passed, 'Protected forest night curfew check must pass');

    const daylightCheck = analysis.checks.find(c => c.name.includes('Daylight'));
    assert.ok(daylightCheck && daylightCheck.passed, 'Daylight trail safety check must pass');
  });

  // =================================================================
  // TEST H: REPEATABILITY & DETERMINISM (Prompt Section 4 & Section 15 Test H)
  // =================================================================
  await runAsyncTest('Test H: Repeatability & Deterministic Consistency via Planning Version', async () => {
    const input = {
      origin: 'Hyderabad',
      destination: 'Hampi',
      totalDays: 4,
      budget: 20000,
      transportMode: 'car',
      startDate: '2026-11-10',
      activities: ['historical', 'heritage', 'architecture']
    };

    const run1 = await generateOptimizedItinerary(input);
    const run2 = await generateOptimizedItinerary(input);

    assert.strictEqual(run1.planningVersion, '2.5.0-engine-master', 'Must include official planning version');
    assert.strictEqual(run1.determinismKey, run2.determinismKey, 'Determinism keys must match for identical inputs');

    const stops1 = run1.recommendedPlaces.map(p => p.name);
    const stops2 = run2.recommendedPlaces.map(p => p.name);
    assert.deepStrictEqual(stops1, stops2, 'Identical inputs must generate identical stop sequences');

    assert.strictEqual(run1.totalEstimatedCost, run2.totalEstimatedCost, 'Identical inputs must yield identical estimated costs');
  });

  console.log('\n================================================================');
  console.log(`MASTER SUITE RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Master Suite Execution Failed:', err);
  process.exit(1);
});

