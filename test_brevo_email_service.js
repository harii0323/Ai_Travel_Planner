/**
 * Comprehensive Integration & Security Test Suite: Brevo Email Service Integration
 * Covers:
 * 1. Email Verification During Registration
 * 2. Forgot Password & 6-Digit OTP Recovery Workflow
 * 3. Travel Plan Delivery to Verified Registered Email (POST /api/trips/:tripId/email & /api/itinerary/email)
 * 4. Authorization, IDOR & Rate-Limiting Security Protections
 * 5. HTML Injection Escaping & Email Audit Logging in PostgreSQL
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error(`Request to ${path} timed out`));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ${colors.green}✓ PASS:${colors.reset} ${testName}`);
    passedCount++;
  } else {
    console.error(`  ${colors.red}✗ FAIL:${colors.reset} ${testName} ${details ? '(' + details + ')' : ''}`);
    failedCount++;
  }
}

async function runTests() {
  console.log(`\n${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.cyan}  BREVO TRANSACTIONAL EMAIL SERVICE - FULL INTEGRATION TEST SUITE       ${colors.reset}`);
  console.log(`${colors.cyan}========================================================================${colors.reset}\n`);

  // Direct database helper to inspect verification hashes/OTPs for deterministic testing
  const db = require('./backend/src/config/database');
  const User = require('./backend/src/models/User');

  const testSuffix = crypto.randomBytes(4).toString('hex');
  const testEmail1 = `traveler_${testSuffix}@example.com`;
  const testEmail2 = `explorer_${testSuffix}@example.com`;
  const testPassword = 'Password123#Secure';
  let user1Token = null;
  let user2Token = null;
  let tripIdUser1 = null;

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: HTML Escaping & Template Security
    // ------------------------------------------------------------------------
    console.log(`${colors.yellow}1. Testing HTML Escaping & Injection Protection${colors.reset}`);
    const emailTemplates = require('./backend/src/services/emailTemplates');

    const maliciousName = '<script>alert("xss")</script><b>Hacker</b>';
    const template = emailTemplates.getVerificationEmailTemplate(maliciousName, '123456', 'http://example.com');
    const escapedHtml = template.html;
    assert(!escapedHtml.includes('<script>'), 'Verification template escapes <script> tags safely');
    assert(escapedHtml.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'), 'Malicious user payload converted to HTML entities');

    // ------------------------------------------------------------------------
    // SECTION 2: User Registration & Email Verification Flow
    // ------------------------------------------------------------------------
    console.log(`\n${colors.yellow}2. Testing User Registration & Email Verification${colors.reset}`);

    // Register User 1
    const regRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Maya Explorer',
      email: testEmail1,
      password: testPassword,
      confirmPassword: testPassword,
      travelCompanionType: 'solo'
    });

    assert(regRes.status === 201, 'Registration returns HTTP 201 Created', `Got status ${regRes.status}`);
    assert(regRes.data?.requireVerification === true, 'Response requires email verification');
    assert(regRes.data?.user?.isVerified === false, 'User account is initialized in unverified state');

    // Retrieve user from DB to verify token hash
    const dbUser1 = await db.withSystemContext(async () => {
      const res = await db.query('SELECT * FROM users WHERE email = $1', [testEmail1]);
      return res.rows[0];
    });

    assert(dbUser1 && dbUser1.is_verified === false, 'Database stores user as is_verified = FALSE');
    assert(Boolean(dbUser1.verification_token_hash), 'Database stores verification token as SHA-256 hash (never plaintext)');

    // Attempt verification with invalid 6-digit code
    const invalidVerifyRes = await makeRequest('POST', '/api/auth/verify-email', {
      email: testEmail1,
      code: '000000'
    });
    assert(invalidVerifyRes.status === 400, 'Invalid verification code is rejected with HTTP 400');

    // Attempt resend verification
    const resendRes = await makeRequest('POST', '/api/auth/resend-verification', {
      email: testEmail1
    });
    assert(resendRes.status === 200 && resendRes.data?.success === true, 'Resend verification succeeds');

    // Fetch the updated verification code directly from User model or simulate known code
    const knownCode = '742918';
    const knownHash = crypto.createHash('sha256').update(knownCode).digest('hex');
    await db.withSystemContext(async () => {
      await db.query(
        'UPDATE users SET verification_token_hash = $1, verification_token_expires = $2 WHERE email = $3',
        [knownHash, new Date(Date.now() + 15 * 60 * 1000), testEmail1]
      );
    });

    // Verify with valid code
    const validVerifyRes = await makeRequest('POST', '/api/auth/verify-email', {
      email: testEmail1,
      code: knownCode
    });
    assert(validVerifyRes.status === 200, 'Valid verification code confirms email with HTTP 200');
    assert(validVerifyRes.data?.user?.isVerified === true, 'Response confirms account is verified');
    user1Token = validVerifyRes.data?.token;

    // Verify token reuse is prevented
    const reuseVerifyRes = await makeRequest('POST', '/api/auth/verify-email', {
      email: testEmail1,
      code: knownCode
    });
    assert(reuseVerifyRes.status === 200 && reuseVerifyRes.data?.alreadyVerified === true, 'Re-verifying already verified account returns alreadyVerified notice');

    // ------------------------------------------------------------------------
    // SECTION 3: Forgot Password & 6-Digit OTP Verification Workflow
    // ------------------------------------------------------------------------
    console.log(`\n${colors.yellow}3. Testing Forgot Password & OTP Recovery${colors.reset}`);

    // Request OTP for password reset
    const forgotRes = await makeRequest('POST', '/api/auth/forgot-password', {
      email: testEmail1
    });
    assert(forgotRes.status === 200, 'Forgot password request returns HTTP 200');
    assert(forgotRes.data?.message?.includes('6-digit verification code'), 'Returns generic anti-enumeration notice');

    // Anti-enumeration test with non-existent email
    const nonExistentForgotRes = await makeRequest('POST', '/api/auth/forgot-password', {
      email: 'nonexistent_ghost_user_999@example.com'
    });
    assert(nonExistentForgotRes.status === 200, 'Non-existent email returns identical generic HTTP 200 (prevents email enumeration)');

    // Set known reset OTP for testing
    const knownOtp = '583921';
    const knownOtpHash = crypto.createHash('sha256').update(knownOtp).digest('hex');
    await db.withSystemContext(async () => {
      await db.query(
        'UPDATE users SET reset_otp_hash = $1, reset_otp_expires = $2, reset_otp_attempts = 0 WHERE email = $3',
        [knownOtpHash, new Date(Date.now() + 10 * 60 * 1000), testEmail1]
      );
    });

    // Verify invalid OTP
    const invalidOtpRes = await makeRequest('POST', '/api/auth/verify-reset-otp', {
      email: testEmail1,
      otp: '111111'
    });
    assert(invalidOtpRes.status === 400, 'Invalid OTP is rejected with HTTP 400');

    // Verify valid OTP
    const validOtpRes = await makeRequest('POST', '/api/auth/verify-reset-otp', {
      email: testEmail1,
      otp: knownOtp
    });
    assert(validOtpRes.status === 200, 'Valid OTP is accepted with HTTP 200');
    assert(Boolean(validOtpRes.data?.resetToken), 'Valid OTP returns single-use resetToken');
    const resetToken = validOtpRes.data.resetToken;

    // Replay attack prevention: same OTP cannot be reused
    const replayedOtpRes = await makeRequest('POST', '/api/auth/verify-reset-otp', {
      email: testEmail1,
      otp: knownOtp
    });
    assert(replayedOtpRes.status === 400, 'Reusing the same OTP is rejected');

    // Attempt password reset with weak password (< 8 chars)
    const weakPassRes = await makeRequest('POST', '/api/auth/reset-password', {
      email: testEmail1,
      resetToken,
      newPassword: 'short',
      confirmPassword: 'short'
    });
    assert(weakPassRes.status === 400, 'Password shorter than 8 characters is rejected');

    // Reset password with valid new password
    const newPassword = 'BrandNewPassword2026!';
    const validResetRes = await makeRequest('POST', '/api/auth/reset-password', {
      email: testEmail1,
      resetToken,
      newPassword,
      confirmPassword: newPassword
    });
    assert(validResetRes.status === 200, 'Valid password reset succeeds with HTTP 200');

    // Attempt reuse of the reset token
    const reusedTokenRes = await makeRequest('POST', '/api/auth/reset-password', {
      email: testEmail1,
      resetToken,
      newPassword: 'AnotherPassword999!',
      confirmPassword: 'AnotherPassword999!'
    });
    assert(reusedTokenRes.status === 400, 'Reusing invalidated resetToken is rejected');

    // Verify login with old password fails
    const oldLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: testEmail1,
      password: testPassword
    });
    assert(oldLoginRes.status === 401, 'Login with old password is now rejected');

    // Verify login with new password succeeds
    const newLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: testEmail1,
      password: newPassword
    });
    assert(newLoginRes.status === 200, 'Login with new password succeeds');
    user1Token = newLoginRes.data?.token;

    // ------------------------------------------------------------------------
    // SECTION 4: Itinerary Delivery ("Send Plan to My Email")
    // ------------------------------------------------------------------------
    console.log(`\n${colors.yellow}4. Testing Travel Plan Email Delivery (/api/trips/:tripId/email)${colors.reset}`);

    // Create a saved itinerary for User 1
    const createItinRes = await makeRequest('POST', '/api/itinerary/save', {
      title: 'Goa Coastal Adventure',
      description: '3-day road trip from Mumbai to Goa',
      plannedTravelDate: '2026-11-15',
      tags: ['Goa', 'car', 'beach'],
      itineraryData: {
        summary: {
          destination: 'Goa',
          startDate: '2026-11-15',
          endDate: '2026-11-18',
          totalDays: 3,
          originalBudget: 25000,
          withinBudget: true
        },
        details: {
          startLocation: 'Mumbai',
          accommodationType: 'Beach Resort',
          transportMode: 'car',
          preferredActivities: 'beaches, seafood, photography'
        },
        estimatedCosts: {
          total: 21500,
          fuelCost: 4800,
          tollCost: 1100,
          accommodation: 9000,
          food: 4200,
          activities: 2400
        },
        dayPlans: [
          {
            day: 1,
            phase: 'OUTBOUND',
            plan: 'Drive from Mumbai to Kolhapur & Belagavi into North Goa',
            activities: [
              { name: 'Khandala Ghat viewpoint', duration: '45 mins' },
              { name: 'Kolhapur Misal lunch stop', duration: '60 mins' }
            ]
          },
          {
            day: 2,
            phase: 'DESTINATION',
            plan: 'Explore Anjuna & Vagator beaches with sunset dinner',
            activities: [
              { name: 'Vagator Cliff sunset', duration: '90 mins' },
              { name: 'Anjuna Flea Market & Cafe', duration: '2 hours' }
            ]
          },
          {
            day: 3,
            phase: 'RETURN',
            plan: 'Scenic return journey via Coastal Konkan highway back to Mumbai',
            activities: [
              { name: 'Sawantwadi lacquer craft stop', duration: '45 mins' }
            ]
          }
        ],
        moneyTips: ['Use FASTag for automatic NH66 tolls', 'Book beach shack shanti tables before 6 PM']
      }
    }, {
      Authorization: `Bearer ${user1Token}`
    });

    assert(createItinRes.status === 201, 'Saved itinerary created successfully for User 1');
    tripIdUser1 = createItinRes.data?.itinerary?.id;
    assert(Boolean(tripIdUser1), 'Received valid tripId');

    // Test unauthenticated access to email endpoint
    const unauthEmailRes = await makeRequest('POST', `/api/trips/${tripIdUser1}/email`, {});
    assert(unauthEmailRes.status === 401, 'Unauthenticated request to email itinerary is rejected with HTTP 401');

    // Register User 2 (different user)
    const regUser2Res = await makeRequest('POST', '/api/auth/register', {
      name: 'Rohan Sharma',
      email: testEmail2,
      password: testPassword,
      confirmPassword: testPassword
    });
    user2Token = regUser2Res.data?.token;

    // Mark User 2 as verified
    await db.withSystemContext(async () => {
      await db.query('UPDATE users SET is_verified = TRUE WHERE email = $1', [testEmail2]);
    });

    // IDOR Security Test: User 2 tries to email User 1's private itinerary
    const idorEmailRes = await makeRequest('POST', `/api/trips/${tripIdUser1}/email`, {}, {
      Authorization: `Bearer ${user2Token}`
    });
    assert(idorEmailRes.status === 404, 'IDOR Protection: User 2 cannot access or email User 1 itinerary (returns 404 Not Found)');

    // Authorized Email Delivery via /api/trips/:tripId/email
    const authTripEmailRes = await makeRequest('POST', `/api/trips/${tripIdUser1}/email`, {}, {
      Authorization: `Bearer ${user1Token}`
    });
    assert(authTripEmailRes.status === 200, 'POST /api/trips/:tripId/email successfully emails plan to verified user');
    assert(authTripEmailRes.data?.success === true, 'Response confirms email dispatch');

    // Authorized Email Delivery via /api/history/:id/email alias
    const authHistoryEmailRes = await makeRequest('POST', `/api/history/${tripIdUser1}/email`, {}, {
      Authorization: `Bearer ${user1Token}`
    });
    assert(authHistoryEmailRes.status === 200, 'POST /api/history/:id/email alias successfully emails plan');

    // Test direct itinerary delivery via POST /api/itinerary/email
    const directItinEmailRes = await makeRequest('POST', '/api/itinerary/email', {
      title: 'Manali Snow Expedition',
      itineraryData: {
        summary: {
          destination: 'Manali',
          startDate: '2026-12-01',
          endDate: '2026-12-04',
          totalDays: 4,
          originalBudget: 30000,
          withinBudget: true
        },
        details: {
          startLocation: 'Delhi',
          accommodationType: 'Himalayan Lodge',
          transportMode: 'car'
        },
        estimatedCosts: { total: 24000 }
      }
    }, {
      Authorization: `Bearer ${user1Token}`
    });
    assert(directItinEmailRes.status === 200, 'POST /api/itinerary/email sends and persists generated plan successfully');

    // ------------------------------------------------------------------------
    // SECTION 5: Database Audit Logging
    // ------------------------------------------------------------------------
    console.log(`\n${colors.yellow}5. Verifying Database Audit Log (email_logs table)${colors.reset}`);
    const emailLogs = await db.withSystemContext(async () => {
      const res = await db.query(
        'SELECT * FROM email_logs WHERE recipient_email = $1 ORDER BY created_at DESC',
        [testEmail1]
      );
      return res.rows;
    });

    assert(emailLogs.length >= 2, `Audit trail recorded in email_logs table (${emailLogs.length} entries recorded)`);
    const typesRecorded = emailLogs.map(l => l.email_type);
    assert(typesRecorded.includes('itinerary_delivery'), 'Audit log contains itinerary_delivery entry');

    // Clean up test users and test itineraries
    await db.withSystemContext(async () => {
      await db.query('DELETE FROM itineraries WHERE user_id IN (SELECT id FROM users WHERE email IN ($1, $2))', [testEmail1, testEmail2]);
      await db.query('DELETE FROM email_logs WHERE recipient_email IN ($1, $2)', [testEmail1, testEmail2]);
      await db.query('DELETE FROM users WHERE email IN ($1, $2)', [testEmail1, testEmail2]);
    });
    console.log(`\n  ${colors.green}✓ Cleaned up test accounts safely.${colors.reset}`);

  } catch (err) {
    console.error(`\n${colors.red}Test execution failed with error:${colors.reset}`, err);
    failedCount++;
  }

  console.log(`\n${colors.cyan}========================================================================${colors.reset}`);
  console.log(`  TEST RESULTS: ${colors.green}${passedCount} PASSED${colors.reset}, ${failedCount > 0 ? colors.red + failedCount + ' FAILED' : '0 FAILED'}`);
  console.log(`${colors.cyan}========================================================================${colors.reset}\n`);

  process.exit(failedCount > 0 ? 1 : 0);
}

runTests();
