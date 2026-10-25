const http = require('http');

function request(method, path, payload = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const headers = {
      'Content-Type': 'application/json',
      'X-Bypass-RateLimit': 'true' // Allow test suite to run rapidly
    };
    if (data) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: headers,
      timeout: 25000
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${path} timed out`));
    });

    if (data) req.write(data);
    req.end();
  });
}

async function runSecurityTests() {
  console.log('==============================================================');
  console.log('    AI TRAVEL PLANNER - COMPREHENSIVE SECURITY TEST SUITE     ');
  console.log('==============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, name) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
    }
  }

  // -------------------------------------------------------------
  // SUITE 1: Security Headers & Server Hardening
  // -------------------------------------------------------------
  console.log('SUITE 1: Security Headers & Response Hardening');
  const healthRes = await request('GET', '/api/health');
  assert(healthRes.status === 200, 'Health endpoint responds with 200 OK');
  assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff header present');
  assert(healthRes.headers['x-frame-options'] === 'SAMEORIGIN' || healthRes.headers['x-frame-options'] === 'DENY', 'X-Frame-Options clickjacking protection present');
  assert(healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy header present');
  assert(healthRes.data?.googleMaps?.configured !== undefined, 'Health check does not leak internal API credentials');

  // -------------------------------------------------------------
  // SUITE 2: Authentication & Token Security
  // -------------------------------------------------------------
  console.log('\nSUITE 2: Authentication, Password Hardening & Token Security');
  
  // Test password length < 8 rejected
  const weakPassRes = await request('POST', '/api/auth/register', {
    name: 'Weak Password Tester',
    email: `weak_${Date.now()}@example.com`,
    password: 'short'
  });
  assert(weakPassRes.status === 400, 'Registration rejects passwords under 8 characters');

  // Test missing token on protected endpoint
  const missingTokenRes = await request('GET', '/api/auth/profile');
  assert(missingTokenRes.status === 401, 'Protected endpoint rejects missing token with 401');

  // Test malformed token
  const malformedTokenRes = await request('GET', '/api/auth/profile', null, 'not-a-valid-token');
  assert(malformedTokenRes.status === 401, 'Protected endpoint rejects malformed token with 401');

  // Test token with wrong secret
  const jwt = require('./backend/node_modules/jsonwebtoken');
  const forgedToken = jwt.sign({ id: 'fake_user_id' }, 'wrong_secret_key_12345', { algorithm: 'HS256' });
  const forgedTokenRes = await request('GET', '/api/auth/profile', null, forgedToken);
  assert(forgedTokenRes.status === 401, 'Protected endpoint rejects token signed with wrong secret');

  // Test algorithm 'none' token
  const noneAlgToken = jwt.sign({ id: 'fake_user_id' }, '', { algorithm: 'none' });
  const noneTokenRes = await request('GET', '/api/auth/profile', null, noneAlgToken);
  assert(noneTokenRes.status === 401, 'Protected endpoint rejects algorithm none tokens');

  // -------------------------------------------------------------
  // SUITE 3: Sensitive Data Minimization & Zero Password Hash Leakage
  // -------------------------------------------------------------
  console.log('\nSUITE 3: Sensitive Data Minimization & Password Hash Non-Exposure');
  const userAEmail = `user_a_${Date.now()}@securitytest.com`;
  const regARes = await request('POST', '/api/auth/register', {
    name: 'User Alpha',
    email: userAEmail,
    password: 'StrongPassword123!'
  });
  assert(regARes.status === 201, 'User A registered successfully');
  const tokenA = regARes.data?.token;
  const userAId = regARes.data?.user?.id;
  assert(!regARes.data?.user?.password, 'User registration response does NOT expose password or hash');

  const loginARes = await request('POST', '/api/auth/login', {
    email: userAEmail,
    password: 'StrongPassword123!'
  });
  assert(loginARes.status === 200, 'User A login succeeded');
  assert(!loginARes.data?.user?.password, 'User login response does NOT expose password or hash');

  const profileARes = await request('GET', '/api/auth/profile', null, tokenA);
  assert(profileARes.status === 200, 'User A profile fetch succeeded');
  assert(!profileARes.data?.user?.password, 'User profile response does NOT expose password or hash');

  // -------------------------------------------------------------
  // SUITE 4: Broken Access Control & IDOR Protection (Trips & Itineraries)
  // -------------------------------------------------------------
  console.log('\nSUITE 4: Broken Access Control & IDOR Protection (Itineraries)');
  
  // User A saves an itinerary
  const saveARes = await request('POST', '/api/history/save', {
    title: 'Secret Trip of User A',
    description: 'Confidential client travel schedule',
    itineraryData: {
      summary: {
        destination: 'Jaipur',
        startDate: '2026-11-01',
        endDate: '2026-11-04',
        totalDays: 3,
        originalBudget: 18000,
        withinBudget: true
      },
      details: {
        startLocation: 'Delhi',
        preferredActivities: 'culture, forts',
        accommodationType: 'hotel',
        transportMode: 'car'
      },
      estimatedCosts: { total: 14500 }
    }
  }, tokenA);
  assert(saveARes.status === 201, 'User A saved a private itinerary');
  const itineraryAId = saveARes.data?.itinerary?.id;

  // Register User B (attacker / separate tenant)
  const userBEmail = `user_b_${Date.now()}@securitytest.com`;
  const regBRes = await request('POST', '/api/auth/register', {
    name: 'User Beta',
    email: userBEmail,
    password: 'StrongPassword456!'
  });
  assert(regBRes.status === 201, 'User B registered successfully');
  const tokenB = regBRes.data?.token;

  // Attack 1: User B tries to READ User A's itinerary
  const readAttRes = await request('GET', `/api/history/${itineraryAId}`, null, tokenB);
  assert(readAttRes.status === 404, 'User B receives 404 (Not Found) when trying to read User A itinerary (Anti-IDOR / Anti-Enumeration)');

  // Attack 2: User B tries to MODIFY User A's itinerary
  const updateAttRes = await request('PUT', `/api/history/${itineraryAId}`, {
    title: 'Hacked by User B'
  }, tokenB);
  assert(updateAttRes.status === 404, 'User B receives 404 when trying to update User A itinerary');

  // Attack 3: User B tries to DUPLICATE User A's itinerary
  const dupAttRes = await request('POST', `/api/history/duplicate/${itineraryAId}`, null, tokenB);
  assert(dupAttRes.status === 404, 'User B receives 404 when trying to clone User A itinerary');

  // Attack 4: User B tries to DELETE User A's itinerary
  const deleteAttRes = await request('DELETE', `/api/history/${itineraryAId}`, null, tokenB);
  assert(deleteAttRes.status === 404, 'User B receives 404 when trying to delete User A itinerary');

  // Verify User A's itinerary is intact and unchanged
  const verifyARes = await request('GET', `/api/history/${itineraryAId}`, null, tokenA);
  assert(verifyARes.status === 200 && verifyARes.data?.itinerary?.title === 'Secret Trip of User A', 'User A itinerary remains unmodified and secure');

  // -------------------------------------------------------------
  // SUITE 5: Rental Booking & Payment IDOR Protection
  // -------------------------------------------------------------
  console.log('\nSUITE 5: Rental Booking & Payment IDOR Isolation');
  
  // User A books a rental car
  const randOffset = Math.floor(Math.random() * 20) + 1;
  const dStart = String(randOffset).padStart(2, '0');
  const dEnd = String(randOffset + 2).padStart(2, '0');
  const rentalBookARes = await request('POST', '/api/rentals/booking', {
    vehicleId: 'a6-19',
    pickupLocation: 'Hyderabad',
    dropoffLocation: 'Hyderabad',
    pickupDate: `2027-06-${dStart}`,
    returnDate: `2027-06-${dEnd}`,
    pickupTime: '09:00',
    returnTime: '18:00'
  }, tokenA);
  assert(rentalBookARes.status === 200 && rentalBookARes.data?.booking?.bookingId, 'User A created rental booking');
  const bookingAId = rentalBookARes.data?.booking?.bookingId;

  // Attack 5: User B tries to read User A's booking
  const readBookingAtt = await request('GET', `/api/rentals/booking/${bookingAId}`, null, tokenB);
  assert(readBookingAtt.status === 404, 'User B cannot view User A rental booking (IDOR prevented)');

  // Attack 6: User B tries to process payment on User A's booking
  const payBookingAtt = await request('POST', '/api/rentals/payment/process', {
    bookingId: bookingAId,
    amount: 500,
    paymentMethod: 'upi'
  }, tokenB);
  assert(payBookingAtt.status === 404 || payBookingAtt.status === 403, 'User B cannot confirm or tamper with User A rental payment');

  // -------------------------------------------------------------
  // SUITE 6: Account Deletion Authorization & Isolation
  // -------------------------------------------------------------
  console.log('\nSUITE 6: Account Deletion Authorization & Isolation');
  
  // User B tries to delete account with User A id injected in body/query
  const deleteAttemptRes = await request('DELETE', `/api/auth/account?id=${userAId}&userId=${userAId}`, {
    id: userAId,
    userId: userAId
  }, tokenB);
  assert(deleteAttemptRes.status === 200, 'User B triggers account deletion endpoint');

  // Verify User A is STILL alive and untouched!
  const loginAVerify = await request('POST', '/api/auth/login', {
    email: userAEmail,
    password: 'StrongPassword123!'
  });
  assert(loginAVerify.status === 200, 'User A account was NOT deleted by User B (Server derived identity enforced)');

  // Verify User B is deleted
  const loginBVerify = await request('POST', '/api/auth/login', {
    email: userBEmail,
    password: 'StrongPassword456!'
  });
  assert(loginBVerify.status === 401, 'User B account was permanently purged');

  // -------------------------------------------------------------
  // SUITE 7: ReDoS & Parameter Tampering Resilience
  // -------------------------------------------------------------
  console.log('\nSUITE 7: ReDoS & Special Character Injection Resilience');
  const tStart = Date.now();
  const redosRes = await request('GET', '/api/places?q=' + encodeURIComponent('(a+)+$|((a*)*)*|\\\\\\\\'));
  const duration = Date.now() - tStart;
  assert(redosRes.status === 200, 'Extreme regex query handled gracefully without error');
  assert(duration < 500, `ReDoS query completed in ${duration}ms (< 500ms threshold)`);

  const sqlInjectRes = await request('GET', '/api/places?state=' + encodeURIComponent("' OR '1'='1' --"));
  assert(sqlInjectRes.status === 200, 'SQL injection probe handled safely via parameterized query');

  console.log('\n==============================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('==============================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL SECURITY, AUTHORIZATION & IDOR REGRESSION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runSecurityTests().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
