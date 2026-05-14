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
  // Login seller
  let r = await req('POST', '/auth/login', { body: { email: 'testseller@example.com', password: 'testpassword123' } });
  const sellerCookie = r.rawHeaders['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('Seller login:', r.status, 'cookie:', sellerCookie ? 'yes' : 'no');

  // Login buyer
  r = await req('POST', '/auth/login', { body: { email: 'testbuyer@example.com', password: 'testpassword123' } });
  const buyerCookie = r.rawHeaders['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('Buyer login:', r.status, 'cookie:', buyerCookie ? 'yes' : 'no');

  // Get seller deals
  r = await req('GET', '/users/me/deals', { cookie: sellerCookie });
  console.log('My deals:', r.status, 'created count:', r.data?.created?.length);
  const deal = r.data?.created?.[0];
  if (!deal) {
    console.log('No deals, response:', JSON.stringify(r.data));
    return;
  }
  const publicId = deal.public_id;
  console.log('Deal:', publicId, 'status:', deal.status);

  // Get deal detail
  r = await req('GET', '/deals/' + publicId, { cookie: sellerCookie });
  console.log('Deal detail status:', r.data?.status, 'missing:', r.data?.missing_fields);
  console.log('Participants:', JSON.stringify(r.data?.participants?.map((p: any) => ({ role: p.role, name: p.name, approved_at: p.approved_at }))));

  // Get buyer's access to this deal - need to use invite
  // First let's get invite from deal detail or create new
  // Actually, let's find the buyer participant ID and get access token
  // For now, let's just get deal as buyer using no access token (should fail) or with invite

  // Let's create a new deal and go through full flow with debug
  r = await req('POST', '/deals', {
    body: {
      source: 'web', creator_role: 'seller', language: 'en',
      product_title: 'Debug2 Product', product_type: 'electronics',
      amount: 100, currency: 'USD',
      creator_name: 'Debug Seller', creator_phone: '+85512345678',
    },
    cookie: sellerCookie,
  });
  const newPublicId = r.data?.public_id;
  const creatorAccess = new URL(r.data?.creator_access_url).searchParams.get('access');
  const invite = new URL(r.data?.invite_url).searchParams.get('invite');
  console.log('Created deal:', newPublicId, 'status:', r.data?.status);

  // Join as buyer
  r = await req('POST', `/deals/${newPublicId}/join`, {
    body: { invite_token: invite, role: 'buyer', name: 'Debug Buyer', preferred_language: 'en' },
    query: { invite },
    cookie: buyerCookie,
  });
  const buyerAccess = r.data?.access_token;
  console.log('Join:', r.status, 'status:', r.data?.status, 'access:', buyerAccess?.slice(0, 20));

  // Update payout
  r = await req('PATCH', `/deals/${newPublicId}/sections/payout`, {
    body: { payout_khqr: 'test@aba', payout_bank_name: 'ABA', payout_account_name: 'Test', payout_account_number: '123' },
    query: { access: creatorAccess },
    cookie: sellerCookie,
  });
  console.log('Update payout:', r.status);

  // Approve seller
  r = await req('POST', `/deals/${newPublicId}/approval`, { query: { access: creatorAccess }, cookie: sellerCookie });
  console.log('Seller approve:', r.status, 'data:', JSON.stringify(r.data));

  // Approve buyer
  r = await req('POST', `/deals/${newPublicId}/approval`, { query: { access: buyerAccess }, cookie: buyerCookie });
  console.log('Buyer approve:', r.status, 'data:', JSON.stringify(r.data));

  // Payment instruction
  r = await req('GET', `/deals/${newPublicId}/payment-instruction`, { query: { access: buyerAccess }, cookie: buyerCookie });
  console.log('Payment instruction:', r.status);

  // Upload payment proof with FormData
  const fd = new FormData();
  fd.append('paid_amount', '100');
  fd.append('buyer_note', 'test payment');
  // Check what headers fetch sends
  const url = new URL(`deals/${newPublicId}/payment-proofs`, BASE + '/');
  url.searchParams.set('access', buyerAccess);
  const fetchRes = await fetch(url.toString(), {
    method: 'POST',
    headers: { Cookie: buyerCookie },
    body: fd,
  });
  const fetchData = await fetchRes.json().catch(() => null);
  console.log('Payment proof status:', fetchRes.status);
  console.log('Payment proof data:', JSON.stringify(fetchData));
  console.log('Request content-type sent:', fetchRes.headers.get('content-type'));
})();
