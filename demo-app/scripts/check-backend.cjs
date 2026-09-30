#!/usr/bin/env node
/**
 * `npm run backend:check [url]` — checks that a running backend (default http://localhost:3000) is usable by this app:
 * reachable, CORS for the Angular dev origin (incl. the headers the interceptors send), and the /api/meta shape.
 */
const base = (process.argv[2] || process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const origin = process.env.APP_ORIGIN || 'http://localhost:4200';
let failed = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m, hint) => { failed++; console.log(`  FAIL ${m}${hint ? `\n       -> ${hint}` : ''}`); };

(async () => {
  console.log(`Backend: ${base}   App origin: ${origin}`);
  let res;
  try {
    res = await fetch(`${base}/api/meta`, { headers: { Origin: origin } });
    ok(`reachable (GET /api/meta -> ${res.status})`);
  } catch (e) {
    bad(`cannot connect (${e.cause?.code || e.message})`, 'start the backend, or pass another URL: npm run backend:check -- http://host:port');
    process.exit(1);
  }

  const allow = res.headers.get('access-control-allow-origin');
  allow === '*' || allow === origin ? ok(`CORS allow-origin: ${allow}`) : bad(`CORS allow-origin is ${allow ?? 'missing'}`, `allow ${origin} (Flask: flask-cors CORS(app, origins=["${origin}"]))`);

  try {
    const pre = await fetch(`${base}/api/meta`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,if-none-match,content-type' } });
    const h = (pre.headers.get('access-control-allow-headers') || '').toLowerCase();
    const missing = ['authorization', 'if-none-match', 'content-type'].filter((x) => !(h === '*' || h.includes(x)));
    pre.status < 300 && !missing.length ? ok('preflight allows Authorization, If-None-Match, Content-Type') : bad(`preflight ${pre.status}, missing allow-headers: ${missing.join(', ') || 'none'}`, 'allow these request headers (flask-cors allow_headers=["Authorization","If-None-Match","Content-Type"])');
  } catch (e) { bad(`preflight failed (${e.message})`); }

  const expose = (res.headers.get('access-control-expose-headers') || '').toLowerCase();
  expose === '*' || expose.includes('etag') ? ok('ETag is exposed to the browser') : bad('ETag not in Access-Control-Expose-Headers', 'expose ETag (and Retry-After, X-Request-Id) so the cache interceptor can use it');

  if (res.status === 200) {
    try {
      const m = await res.json();
      Array.isArray(m.datasets) && m.data_as_of && m.api_version ? ok(`/api/meta shape ok (api_version ${m.api_version}, datasets: ${m.datasets.join(', ') || 'none'})`) : bad('/api/meta body is not the contract shape', 'see docs/api/README.md §10');
    } catch { bad('/api/meta did not return JSON'); }
  } else {
    console.log('  note /api/meta not implemented yet: the app treats that as "no datasets" and keeps working with its built-in data.');
  }
  console.log(failed ? `\n${failed} problem(s).` : '\nAll good.');
  process.exit(failed ? 1 : 0);
})();
