const BASE = 'http://localhost:3003/v1';

async function req(method: string, path: string, opts: any = {}) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const base = BASE.endsWith('/') ? BASE : BASE + '/';
  const url = new URL(normalizedPath, base);
  if (opts.query) Object.entries(opts.query).forEach(([k, v]: [string, any]) => { if (v) url.searchParams.set(k, v); });
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  console.log('Request:', method, url.toString(), 'headers:', JSON.stringify(headers));

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
  console.log('Seller login:', r.status, 'cookie:', sellerCookie);

  // Login buyer
  r = await req('POST', '/auth/login', { body: { email: 'testbuyer@example.com', password: 'testpassword123' } });
  const buyerCookie = r.rawHeaders['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('Buyer login:', r.status, 'cookie:', buyerCookie);

  if (!sellerCookie || !buyerCookie) {
    console.log('Missing cookies, stopping');
    return;
  }

  // Create a fresh deal
  r = await req('POST', '/deals', {
    body: {
      source: 'web', creator_role: 'seller', language: 'en',
      product_title: 'Debug3 Product', product_type: 'electronics',
      amount: 100, currency: 'USD',
      creator_name: 'Debug Seller', creator_phone: '+85512345678',
    },
    cookie: sellerCookie,
  });
  console.log('Create deal response:', JSON.stringify(r.data, null, 2));
})();
