const BASE = 'http://localhost:3003/v1';

async function req(method: string, path: string, opts: any = {}) {
  const url = new URL(path, BASE + '/');
  if (opts.query) Object.entries(opts.query).forEach(([k, v]: [string, any]) => { if (v) url.searchParams.set(k, v); });
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, rawHeaders: Object.fromEntries(res.headers) };
}

(async () => {
  // Register seller
  let r = await req('POST', '/auth/register', { body: { email: 'testseller2@example.com', password: 'testpassword123', name: 'Test Seller' } });
  console.log('Register seller:', r.status, JSON.stringify(r.data));

  // Login seller
  r = await req('POST', '/auth/login', { body: { email: 'testseller2@example.com', password: 'testpassword123' } });
  console.log('Login seller:', r.status);
  console.log('Headers:', JSON.stringify(r.rawHeaders));
  const sellerCookie = r.rawHeaders['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('Seller cookie:', sellerCookie);

  // Login buyer
  r = await req('POST', '/auth/login', { body: { email: 'testbuyer@example.com', password: 'testpassword123' } });
  console.log('Login buyer:', r.status);
  const buyerCookie = r.rawHeaders['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('Buyer cookie:', buyerCookie);

  if (!sellerCookie) {
    console.log('No seller cookie, stopping');
    return;
  }

  // Create deal
  r = await req('POST', '/deals', {
    body: {
      source: 'web',
      creator_role: 'seller',
      language: 'en',
      product_title: 'Debug Product',
      product_type: 'electronics',
      amount: 100,
      currency: 'USD',
      creator_name: 'Debug Seller',
      creator_phone: '+85512345678',
    },
    cookie: sellerCookie,
  });
  console.log('Create deal:', r.status, 'status:', r.data?.status);
  const publicId = r.data?.public_id;
  const creatorAccess = new URL(r.data?.creator_access_url).searchParams.get('access');
  const invite = new URL(r.data?.invite_url).searchParams.get('invite');
  console.log('publicId:', publicId, 'invite:', invite?.slice(0, 20));

  // Join as buyer
  r = await req('POST', `/deals/${publicId}/join`, {
    body: { invite_token: invite, role: 'buyer', name: 'Debug Buyer', preferred_language: 'en' },
    query: { invite },
    cookie: buyerCookie,
  });
  console.log('Join deal:', r.status, 'status:', r.data?.status);
  const buyerAccess = r.data?.access_token;

  // Update payout
  r = await req('PATCH', `/deals/${publicId}/sections/payout`, {
    body: { payout_khqr: 'test@aba', payout_bank_name: 'ABA', payout_account_name: 'Test', payout_account_number: '123' },
    query: { access: creatorAccess },
    cookie: sellerCookie,
  });
  console.log('Update payout:', r.status);

  // Approve seller
  r = await req('POST', `/deals/${publicId}/approval`, { query: { access: creatorAccess }, cookie: sellerCookie });
  console.log('Approve seller:', r.status, 'data:', JSON.stringify(r.data));

  // Approve buyer
  r = await req('POST', `/deals/${publicId}/approval`, { query: { access: buyerAccess }, cookie: buyerCookie });
  console.log('Approve buyer:', r.status, 'data:', JSON.stringify(r.data));

  // Payment instruction
  r = await req('GET', `/deals/${publicId}/payment-instruction`, { query: { access: buyerAccess }, cookie: buyerCookie });
  console.log('Payment instruction:', r.status, JSON.stringify(r.data));

  // Upload payment proof
  const fd = new FormData();
  fd.append('paid_amount', '100');
  fd.append('buyer_note', 'test payment');
  r = await req('POST', `/deals/${publicId}/payment-proofs`, { body: fd, query: { access: buyerAccess }, cookie: buyerCookie });
  console.log('Payment proof:', r.status, JSON.stringify(r.data));
})();
