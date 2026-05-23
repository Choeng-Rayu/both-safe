/**
 * Comprehensive API Test Suite for BothSafe Backend
 * Tests all endpoints: deals, payments, shipping, disputes, admin, auth
 * Run with: npx ts-node --transpile-only test/api-comprehensive.test.ts
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3003/v1';
const BASE_HOST = BASE_URL.replace(/\/v1\/?$/, '');

// Test state
const state: {
  adminToken?: string;
  sessionCookie?: string;
  buyerSessionCookie?: string;
  creatorAccessToken?: string;
  inviteToken?: string;
  participantAccessToken?: string;
  dealPublicId?: string;
  paymentId?: string;
  shippingId?: string;
  disputeId?: string;
  userId?: string;
  buyerUserId?: string;
  errors: string[];
  passed: number;
  failed: number;
} = {
  errors: [],
  passed: 0,
  failed: 0,
};

async function request(
  method: string,
  path: string,
  opts: {
    body?: any;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    cookie?: string;
  } = {},
) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const base = BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/';
  const url = new URL(normalizedPath, base);
  if (opts.query) {
    Object.entries(opts.query).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (
    opts.body &&
    typeof opts.body === 'object' &&
    !(opts.body instanceof FormData)
  ) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.cookie) {
    headers['Cookie'] = opts.cookie;
  }
  const res = await fetch(url.toString(), {
    method,
    headers,
    body:
      opts.body instanceof FormData
        ? opts.body
        : opts.body
          ? JSON.stringify(opts.body)
          : undefined,
  });
  const data = await res.json().catch(() => null);
  // Capture session cookie if present
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && setCookie.includes('bothsafe_session')) {
    state.sessionCookie = setCookie.split(';')[0];
  }
  return { status: res.status, data, headers: res.headers };
}

async function requestRaw(
  base: string,
  method: string,
  path: string,
  opts: {
    body?: any;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    cookie?: string;
  } = {},
) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const baseWithSlash = base.endsWith('/') ? base : base + '/';
  const url = new URL(normalizedPath, baseWithSlash);
  if (opts.query) {
    Object.entries(opts.query).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (
    opts.body &&
    typeof opts.body === 'object' &&
    !(opts.body instanceof FormData)
  ) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.cookie) {
    headers['Cookie'] = opts.cookie;
  }
  const res = await fetch(url.toString(), {
    method,
    headers,
    body:
      opts.body instanceof FormData
        ? opts.body
        : opts.body
          ? JSON.stringify(opts.body)
          : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

function assert(condition: boolean, message: string) {
  if (condition) {
    state.passed++;
    process.stdout.write('.');
  } else {
    state.failed++;
    state.errors.push(`FAIL: ${message}`);
    process.stdout.write('F');
  }
}

function assertEq(actual: any, expected: any, message: string) {
  assert(
    actual === expected,
    `${message} | expected: ${expected}, got: ${actual}`,
  );
}

function assertHas(obj: any, key: string, message: string) {
  assert(
    obj && typeof obj === 'object' && key in obj,
    `${message} | missing key: ${key}`,
  );
}

function assertStatus(
  res: { status: number },
  expected: number,
  message: string,
) {
  assertEq(res.status, expected, `${message} | status`);
}

function assertOk(res: { status: number; data: any }, message: string) {
  assertStatus(res, 200, message);
  assertHas(res.data, 'status', `${message} | response has status`);
}

// ======== TESTS ========

async function testHealth() {
  const res = await request('GET', '/health');
  assertStatus(res, 200, 'Health check');
  assertEq(res.data?.status, 'ok', 'Health status is ok');
  assertEq(res.data?.db, true, 'DB is healthy');
}

async function testAdminAuth() {
  const res = await request('POST', '/auth/admin/login', {
    body: { email: 'admin@bothsafe.local', password: 'admin12345' },
  });
  assertStatus(res, 200, 'Admin login');
  assertHas(res.data, 'token', 'Admin login returns token');
  state.adminToken = res.data?.token;
}

async function testUserRegister() {
  const res = await request('POST', '/auth/register', {
    body: {
      email: 'testseller@example.com',
      password: 'testpassword123',
      name: 'Test Seller',
    },
  });
  // May be 409 if user already exists
  assert(
    [201, 409].includes(res.status),
    `Seller register returns 201 or 409, got ${res.status}`,
  );
  if (res.status === 201) {
    assertHas(res.data, 'user', 'Register returns user');
    state.userId = res.data?.user?.id;
  }
}

async function testUserLogin() {
  const res = await request('POST', '/auth/login', {
    body: { email: 'testseller@example.com', password: 'testpassword123' },
  });
  assertStatus(res, 200, 'Seller login');
  assertHas(res.data, 'user', 'Login returns user');
  assert(state.sessionCookie !== undefined, 'Login sets session cookie');
}

async function testBuyerRegister() {
  const res = await request('POST', '/auth/register', {
    body: {
      email: 'testbuyer@example.com',
      password: 'testpassword123',
      name: 'Test Buyer',
    },
  });
  assert(
    [201, 409].includes(res.status),
    `Buyer register returns 201 or 409, got ${res.status}`,
  );
  if (res.status === 201) {
    state.buyerUserId = res.data?.user?.id;
  }
}

async function testBuyerLogin() {
  const res = await request('POST', '/auth/login', {
    body: { email: 'testbuyer@example.com', password: 'testpassword123' },
  });
  assertStatus(res, 200, 'Buyer login');
  assertHas(res.data, 'user', 'Buyer login returns user');
  // Capture buyer cookie manually since request() only stores to state.sessionCookie
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && setCookie.includes('bothsafe_session')) {
    state.buyerSessionCookie = setCookie.split(';')[0];
  }
  assert(
    state.buyerSessionCookie !== undefined,
    'Buyer login sets session cookie',
  );
}

async function testGetMe() {
  const res = await request('GET', '/auth/me', { cookie: state.sessionCookie });
  assertStatus(res, 200, 'Get current user');
  assertHas(res.data, 'user', 'Get me returns user');
}

async function testAdminDealList() {
  const res = await request('GET', '/admin/deals', {
    headers: { Authorization: `Bearer ${state.adminToken}` },
  });
  assertStatus(res, 200, 'Admin list deals');
  assertHas(res.data, 'items', 'Admin deals response has items key');
  assert(Array.isArray(res.data?.items), 'Admin deals is array');
}

async function testCreateDeal() {
  const res = await request('POST', '/deals', {
    body: {
      source: 'web',
      creator_role: 'seller',
      language: 'en',
      product_title: 'Test Product',
      product_type: 'electronics',
      product_description: 'A test product for API testing',
      amount: 100,
      currency: 'USD',
      creator_name: 'Test Seller',
      creator_phone: '+85512345678',
    },
    cookie: state.sessionCookie,
  });
  assertStatus(res, 201, 'Create deal');
  assertHas(res.data, 'public_id', 'Create deal returns public_id');
  assertHas(
    res.data,
    'creator_access_url',
    'Create deal returns creator_access_url',
  );
  assertHas(res.data, 'invite_url', 'Create deal returns invite_url');
  assertHas(res.data, 'status', 'Create deal returns status');
  assertHas(res.data, 'message_key', 'Create deal returns message_key');
  assertHas(res.data, 'missing_fields', 'Create deal returns missing_fields');
  assertHas(res.data, 'allowed_actions', 'Create deal returns allowed_actions');
  assertEq(
    res.data?.status,
    'AWAITING_COUNTERPARTY',
    'Seller-created deal status is AWAITING_COUNTERPARTY',
  );

  state.dealPublicId = res.data?.public_id;
  const creatorUrl = res.data?.creator_access_url as string;
  const inviteUrl = res.data?.invite_url as string;
  state.creatorAccessToken =
    new URL(creatorUrl).searchParams.get('access') || undefined;
  state.inviteToken =
    new URL(inviteUrl).searchParams.get('invite') || undefined;
}

async function testGetDealAsCreator() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request('GET', `/deals/${state.dealPublicId}`, {
    query: { access: state.creatorAccessToken },
  });
  assertStatus(res, 200, 'Get deal as creator');
  assertHas(res.data, 'public_id', 'Get deal has public_id');
  assertHas(res.data, 'status', 'Get deal has status');
  assertHas(res.data, 'participants', 'Get deal has participants');
  assertHas(res.data, 'product', 'Get deal has product');
  assertHas(res.data, 'allowed_actions', 'Get deal has allowed_actions');
  assertHas(res.data, 'missing_fields', 'Get deal has missing_fields');
  assertHas(res.data, 'payment_summary', 'Get deal has payment_summary');
  assertHas(res.data, 'timeline', 'Get deal has timeline');
  assertEq(
    res.data?.public_id,
    state.dealPublicId,
    'Get deal public_id matches',
  );
}

async function testGetDealAsInvite() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request('GET', `/deals/${state.dealPublicId}`, {
    query: { invite: state.inviteToken },
  });
  assertStatus(res, 200, 'Get deal with invite token');
  assertHas(res.data, 'public_id', 'Invite preview has public_id');
  assertEq(
    res.data?.public_id,
    state.dealPublicId,
    'Invite preview public_id matches',
  );
}

async function testJoinDeal() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request('POST', `/deals/${state.dealPublicId}/join`, {
    body: {
      invite_token: state.inviteToken,
      role: 'buyer',
      name: 'Test Buyer',
      phone: '+85587654321',
      preferred_language: 'en',
    },
    query: { invite: state.inviteToken },
    cookie: state.buyerSessionCookie,
  });
  assertStatus(res, 201, 'Join deal as buyer');
  assertHas(res.data, 'access_token', 'Join returns access_token');
  assertHas(
    res.data,
    'participant_access_url',
    'Join returns participant_access_url',
  );
  assertHas(res.data, 'status', 'Join returns status');
  assertHas(res.data, 'allowed_actions', 'Join returns allowed_actions');
  assertHas(res.data, 'missing_fields', 'Join returns missing_fields');
  assertEq(
    res.data?.status,
    'AWAITING_BOTH_APPROVAL',
    'Join deal status is AWAITING_BOTH_APPROVAL',
  );

  state.participantAccessToken = res.data?.access_token;
}

async function testUpdateProduct() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request(
    'PATCH',
    `/deals/${state.dealPublicId}/sections/product`,
    {
      body: {
        title: 'Updated Test Product',
        type: 'electronics',
        description: 'Updated description',
        amount: 150,
        currency: 'USD',
      },
      query: { access: state.creatorAccessToken },
      cookie: state.sessionCookie,
    },
  );
  assertStatus(res, 200, 'Update product');
  assertHas(res.data, 'status', 'Update product returns status');
  assertHas(
    res.data,
    'allowed_actions',
    'Update product returns allowed_actions',
  );
  assertEq(
    res.data?.product?.title,
    'Updated Test Product',
    'Product title updated',
  );
}

async function testUpdateParticipant() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request(
    'PATCH',
    `/deals/${state.dealPublicId}/sections/participant`,
    {
      body: {
        name: 'Updated Seller Name',
        phone: '+85599999999',
      },
      query: { access: state.creatorAccessToken },
      cookie: state.sessionCookie,
    },
  );
  assertStatus(res, 200, 'Update participant');
  assertHas(
    res.data,
    'participants',
    'Update participant returns participants',
  );
}

async function testUpdatePayout() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request(
    'PATCH',
    `/deals/${state.dealPublicId}/sections/payout`,
    {
      body: {
        payout_khqr: 'test@aba',
        payout_bank_name: 'ABA Bank',
        payout_account_name: 'Test Seller',
        payout_account_number: '123456789',
      },
      query: { access: state.creatorAccessToken },
      cookie: state.sessionCookie,
    },
  );
  assertStatus(res, 200, 'Update payout');
  assertHas(res.data, 'participants', 'Update payout returns participants');
  const seller = res.data?.participants?.find((p: any) => p.role === 'seller');
  assert(seller?.has_payout, 'Seller has payout after update');
}

async function testApproveAsSeller() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request('POST', `/deals/${state.dealPublicId}/approval`, {
    query: { access: state.creatorAccessToken },
    cookie: state.sessionCookie,
  });
  assertStatus(res, 201, 'Seller approves deal');
  assertHas(res.data, 'status', 'Approve returns status');
  assertHas(res.data, 'message_key', 'Approve returns message_key');
}

async function testApproveAsBuyer() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request('POST', `/deals/${state.dealPublicId}/approval`, {
    query: { access: state.participantAccessToken },
    cookie: state.buyerSessionCookie,
  });
  assertStatus(res, 201, 'Buyer approves deal');
  assertHas(res.data, 'status', 'Buyer approve returns status');
  assertHas(res.data, 'message_key', 'Buyer approve returns message_key');
  assertEq(
    res.data?.status,
    'READY_FOR_PAYMENT',
    'Status after both approve is READY_FOR_PAYMENT',
  );
}

async function testPaymentInstruction() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request(
    'GET',
    `/deals/${state.dealPublicId}/payment-instruction`,
    {
      query: { access: state.participantAccessToken },
      cookie: state.buyerSessionCookie,
    },
  );
  assertStatus(res, 200, 'Get payment instruction');
  assertHas(res.data, 'method', 'Payment instruction has method');
  assertHas(res.data, 'currency', 'Payment instruction has currency');
  assertHas(
    res.data,
    'expected_amount',
    'Payment instruction has expected_amount',
  );
  assertHas(res.data, 'khqr_string', 'Payment instruction has khqr_string');
  assertEq(res.data?.method, 'bakong_khqr', 'Payment method is bakong_khqr');
}

async function testUploadPaymentProof() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const formData = new FormData();
  formData.append('paid_amount', '150');
  formData.append('buyer_note', 'Payment sent via Bakong');

  const res = await request(
    'POST',
    `/deals/${state.dealPublicId}/payment-proofs`,
    {
      body: formData,
      query: { access: state.participantAccessToken },
      cookie: state.buyerSessionCookie,
    },
  );
  assertStatus(res, 201, 'Upload payment proof');
  assertHas(res.data, 'payment_id', 'Upload payment proof returns payment_id');
  assertHas(res.data, 'status', 'Upload payment proof returns status');
  assertHas(
    res.data,
    'message_key',
    'Upload payment proof returns message_key',
  );
  assertEq(
    res.data?.status,
    'PAYMENT_PENDING_VERIFICATION',
    'Status after payment upload',
  );

  state.paymentId = res.data?.payment_id;
}

async function testAdminVerifyPayment() {
  if (!state.paymentId) {
    assert(false, 'No payment uploaded');
    return;
  }
  const res = await request(
    'POST',
    `/admin/payment-proofs/${state.paymentId}/verify`,
    {
      headers: { Authorization: `Bearer ${state.adminToken}` },
    },
  );
  assertStatus(res, 201, 'Admin verify payment');
  assertHas(res.data, 'deal_status', 'Verify payment returns deal_status');
  assertEq(
    res.data?.deal_status,
    'SELLER_PREPARING',
    'Status after admin verify',
  );
}

async function testUploadShippingProof() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const formData = new FormData();
  formData.append('delivery_company', 'Kerry Express');
  formData.append('tracking_number', 'TRACK123456');
  formData.append('seller_note', 'Shipped today');

  const res = await request(
    'POST',
    `/deals/${state.dealPublicId}/shipping-proofs`,
    {
      body: formData,
      query: { access: state.creatorAccessToken },
      cookie: state.sessionCookie,
    },
  );
  assertStatus(res, 201, 'Upload shipping proof');
  assertHas(res.data, 'shipping_id', 'Upload shipping returns shipping_id');
  assertHas(res.data, 'status', 'Upload shipping returns status');
  assertEq(res.data?.status, 'SHIPPED', 'Status after shipping upload');

  state.shippingId = res.data?.shipping_id;
}

async function testConfirmReceived() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request(
    'POST',
    `/deals/${state.dealPublicId}/confirm-received`,
    {
      query: { access: state.participantAccessToken },
      cookie: state.buyerSessionCookie,
    },
  );
  assertStatus(res, 201, 'Confirm received');
  assertHas(res.data, 'status', 'Confirm received returns status');
  assertHas(res.data, 'message_key', 'Confirm received returns message_key');
  assertEq(
    res.data?.status,
    'RELEASE_PENDING',
    'Status after confirm received',
  );
}

async function testOpenDispute() {
  // Create a new deal for dispute test
  const createRes = await request('POST', '/deals', {
    body: {
      source: 'web',
      creator_role: 'seller',
      language: 'en',
      product_title: 'Dispute Test Product',
      product_type: 'electronics',
      amount: 50,
      currency: 'USD',
      creator_name: 'Dispute Seller',
    },
    cookie: state.sessionCookie,
  });
  assertStatus(createRes, 201, 'Create deal for dispute test');
  const publicId = createRes.data?.public_id;
  const invite = new URL(createRes.data?.invite_url as string).searchParams.get(
    'invite',
  );

  // Join as buyer (with buyer session)
  const joinRes = await request('POST', `/deals/${publicId}/join`, {
    body: {
      invite_token: invite,
      role: 'buyer',
      name: 'Dispute Buyer',
      preferred_language: 'en',
    },
    query: { invite },
    cookie: state.buyerSessionCookie,
  });
  assertStatus(joinRes, 201, 'Join for dispute test');
  const buyerToken = joinRes.data?.access_token;

  // Approve as seller
  const sellerAccess = new URL(
    createRes.data?.creator_access_url as string,
  ).searchParams.get('access');
  await request('POST', `/deals/${publicId}/approval`, {
    query: { access: sellerAccess },
    cookie: state.sessionCookie,
  });

  // Update payout so deal can reach READY_FOR_PAYMENT
  await request('PATCH', `/deals/${publicId}/sections/payout`, {
    body: {
      payout_khqr: 'test@aba',
      payout_bank_name: 'ABA',
      payout_account_name: 'Test',
      payout_account_number: '123',
    },
    query: { access: sellerAccess },
    cookie: state.sessionCookie,
  });

  // Approve as buyer
  await request('POST', `/deals/${publicId}/approval`, {
    query: { access: buyerToken },
    cookie: state.buyerSessionCookie,
  });

  // Upload payment as buyer
  const paymentForm = new FormData();
  paymentForm.append('paid_amount', '50');
  const paymentRes = await request(
    'POST',
    `/deals/${publicId}/payment-proofs`,
    {
      body: paymentForm,
      query: { access: buyerToken },
      cookie: state.buyerSessionCookie,
    },
  );
  assertStatus(paymentRes, 201, 'Upload payment for dispute test');

  // Verify payment as admin
  const paymentId = paymentRes.data?.payment_id;
  await request('POST', `/admin/payment-proofs/${paymentId}/verify`, {
    headers: { Authorization: `Bearer ${state.adminToken}` },
  });

  // Upload shipping as seller
  const shipForm = new FormData();
  shipForm.append('delivery_company', 'Test');
  shipForm.append('tracking_number', 'TEST123');
  await request('POST', `/deals/${publicId}/shipping-proofs`, {
    body: shipForm,
    query: { access: sellerAccess },
    cookie: state.sessionCookie,
  });

  // Open dispute as buyer
  const disputeRes = await request('POST', `/deals/${publicId}/disputes`, {
    body: { reason: 'ITEM_NOT_RECEIVED', message: 'I never received the item' },
    query: { access: buyerToken },
    cookie: state.buyerSessionCookie,
  });
  assertStatus(disputeRes, 201, 'Open dispute');
  assertHas(disputeRes.data, 'dispute_id', 'Open dispute returns dispute_id');
  assertHas(disputeRes.data, 'status', 'Open dispute returns status');
  assertEq(disputeRes.data?.status, 'DISPUTED', 'Status after dispute');

  state.disputeId = disputeRes.data?.dispute_id;
}

async function testAdminRefund() {
  // Get the disputed deal
  const listRes = await request('GET', '/admin/deals?status=DISPUTED', {
    headers: { Authorization: `Bearer ${state.adminToken}` },
  });
  assertStatus(listRes, 200, 'Admin list disputed deals');
  const disputedDeal = listRes.data?.items?.[0];
  if (!disputedDeal) {
    assert(false, 'No disputed deal found for refund test');
    return;
  }

  const res = await request('POST', `/admin/deals/${disputedDeal.id}/refund`, {
    body: {
      refund_reference: 'REFUND-TEST-001',
      admin_note: 'Testing refund flow',
    },
    headers: { Authorization: `Bearer ${state.adminToken}` },
  });
  assertStatus(res, 201, 'Admin refund');
  assertHas(res.data, 'status', 'Refund returns status');
  assertEq(res.data?.status, 'REFUNDED', 'Refund status is REFUNDED');
}

async function testDealNotFound() {
  const res = await request('GET', '/deals/NONEXISTENT123');
  assertStatus(res, 401, 'Get nonexistent deal returns 401 (no auth)');
}

async function testInvalidToken() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request('GET', `/deals/${state.dealPublicId}`, {
    query: { access: 'invalid_token_12345' },
  });
  assertStatus(res, 401, 'Invalid token returns 401');
}

async function testValidationErrors() {
  const res = await request('POST', '/auth/register', {
    body: { email: 'not-an-email', password: '123' },
  });
  assertStatus(res, 400, 'Validation errors return 400');
  assertHas(res.data, 'message', 'Validation error has message');
}

async function testGetMyDeals() {
  const res = await request('GET', '/users/me/deals', {
    cookie: state.sessionCookie || '',
  });
  assertStatus(res, 200, 'Get my deals');
  assertHas(res.data, 'created', 'Get my deals has created');
}

async function testAdminAuditLog() {
  if (!state.dealPublicId) {
    assert(false, 'No deal created');
    return;
  }
  const res = await request(
    'GET',
    `/admin/deals/${state.dealPublicId}/audit-log`,
    {
      headers: { Authorization: `Bearer ${state.adminToken}` },
    },
  );
  assertStatus(res, 200, 'Admin audit log');
  assert(Array.isArray(res.data), 'Audit log is array');
}

async function testSwaggerDocs() {
  // Swagger is mounted at /docs, not under /v1
  const res = await fetch(`${BASE_HOST}/docs`);
  assertEq(res.status, 200, 'Swagger docs accessible');
  const text = await res.text();
  assert(
    text.includes('swagger') || text.includes('Swagger'),
    'Swagger docs HTML contains swagger',
  );
}

async function testCorsHeaders() {
  const res = await fetch(`${BASE_URL}/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET',
    },
  });
  assert(
    res.status === 204 ||
      res.headers.get('access-control-allow-origin') !== null,
    'CORS headers present',
  );
}

// ======== RUN ALL TESTS ========

async function runTests() {
  console.log(`\nBothSafe Backend API Test Suite`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const tests = [
    { name: 'Health Check', fn: testHealth },
    { name: 'Admin Auth', fn: testAdminAuth },
    { name: 'Seller Register', fn: testUserRegister },
    { name: 'Seller Login', fn: testUserLogin },
    { name: 'Buyer Register', fn: testBuyerRegister },
    { name: 'Buyer Login', fn: testBuyerLogin },
    { name: 'Get Me', fn: testGetMe },
    { name: 'Admin Deal List', fn: testAdminDealList },
    { name: 'Create Deal', fn: testCreateDeal },
    { name: 'Get Deal as Creator', fn: testGetDealAsCreator },
    { name: 'Get Deal as Invite', fn: testGetDealAsInvite },
    { name: 'Join Deal', fn: testJoinDeal },
    { name: 'Update Product', fn: testUpdateProduct },
    { name: 'Update Participant', fn: testUpdateParticipant },
    { name: 'Update Payout', fn: testUpdatePayout },
    { name: 'Approve as Seller', fn: testApproveAsSeller },
    { name: 'Approve as Buyer', fn: testApproveAsBuyer },
    { name: 'Payment Instruction', fn: testPaymentInstruction },
    { name: 'Upload Payment Proof', fn: testUploadPaymentProof },
    { name: 'Admin Verify Payment', fn: testAdminVerifyPayment },
    { name: 'Upload Shipping Proof', fn: testUploadShippingProof },
    { name: 'Confirm Received', fn: testConfirmReceived },
    { name: 'Open Dispute', fn: testOpenDispute },
    { name: 'Admin Refund', fn: testAdminRefund },
    { name: 'Deal Not Found', fn: testDealNotFound },
    { name: 'Invalid Token', fn: testInvalidToken },
    { name: 'Validation Errors', fn: testValidationErrors },
    { name: 'Get My Deals', fn: testGetMyDeals },
    { name: 'Admin Audit Log', fn: testAdminAuditLog },
    { name: 'Swagger Docs', fn: testSwaggerDocs },
    { name: 'CORS Headers', fn: testCorsHeaders },
  ];

  for (const test of tests) {
    try {
      await test.fn();
    } catch (err: any) {
      state.failed++;
      state.errors.push(`ERROR in ${test.name}: ${err.message}`);
      process.stdout.write('E');
    }
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log(
    `Total: ${state.passed + state.failed} | Passed: ${state.passed} | Failed: ${state.failed}`,
  );
  console.log('='.repeat(60));

  if (state.errors.length > 0) {
    console.log('\nErrors:');
    state.errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

runTests();
