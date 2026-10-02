// Coverage gate (7.1): fails unless statements AND branches are >= MIN over the gated scope
// (core/, charts/, app.ts — see the test:coverage script). Reads vitest's json-summary.
const fs = require('fs');
const path = require('path');
const MIN = Number(process.env.COVERAGE_MIN || 80);

function findSummary(dir) {
  for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findSummary(p); if (r) return r; }
    else if (e.name === 'coverage-summary.json') return p;
  }
  return null;
}
const file = findSummary(path.join(__dirname, '..', 'coverage'));
if (!file) { console.error('coverage-summary.json not found — run the coverage test first'); process.exit(2); }
const total = JSON.parse(fs.readFileSync(file, 'utf8')).total;
let ok = true;
for (const k of ['statements', 'branches']) {
  const pct = total[k].pct;
  const pass = pct >= MIN;
  ok = ok && pass;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${k}: ${pct}% (min ${MIN}%)`);
}
process.exit(ok ? 0 : 1);
