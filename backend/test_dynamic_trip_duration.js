/**
 * Validation Test Suite for Dynamic Trip Duration & User Available Days
 * 
 * Verifies that the VISTA AI Travel Planning Engine dynamically respects the user's
 * requested available days across all input formats, rather than forcing a fixed 3 days.
 */

const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { generateOptimizedItinerary } = require('./src/services/engine');
const itineraryRouter = require('./src/routes/itinerary');

// Extract the /generate route handler from the Express router
const generateLayer = itineraryRouter.stack.find(l => l.route && l.route.path === '/generate');
const routeGenerateHandler = generateLayer.route.stack[generateLayer.route.stack.length - 1].handle;

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  process.stdout.write(`▶️  RUNNING: ${name}... `);
  try {
    await fn();
    passed++;
    console.log('✅ PASS');
  } catch (err) {
    console.log('❌ FAIL');
    console.error(`   Error: ${err.message}`);
    throw err;
  }
}

async function runSuite() {
  console.log('========================================================================');
  console.log('🚀 DYNAMIC TRIP DURATION & AVAILABLE DAYS VERIFICATION SUITE');
  console.log('========================================================================\n');

  // --- Group 1: Calendar Date Ranges ---
  console.log('--- GROUP 1: CALENDAR DATE RANGE RECOGNITION ---');

  await test('1.1: 2-Day Weekend Trip (2026-11-10 to 2026-11-11)', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Srisailam',
      travelDates: '2026-11-10 to 2026-11-11'
    });
    assert.strictEqual(res.summary.totalDays, 2, `Expected 2 days in summary, got ${res.summary.totalDays}`);
    assert.strictEqual(res.dayPlans.length, 2, `Expected 2 dayPlans, got ${res.dayPlans.length}`);
  });

  await test('1.2: 4-Day Road Trip (2026-11-10 to 2026-11-13)', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Hampi',
      travelDates: '2026-11-10 to 2026-11-13'
    });
    assert.strictEqual(res.summary.totalDays, 4, `Expected 4 days, got ${res.summary.totalDays}`);
    assert.strictEqual(res.dayPlans.length, 4, `Expected 4 dayPlans, got ${res.dayPlans.length}`);
  });

  await test('1.3: 5-Day Vacation (2026-11-10 to 2026-11-14)', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Goa',
      travelDates: '2026-11-10 to 2026-11-14'
    });
    assert.strictEqual(res.summary.totalDays, 5, `Expected 5 days, got ${res.summary.totalDays}`);
    assert.strictEqual(res.dayPlans.length, 5, `Expected 5 dayPlans, got ${res.dayPlans.length}`);
  });

  await test('1.4: 7-Day Kerala Journey (2026-11-10 to 2026-11-16)', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Kerala',
      travelDates: '2026-11-10 to 2026-11-16'
    });
    assert.strictEqual(res.summary.totalDays, 7, `Expected 7 days, got ${res.summary.totalDays}`);
    assert.strictEqual(res.dayPlans.length, 7, `Expected 7 dayPlans, got ${res.dayPlans.length}`);
  });

  await test('1.5: 9-Day Extended Exploration (2026-11-10 to 2026-11-18)', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Kerala',
      travelDates: '2026-11-10 to 2026-11-18'
    });
    assert.strictEqual(res.summary.totalDays, 9, `Expected 9 days, got ${res.summary.totalDays}`);
    assert.strictEqual(res.dayPlans.length, 9, `Expected 9 dayPlans, got ${res.dayPlans.length}`);
  });

  // --- Group 2: Explicit Duration Properties ---
  console.log('\n--- GROUP 2: EXPLICIT DURATION NUMERIC PROPERTIES ---');

  await test('2.1: totalDays = 6', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Goa',
      totalDays: 6
    });
    assert.strictEqual(res.summary.totalDays, 6);
    assert.strictEqual(res.dayPlans.length, 6);
  });

  await test('2.2: days = 3', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Tirupati',
      days: 3
    });
    assert.strictEqual(res.summary.totalDays, 3);
    assert.strictEqual(res.dayPlans.length, 3);
  });

  await test('2.3: numberOfDays = 8', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Kerala',
      numberOfDays: 8
    });
    assert.strictEqual(res.summary.totalDays, 8);
    assert.strictEqual(res.dayPlans.length, 8);
  });

  await test('2.4: trip_duration = 5', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Araku Valley',
      trip_duration: 5
    });
    assert.strictEqual(res.summary.totalDays, 5);
    assert.strictEqual(res.dayPlans.length, 5);
  });

  // --- Group 3: Separate startDate and endDate ---
  console.log('\n--- GROUP 3: SEPARATE STARTDATE AND ENDDATE ---');

  await test('3.1: startDate and endDate (4 Days)', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Hampi',
      startDate: '2026-12-01',
      endDate: '2026-12-04'
    });
    assert.strictEqual(res.summary.totalDays, 4);
    assert.strictEqual(res.dayPlans.length, 4);
  });

  // --- Group 4: Natural Language Duration Parsing ---
  console.log('\n--- GROUP 4: NATURAL LANGUAGE DURATION PARSING ---');

  await test('4.1: Natural language in prompt ("plan a 5 days trip")', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Araku Valley',
      prompt: 'plan a 5 days trip with waterfalls and coffee plantations'
    });
    assert.strictEqual(res.summary.totalDays, 5);
    assert.strictEqual(res.dayPlans.length, 5);
  });

  await test('4.2: Natural language in activities ("nature for 7 days")', async () => {
    const res = await generateOptimizedItinerary({
      startLocation: 'Hyderabad',
      destination: 'Kerala',
      activities: 'nature and trekking for 7 days'
    });
    assert.strictEqual(res.summary.totalDays, 7);
    assert.strictEqual(res.dayPlans.length, 7);
  });

  // --- Group 5: Route API End-to-End (/api/itinerary/generate) ---
  console.log('\n--- GROUP 5: /api/itinerary/generate ROUTE INTEGRATION ---');

  await test('5.1: Route handler with 7-day travelDates payload', async () => {
    let sentData = null;
    const req = {
      body: {
        startLocation: 'Hyderabad',
        destination: 'Kerala',
        travelDates: '2026-11-10 to 2026-11-16'
      }
    };
    const res = {
      headersSent: false,
      json: (d) => { sentData = d; },
      status: () => res
    };
    await routeGenerateHandler(req, res, () => {});
    const plan = sentData?.itinerary || sentData?.data || sentData;
    assert.strictEqual(plan?.summary?.totalDays, 7, `Expected 7 days from route, got ${plan?.summary?.totalDays}`);
    assert.strictEqual(plan?.dayPlans?.length, 7, `Expected 7 dayPlans from route, got ${plan?.dayPlans?.length}`);
  });

  await test('5.2: Route handler with 4-day travelDates payload', async () => {
    let sentData = null;
    const req = {
      body: {
        startLocation: 'Hyderabad',
        destination: 'Hampi',
        travelDates: '2026-11-10 to 2026-11-13'
      }
    };
    const res = {
      headersSent: false,
      json: (d) => { sentData = d; },
      status: () => res
    };
    await routeGenerateHandler(req, res, () => {});
    const plan = sentData?.itinerary || sentData?.data || sentData;
    assert.strictEqual(plan?.summary?.totalDays, 4, `Expected 4 days from route, got ${plan?.summary?.totalDays}`);
    assert.strictEqual(plan?.dayPlans?.length, 4, `Expected 4 dayPlans from route, got ${plan?.dayPlans?.length}`);
  });

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${total - passed} FAILED`);
  console.log('========================================================================\n');
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

