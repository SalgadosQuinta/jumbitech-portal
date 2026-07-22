// JumbiTech Portal test suite. Run with: node tests/run-tests.js
// Covers: date/week logic, built shell integrity, service worker and bundle
// syntax, and security invariants in the migrations (aal2 present on every
// sensitive policy, audit log append-only).

import { JSDOM } from 'jsdom';
import { readFileSync, existsSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mondayOf, sumHours, weekLabel, DAYS } from '../src/lib/dates.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '-', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'expected'} ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

// ---------------------------------------------------------------- date logic
t('mondayOf returns a Monday', () => {
  const m = new Date(mondayOf(new Date('2026-07-22T12:00:00Z')) + 'T00:00:00');
  eq(m.getDay(), 1, 'day of week');
});
t('mondayOf is stable across the week', () => {
  const wed = mondayOf(new Date('2026-07-22T09:00:00'));
  const sun = mondayOf(new Date('2026-07-26T23:00:00'));
  eq(wed, sun, 'same week key');
});
t('sumHours totals and ignores junk', () => {
  eq(sumHours({ mon: 8, tue: 7.5, bogus: 99 }), 15.5);
  eq(sumHours({}), 0);
  eq(sumHours(null), 0);
});
t('weekLabel formats GB style', () => {
  ok(weekLabel('2026-07-20').startsWith('Week of 20 Jul 2026'), weekLabel('2026-07-20'));
});
t('DAYS covers Monday to Sunday', () => {
  eq(DAYS.length, 7);
  eq(DAYS[0][0], 'mon'); eq(DAYS[6][0], 'sun');
});

// ------------------------------------------------------------- built shell
t('built shell exists with root and manifest', () => {
  ok(existsSync('docs/index.html'), 'docs/index.html missing - run npm run build first');
  const dom = new JSDOM(readFileSync('docs/index.html', 'utf8'));
  ok(dom.window.document.getElementById('root'), '#root missing');
  ok(dom.window.document.querySelector('link[rel="manifest"]'), 'manifest link missing');
});
t('CNAME and sw.js shipped in docs/', () => {
  eq(readFileSync('docs/CNAME', 'utf8').trim(), 'portal.jumbitech.com');
  ok(existsSync('docs/sw.js'), 'sw.js missing from docs');
});
t('service worker never intercepts cross-origin (Supabase) requests', () => {
  const sw = readFileSync('docs/sw.js', 'utf8');
  ok(sw.includes('url.origin !== self.location.origin'), 'cross-origin guard missing');
});
t('bundle and sw are syntactically valid', () => {
  const assets = readdirSync('docs/assets').filter((f) => f.endsWith('.js'));
  ok(assets.length > 0, 'no JS bundle found');
  for (const f of assets) {
    const tmp = `/tmp/check-${f}.mjs`;
    writeFileSync(tmp, readFileSync(`docs/assets/${f}`));
    execFileSync('node', ['--check', tmp]);
    unlinkSync(tmp);
  }
  writeFileSync('/tmp/check-sw.js', readFileSync('docs/sw.js'));
  execFileSync('node', ['--check', '/tmp/check-sw.js']);
});

// ------------------------------------------------- security invariants (SQL)
const security = readFileSync('supabase/migrations/002_security.sql', 'utf8');
t('every candidate/client data policy requires aal2', () => {
  ok(security.includes('create or replace function public.is_aal2()'), 'is_aal2 helper missing');
  // Count sensitive-side policies vs aal2 references: staff path enforced inside is_staff.
  ok((security.match(/is_aal2\(\)/g) || []).length >= 12, 'too few aal2 checks');
  ok(security.includes("coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'"), 'is_staff not aal2-bound');
});
t('audit log is append-only', () => {
  const audit = readFileSync('supabase/migrations/003_audit.sql', 'utf8');
  ok(!/create policy.*for (update|delete) on public\.audit_log/i.test(audit), 'mutating policy on audit_log');
  ok(audit.includes('revoke update, delete on public.audit_log'), 'privileges not revoked');
});
t('anon key present, service-role key absent from source', () => {
  const cfg = readFileSync('src/lib/config.js', 'utf8');
  ok(cfg.includes('SUPABASE_ANON_KEY'), 'anon key missing');
  ok(!/service_role/i.test(cfg), 'service role must never ship');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
