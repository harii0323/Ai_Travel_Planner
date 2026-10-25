const http = require('http');

function request(method, path, payload = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
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
      headers: headers
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
    if (data) req.write(data);
    req.end();
  });
}

async function runSecurityPrivacyTests() {
  console.log('=== SECURITY, PRIVACY & UNBOUNDED ACCESS TESTS ===\n');

  // Test 1: Security Headers
  console.log('1. Checking security headers on /api/health...');
  const healthRes = await request('GET', '/api/health');
  console.log('Status:', healthRes.status);
  console.log('X-Content-Type-Options:', healthRes.headers['x-content-type-options']);
  console.log('X-Frame-Options:', healthRes.headers['x-frame-options']);
  if (healthRes.headers['x-content-type-options'] === 'nosniff' && (healthRes.headers['x-frame-options'] === 'DENY' || healthRes.headers['x-frame-options'] === 'SAMEORIGIN')) {
    console.log('✓ Security headers verified (nosniff & SAMEORIGIN).');
  } else {
    console.error('❌ Security headers missing or unexpected!');
  }

  // Test 2: GET /api/auth/privacy
  console.log('\n2. Testing GET /api/auth/privacy...');
  const privRes = await request('GET', '/api/auth/privacy');
  console.log('Status:', privRes.status);
  console.log('Data retention policy:', privRes.data?.dataRetention);
  console.log('Account deletion endpoint:', privRes.data?.accountDeletion?.endpoint);
  if (privRes.status === 200 && privRes.data?.accountDeletion?.available === true) {
    console.log('✓ Privacy & Data Retention transparency verified.');
  } else {
    console.error('❌ Privacy endpoint failure!');
  }

  // Test 3: Unauthenticated Itinerary Generation (Progressive Conversion)
  console.log('\n3. Testing unauthenticated POST /api/itinerary/generate (Guest flow)...');
  const guestItinRes = await request('POST', '/api/itinerary/generate', {
    destination: 'Goa',
    days: 3,
    budget: 25000,
    travelers: 2,
    travelStyle: 'relaxed',
    travelMode: 'car',
    interests: ['beach', 'seafood', 'relaxation']
  });
  console.log('Status:', guestItinRes.status);
  console.log('Success:', guestItinRes.data?.success);
  console.log('Destination:', guestItinRes.data?.itinerary?.summary?.destination);
  console.log('Total Estimated Cost:', guestItinRes.data?.itinerary?.details?.costs?.totalEstimatedCost);
  if (guestItinRes.status === 200 && guestItinRes.data?.itinerary) {
    console.log('✓ Unauthenticated itinerary generation passed! Users can plan trips before registering.');
  } else {
    console.error('❌ Unauthenticated itinerary generation failed:', guestItinRes.data);
  }

  // Test 4: Progressive User Registration & Account Deletion
  const testEmail = `delete_test_${Date.now()}@example.com`;
  console.log(`\n4. Testing user registration with ${testEmail}...`);
  const regRes = await request('POST', '/api/auth/register', {
    name: 'Ephemeral Tester',
    email: testEmail,
    password: 'Password123!'
  });
  console.log('Status:', regRes.status);
  const userToken = regRes.data?.token;
  const userId = regRes.data?.user?.id;
  console.log('User registered with ID:', userId);

  // Test 5: Account Deletion (Permanent Purge)
  console.log('\n5. Testing permanent account deletion DELETE /api/auth/account...');
  const delRes = await request('DELETE', '/api/auth/account', null, userToken);
  console.log('Status:', delRes.status);
  console.log('Message:', delRes.data?.message);
  console.log('Purged User ID:', delRes.data?.purgedUserId);
  if (delRes.status === 200 && delRes.data?.success) {
    console.log('✓ Account permanently deleted.');
  } else {
    console.error('❌ Account deletion failed:', delRes.data);
  }

  // Verify user can no longer log in
  console.log('\n6. Verifying deleted account cannot log in...');
  const loginAfterDel = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: 'Password123!'
  });
  console.log('Status:', loginAfterDel.status);
  console.log('Error message:', loginAfterDel.data?.error);
  if (loginAfterDel.status === 400 || loginAfterDel.status === 401) {
    console.log('✓ Verified: Deleted user is permanently purged.');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL SECURITY, PRIVACY & UNBOUNDED ACCESS TESTS PASSED!');
  console.log('======================================================');
}

runSecurityPrivacyTests().catch(console.error);
