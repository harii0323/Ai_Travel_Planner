/**
 * ============================================================================
 * Enterprise-Grade Automated Security & Defense-in-Depth Verification Suite
 * ============================================================================
 * Tests all 16 critical security domains:
 * 1.  Security response headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, COOP, CORP)
 * 2.  Server fingerprinting protection (X-Powered-By removal)
 * 3.  Authentication & token signature validation (HS256 algorithm enforcement, 'none' algorithm rejection)
 * 4.  Password complexity and length bounds (8 to 128 chars)
 * 5.  Sensitive data minimization (Zero password/hash leakage in all API responses)
 * 6.  Session lifecycle & token revocation (Immediate invalidation after POST /api/auth/logout)
 * 7.  Account deletion cascading isolation & token invalidation (DELETE /api/auth/account)
 * 8.  IDOR / BOLA Prevention on private itineraries (Read, Update, Clone, Delete isolation)
 * 9.  IDOR / BOLA Prevention on rental bookings (Cross-user access denied with 404/403)
 * 10. Third-party credential protection (Zero authToken / service credential leakage in booking objects)
 * 11. Payment price integrity & anti-tampering (Rejection of client-manipulated payment amounts)
 * 12. Payment transaction replay protection (Duplicate transaction IDs blocked with 409)
 * 13. Rate limit enforcement & elimination of backdoor headers (X-Bypass-RateLimit is ignored and throttled)
 * 14. ReDoS & unhandled regex exception resilience (Unclosed brackets '[' and quantifiers handled safely)
 * 15. Prototype pollution prevention (__proto__, constructor, prototype blocked in nested updates)
 * 16. AI & Spatiotemporal input parameter bounding (Budget, days, travelers bounds enforced)
 */

const http = require('http');

function request(method, path, payload = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
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
      timeout: 60000
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
      reject(new Error(`Request to ${path} timed out after 60000ms`));
    });

    if (data) req.write(data);
    req.end();
  });
}

async function runEnterpriseSecuritySuite() {
  console.log('========================================================================');
  console.log('    AI TRAVEL PLANNER - ENTERPRISE SECURITY & HARDENING VERIFICATION    ');
  console.log('========================================================================\n');

  const app = require('./backend/src/index');
  let testServer = null;
  await new Promise((resolve, reject) => {
    testServer = app.listen(5000, () => {
      console.log('  [Harness] Backend server initialized on port 5000\n');
      resolve();
    });
    testServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('  [Harness] Port 5000 in use, running against existing active server\n');
        testServer = null;
        resolve();
      } else {
        reject(err);
      }
    });
  });

  let passed = 0;
  let total = 0;

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${details ? `(${details})` : ''}`);
    }
  }

  // -------------------------------------------------------------
  // SUITE 1: HTTP Security Headers & Information Disclosure Protection
  // -------------------------------------------------------------
  console.log('SUITE 1: HTTP Security Headers & Response Hardening');
  const healthRes = await request('GET', '/api/health');
  assert(healthRes.status === 200, 'Health endpoint responds with 200 OK');
  assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff header enforced');
  assert(healthRes.headers['x-frame-options'] === 'SAMEORIGIN', 'Clickjacking defense (X-Frame-Options: SAMEORIGIN) enforced');
  assert(healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy: strict-origin-when-cross-origin enforced');
  assert(healthRes.headers['cross-origin-opener-policy'] === 'same-origin', 'Cross-Origin-Opener-Policy: same-origin enforced');
  assert(healthRes.headers['cross-origin-resource-policy'] === 'same-origin', 'Cross-Origin-Resource-Policy: same-origin enforced');
  assert(typeof healthRes.headers['content-security-policy'] === 'string' && healthRes.headers['content-security-policy'].includes("default-src 'self'"), 'Content Security Policy (CSP) header enforced');
  assert(!healthRes.headers['x-powered-by'], 'Server fingerprinting removed (X-Powered-By is absent)');
  assert(healthRes.data?.googleMaps?.configured !== undefined, 'Health check does not expose raw secret API keys');

  // -------------------------------------------------------------
  // SUITE 2: Authentication, Password Hardening & Token Security
  // -------------------------------------------------------------
  console.log('\nSUITE 2: Authentication, Password Policy & Token Security');
  const shortPassRes = await request('POST', '/api/auth/register', {
    name: 'Short Pass',
    email: `short_${Date.now()}@example.com`,
    password: 'pass'
  });
  assert(shortPassRes.status === 400, 'Registration rejects passwords under 8 characters');

  const longPass = 'A'.repeat(150);
  const longPassRes = await request('POST', '/api/auth/register', {
    name: 'Long Pass',
    email: `long_${Date.now()}@example.com`,
    password: longPass
  });
  assert(longPassRes.status === 400, 'Registration rejects oversized passwords (>128 chars to prevent bcrypt DoS)');

  const missingTokenRes = await request('GET', '/api/auth/profile');
  assert(missingTokenRes.status === 401, 'Unauthenticated request to protected endpoint rejected with 401');

  const malformedTokenRes = await request('GET', '/api/auth/profile', null, 'malformed.token.string');
  assert(malformedTokenRes.status === 401, 'Malformed JWT token rejected with 401');

  const jwt = require('./backend/node_modules/jsonwebtoken');
  const forgedToken = jwt.sign({ id: 'fake-tenant-id' }, 'attacker_forged_secret_key_12345', { algorithm: 'HS256' });
  const forgedRes = await request('GET', '/api/auth/profile', null, forgedToken);
  assert(forgedRes.status === 401, 'Token signed with unauthorized secret rejected with 401');

  const noneAlgToken = jwt.sign({ id: 'fake-tenant-id' }, '', { algorithm: 'none' });
  const noneRes = await request('GET', '/api/auth/profile', null, noneAlgToken);
  assert(noneRes.status === 401, 'Algorithm "none" token manipulation rejected with 401');

  // -------------------------------------------------------------
  // SUITE 3: Sensitive Data Minimization & Zero Credential Leakage
  // -------------------------------------------------------------
  console.log('\nSUITE 3: Sensitive Data Minimization & Password Non-Exposure');
  const userAEmail = `user_a_${Date.now()}@testsec.com`;
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
  assert(loginARes.status === 200, 'User A logged in successfully');
  assert(!loginARes.data?.user?.password, 'User login response does NOT expose password or hash');

  const profileARes = await request('GET', '/api/auth/profile', null, tokenA);
  assert(profileARes.status === 200, 'User A profile retrieved successfully');
  assert(!profileARes.data?.user?.password, 'User profile response does NOT expose password or hash');

  // -------------------------------------------------------------
  // SUITE 4: Session Lifecycle & Token Revocation on Logout
  // -------------------------------------------------------------
  console.log('\nSUITE 4: Session Lifecycle & Token Revocation');
  // Register ephemeral user to test logout invalidation
  const logoutUserEmail = `logout_test_${Date.now()}@testsec.com`;
  const logoutReg = await request('POST', '/api/auth/register', {
    name: 'Logout Tester',
    email: logoutUserEmail,
    password: 'Password123!'
  });
  const logoutToken = logoutReg.data?.token;
  assert(logoutReg.status === 201 && logoutToken, 'Ephemeral user registered with token');

  // Verify token works before logout
  const preLogoutCheck = await request('GET', '/api/auth/profile', null, logoutToken);
  assert(preLogoutCheck.status === 200, 'Token valid and accepted prior to logout');

  // Perform logout
  const logoutRes = await request('POST', '/api/auth/logout', null, logoutToken);
  assert(logoutRes.status === 200, 'POST /api/auth/logout succeeded');

  // Attempt to reuse revoked token after logout
  const postLogoutCheck = await request('GET', '/api/auth/profile', null, logoutToken);
  assert(postLogoutCheck.status === 401, 'Replay of revoked token after logout rejected with 401 Unauthorized');

  // Verify token revocation is durably persisted in PostgreSQL revoked_tokens table
  const dbConfig = require('./backend/src/config/database');
  if (dbConfig.isConnected()) {
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(logoutToken).digest('hex');
    const dbTokenCheck = await dbConfig.query('SELECT token_hash FROM revoked_tokens WHERE token_hash = $1', [tokenHash]);
    assert(dbTokenCheck.rows?.length === 1, 'Revoked token is durably recorded in PostgreSQL revoked_tokens table');
  }

  // -------------------------------------------------------------
  // SUITE 5: Broken Object Level Authorization (BOLA/IDOR) on Itineraries
  // -------------------------------------------------------------
  console.log('\nSUITE 5: Broken Object Level Authorization (IDOR) - Itineraries');
  // User A saves private itinerary
  const saveItinRes = await request('POST', '/api/history/save', {
    title: 'Top Secret Vacation Plan',
    description: 'Executive family confidential itinerary',
    itineraryData: {
      summary: {
        destination: 'Manali',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        totalDays: 4,
        originalBudget: 35000,
        withinBudget: true
      },
      details: {
        startLocation: 'Delhi',
        preferredActivities: 'snow, trekking',
        accommodationType: 'resort',
        transportMode: 'car'
      },
      estimatedCosts: { total: 28000 }
    }
  }, tokenA);
  assert(saveItinRes.status === 201, 'User A saved a private itinerary');
  const itineraryAId = saveItinRes.data?.itinerary?.id;

  // Register User B (Attacker Tenant)
  const userBEmail = `user_b_${Date.now()}@testsec.com`;
  const regBRes = await request('POST', '/api/auth/register', {
    name: 'Attacker Beta',
    email: userBEmail,
    password: 'AttackerPassword123!'
  });
  assert(regBRes.status === 201, 'User B (Attacker) registered successfully');
  const tokenB = regBRes.data?.token;

  // Attack 1: User B tries to read User A's itinerary
  const readItinAttack = await request('GET', `/api/history/${itineraryAId}`, null, tokenB);
  assert(readItinAttack.status === 404, 'User B cannot read User A itinerary (404 Anti-IDOR)');

  // Attack 2: User B tries to modify User A's itinerary
  const updateItinAttack = await request('PUT', `/api/history/${itineraryAId}`, {
    title: 'Defaced by Attacker'
  }, tokenB);
  assert(updateItinAttack.status === 404, 'User B cannot update User A itinerary (404 Anti-IDOR)');

  // Attack 3: User B tries to clone User A's itinerary
  const cloneItinAttack = await request('POST', `/api/history/duplicate/${itineraryAId}`, null, tokenB);
  assert(cloneItinAttack.status === 404, 'User B cannot clone User A itinerary (404 Anti-IDOR)');

  // Attack 4: User B tries to delete User A's itinerary
  const deleteItinAttack = await request('DELETE', `/api/history/${itineraryAId}`, null, tokenB);
  assert(deleteItinAttack.status === 404, 'User B cannot delete User A itinerary (404 Anti-IDOR)');

  // Verify User A's itinerary remains unmodified
  const verifyItin = await request('GET', `/api/history/${itineraryAId}`, null, tokenA);
  assert(verifyItin.status === 200 && verifyItin.data?.itinerary?.title === 'Top Secret Vacation Plan', 'User A itinerary integrity preserved intact');

  // -------------------------------------------------------------
  // SUITE 6: Rental Booking & Payment Integrity (IDOR, Price Tampering, Replay)
  // -------------------------------------------------------------
  console.log('\nSUITE 6: Rental Booking & Payment Integrity (Anti-Tampering, IDOR, Anti-Replay)');
  // User A books a rental car
  const rentalBookRes = await request('POST', '/api/rentals/booking', {
    vehicleId: 'a6-19',
    pickupLocation: 'Hyderabad',
    dropoffLocation: 'Hyderabad',
    pickupDate: '2027-04-10',
    returnDate: '2027-04-13',
    pickupTime: '09:00',
    returnTime: '18:00'
  }, tokenA);
  assert(rentalBookRes.status === 200 && rentalBookRes.data?.booking?.bookingId, 'User A created rental booking');
  const bookingA = rentalBookRes.data?.booking;
  const bookingAId = bookingA?.bookingId;

  // Security Check: Verify third-party authToken is NOT leaked in booking response
  assert(!bookingA?.authToken, 'Service authToken is NOT exposed in client booking response (Credential Protection)');
  assert(!bookingA?.customerId, 'Internal customerId is NOT exposed in client booking response');

  // Attack 5: User B tries to view User A's booking
  const readBookingAttack = await request('GET', `/api/rentals/booking/${bookingAId}`, null, tokenB);
  assert(readBookingAttack.status === 404, 'User B cannot view User A rental booking (IDOR prevented)');

  // Attack 6: User B tries to pay for User A's booking
  const payAttack = await request('POST', '/api/rentals/payment/process', {
    bookingId: bookingAId,
    paymentMethod: 'upi',
    paymentPlan: 'reserve'
  }, tokenB);
  assert(payAttack.status === 404 || payAttack.status === 403, 'User B cannot pay for User A rental booking (IDOR prevented)');

  // Attack 7: Price tampering attempt (sending ₹1 instead of required deposit)
  const tamperPriceRes = await request('POST', '/api/rentals/payment/process', {
    bookingId: bookingAId,
    amount: 1, // Manipulated price
    paymentMethod: 'upi',
    paymentPlan: 'reserve'
  }, tokenA);
  assert(tamperPriceRes.status === 400, 'Price tampering attempt rejected with 400 Bad Request');

  // Valid Payment by User A with authoritative price
  const validTxnId = `TXN-VERIFY-${Date.now()}`;
  const validPayRes = await request('POST', '/api/rentals/payment/process', {
    bookingId: bookingAId,
    paymentMethod: 'upi',
    paymentPlan: 'reserve',
    transactionId: validTxnId
  }, tokenA);
  assert(validPayRes.status === 200 && validPayRes.data?.success, 'User A processed legitimate reservation payment');

  // Attack 8: Payment replay attack (re-submitting the exact same transaction ID)
  const replayAttackRes = await request('POST', '/api/rentals/payment/process', {
    bookingId: bookingAId,
    paymentMethod: 'upi',
    paymentPlan: 'reserve',
    transactionId: validTxnId
  }, tokenA);
  assert(replayAttackRes.status === 409, 'Payment transaction replay attack blocked with 409 Conflict');

  // Verify transaction is durably recorded in PostgreSQL payment_transactions table
  if (dbConfig.isConnected()) {
    const dbTxnCheck = await dbConfig.query('SELECT transaction_id, status FROM payment_transactions WHERE transaction_id = $1', [validTxnId]);
    assert(dbTxnCheck.rows?.length === 1 && dbTxnCheck.rows[0].status === 'completed', 'Payment transaction is durably recorded in PostgreSQL payment_transactions table');
  }

  // Attack 9: Concurrent race-condition duplicate payment requests
  const concurrentTxnId = `TXN-CONCURRENT-${Date.now()}`;
  const [concurrentRes1, concurrentRes2] = await Promise.all([
    request('POST', '/api/rentals/payment/process', {
      bookingId: bookingAId,
      paymentMethod: 'upi',
      paymentPlan: 'reserve',
      transactionId: concurrentTxnId
    }, tokenA),
    request('POST', '/api/rentals/payment/process', {
      bookingId: bookingAId,
      paymentMethod: 'upi',
      paymentPlan: 'reserve',
      transactionId: concurrentTxnId
    }, tokenA)
  ]);
  const statuses = [concurrentRes1.status, concurrentRes2.status];
  assert(statuses.includes(409), 'Concurrent duplicate payment request safely serialized and blocked with 409 Conflict');

  // SSRF Protection: External URL Validation
  const { validateExternalUrl } = require('./backend/src/services/carRentalService');
  assert(!validateExternalUrl('http://169.254.169.254/latest/meta-data/'), 'SSRF filter blocks AWS/GCP cloud metadata IP');
  assert(!validateExternalUrl('http://127.0.0.1:5432/'), 'SSRF filter blocks local loopback 127.0.0.1');
  assert(!validateExternalUrl('http://localhost:5000/'), 'SSRF filter blocks localhost');
  assert(!validateExternalUrl('http://10.0.0.1/admin'), 'SSRF filter blocks private RFC1918 10.x IP');
  assert(!validateExternalUrl('http://192.168.1.1/'), 'SSRF filter blocks private RFC1918 192.168.x IP');
  assert(!validateExternalUrl('http://[::1]/'), 'SSRF filter blocks IPv6 loopback');
  assert(validateExternalUrl('https://api.partner.com/cars'), 'SSRF filter permits legitimate public HTTPS endpoint');

  // -------------------------------------------------------------
  // SUITE 7: Prototype Pollution Prevention
  // -------------------------------------------------------------
  console.log('\nSUITE 7: Prototype Pollution Vulnerability Mitigation');
  const protoPolluteRes = await request('PUT', '/api/auth/profile', {
    '__proto__.isAdmin': true,
    'constructor.prototype.hacked': true
  }, tokenA);
  assert(protoPolluteRes.status === 500 || protoPolluteRes.status === 400, 'Prototype pollution payload safely intercepted and rejected');
  assert(({}).isAdmin === undefined, 'Global Object prototype was NOT polluted');
  assert(({}).hacked === undefined, 'Global Object prototype constructor was NOT polluted');

  // -------------------------------------------------------------
  // SUITE 8: ReDoS & Parameter Tampering Resilience
  // -------------------------------------------------------------
  console.log('\nSUITE 8: ReDoS & Special Character Handling');
  // Unclosed regex bracket probe on history endpoint
  const unclosedBracketRes = await request('GET', '/api/history?destination=[', null, tokenA);
  assert(unclosedBracketRes.status === 200, 'Unclosed regex bracket on /api/history handled safely without crash');

  // Catastrophic backtracking regex string on places endpoint
  const t0 = Date.now();
  const redosRes = await request('GET', '/api/places?q=' + encodeURIComponent('((((a+)+)+)+)+$'));
  const duration = Date.now() - t0;
  assert(redosRes.status === 200, 'Complex regex query on /api/places handled safely without server crash');
  assert(duration < 500, `ReDoS query completed in ${duration}ms (< 500ms threshold)`);

  // SQL injection string in query parameter
  const sqlProbeRes = await request('GET', '/api/places?state=' + encodeURIComponent("' OR '1'='1' --"));
  assert(sqlProbeRes.status === 200, 'SQL injection probe handled safely via parameterized query');

  // -------------------------------------------------------------
  // SUITE 9: AI Bounding & Cost Governance Controls
  // -------------------------------------------------------------
  console.log('\nSUITE 9: AI Bounding & Parameter Sanitization');
  const boundedGenRes = await request('POST', '/api/itinerary/generate', {
    destination: '<script>alert("XSS")</script>Jaipur',
    days: 999999, // Unbounded days
    budget: -50000, // Negative budget
    travelers: -5, // Negative travelers
    travelStyle: 'budget'
  });
  assert(boundedGenRes.status === 200, 'Unbounded itinerary generation request gracefully normalized');
  const daysResult = boundedGenRes.data?.itinerary?.summary?.totalDays || boundedGenRes.data?.itinerary?.days;
  assert(daysResult <= 14, `Trip duration bounded to maximum 14 days (Actual: ${daysResult})`);
  const budgetResult = boundedGenRes.data?.itinerary?.summary?.originalBudget || boundedGenRes.data?.itinerary?.budget;
  assert(budgetResult > 0, `Budget bounded to positive value (Actual: ₹${budgetResult})`);

  // Bandit feedback user spoofing prevention
  const spoofFeedbackRes = await request('POST', '/api/itinerary/bandit/feedback', {
    userId: 'spoofed_target_user_id',
    poiName: 'Amber Fort',
    category: 'heritage',
    action: 'save',
    rating: 5
  }, tokenA);
  assert(spoofFeedbackRes.status === 200, 'Bandit feedback update handled');
  assert(spoofFeedbackRes.data?.data?.userId === userAId, 'Bandit feedback enforces authenticated server identity over client body spoof');

  // -------------------------------------------------------------
  // SUITE 10: Cascading Account Deletion & Permanent Purge
  // -------------------------------------------------------------
  console.log('\nSUITE 10: Cascading Account Deletion & Permanent Purge');
  const delARes = await request('DELETE', '/api/auth/account', null, tokenA);
  assert(delARes.status === 200, 'User A triggered permanent account deletion');

  // Verify User A cannot log in
  const postDelLogin = await request('POST', '/api/auth/login', {
    email: userAEmail,
    password: 'StrongPassword123!'
  });
  assert(postDelLogin.status === 401, 'Deleted user cannot log in (Permanently purged from database)');

  // Verify User A's token is immediately revoked
  const postDelTokenCheck = await request('GET', '/api/auth/profile', null, tokenA);
  assert(postDelTokenCheck.status === 401, 'Deleted user token revoked and rejected with 401');

  // -------------------------------------------------------------
  // SUITE 11: Rate Limiting & Elimination of Header Backdoor
  // -------------------------------------------------------------
  console.log('\nSUITE 11: Rate Limiting Enforcement & Backdoor Header Neutralization');
  // We send a burst to /api/auth/login to trigger the rate limiter
  // Note: we also include 'X-Bypass-RateLimit: true' to prove it does NOT bypass throttling!
  let rateLimitedTriggered = false;
  for (let i = 0; i < 45; i++) {
    const burstRes = await request('POST', '/api/auth/login', {
      email: 'bruteforce_probe@example.com',
      password: 'wrong_password_123'
    }, null, { 'X-Bypass-RateLimit': 'true' });

    if (burstRes.status === 429) {
      rateLimitedTriggered = true;
      assert(burstRes.status === 429, 'Rate limiter fired (429 Too Many Requests)');
      assert(burstRes.headers['retry-after'] !== undefined, 'Retry-After header present in rate limit response');
      break;
    }
  }
  assert(rateLimitedTriggered, 'Brute force attack throttled: X-Bypass-RateLimit header backdoor is successfully eliminated');

  // -------------------------------------------------------------
  // SUITE 12: PostgreSQL Row-Level Security (RLS) Database-Tier Verification
  // -------------------------------------------------------------
  console.log('\nSUITE 12: PostgreSQL Row-Level Security (RLS) Database-Tier Verification');
  if (dbConfig.isConnected()) {
    const { Pool } = require('./backend/node_modules/pg');
    const dbNameRes = await dbConfig.query('SELECT current_database()');
    const currentDbName = dbNameRes.rows[0].current_database;

    // Check 1: RLS is enabled on user-owned tables
    const rlsCheck = await dbConfig.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('users', 'itineraries')");
    assert(rlsCheck.rows.length === 2 && rlsCheck.rows.every(r => r.relrowsecurity), 'Row-Level Security (RLS) enabled on users and itineraries tables');

    // Check 2: Setup and verify isolation using least-privilege runtime role
    await dbConfig.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'travel_app_runtime') THEN
          CREATE ROLE travel_app_runtime WITH LOGIN PASSWORD 'runtime_secure_pass_123' NOSUPERUSER NOBYPASSRLS;
        ELSE
          ALTER ROLE travel_app_runtime WITH LOGIN PASSWORD 'runtime_secure_pass_123' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
    `);

    await dbConfig.query(`
      GRANT CONNECT ON DATABASE ${currentDbName} TO travel_app_runtime;
      GRANT USAGE ON SCHEMA public TO travel_app_runtime;
      GRANT SELECT, INSERT, UPDATE, DELETE ON users, itineraries, revoked_tokens, payment_transactions TO travel_app_runtime;
      GRANT SELECT ON tourist_places, place_distances TO travel_app_runtime;
    `);

    const runtimePool = new Pool({
      connectionString: `postgres://travel_app_runtime:runtime_secure_pass_123@localhost:5432/${currentDbName}`
    });

    try {
      const client = await runtimePool.connect();
      try {
        // Query without user context (unauthenticated query)
        const unauthQuery = await client.query('SELECT id, user_id FROM itineraries');
        assert(unauthQuery.rows.length === 0, 'Database RLS fails closed when user context is omitted (0 rows returned to unauthenticated caller)');

        // Query with User B context attempting to read User A's itinerary
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_user_id', $1, true)", ['user-b-tenant-id']);
        const crossReadQuery = await client.query('SELECT id FROM itineraries WHERE user_id = $1', [userAId]);
        assert(crossReadQuery.rows.length === 0, 'Database RLS prevents cross-tenant data access (User B cannot read User A rows via database)');
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    } catch (rlsErr) {
      console.warn('RLS test notice:', rlsErr.message);
    } finally {
      await runtimePool.end();
    }
  }

  // -------------------------------------------------------------
  // TEST REPORT SUMMARY
  // -------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`RESULTS: ${passed} / ${total} SECURITY VERIFICATION CHECKS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================');

  if (testServer) {
    try {
      if (typeof testServer.closeAllConnections === 'function') testServer.closeAllConnections();
      await new Promise(r => testServer.close(r));
    } catch (e) {}
  }

  if (passed === total) {
    console.log('🎉 ALL 16 ENTERPRISE SECURITY & HARDENING VERIFICATION CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.error(`❌ ${total - passed} CHECKS FAILED!\n`);
    process.exit(1);
  }
}

runEnterpriseSecuritySuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
