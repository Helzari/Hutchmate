// Hutchmate API: accounts, plans, gift codes and cloud backup. Static site is served from ./www.
const PLANS = ['free', 'monthly', 'annual', 'lifetime'];
const ALLOWED = [/^https:\/\/hutchmate\.app$/, /^https:\/\/[a-z0-9-]+\.workers\.dev$/, /^https?:\/\/localhost(:\d+)?$/, /^capacitor:\/\/localhost$/];
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = s => new Uint8Array(s.match(/../g).map(h => parseInt(h, 16)));
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hashPass(pass, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: 100000 }, key, 256));
}
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
function cors(req) {
  const o = req.headers.get('Origin') || '';
  const h = { 'Vary': 'Origin' };
  if (ALLOWED.some(r => r.test(o))) Object.assign(h, { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400' });
  return h;
}
class Fail extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const need = (c, status, msg) => { if (!c) throw new Fail(status, msg); };
function activePlan(u) {
  if (!u || u.plan === 'free') return 'free';
  if (u.plan_until && u.plan_until < Date.now()) return 'free';
  return u.plan;
}
const pub = u => ({ email: u.email, plan: activePlan(u), planUntil: u.plan_until || null, pro: activePlan(u) !== 'free', admin: !!u.admin });
async function limit(db, key, max, windowMs) {
  const now = Date.now(), r = await db.prepare('SELECT n, reset FROM attempts WHERE k=?').bind(key).first();
  if (!r || r.reset < now) { await db.prepare('INSERT OR REPLACE INTO attempts (k,n,reset) VALUES (?,?,?)').bind(key, 1, now + windowMs).run(); return; }
  need(r.n < max, 429, 'Too many attempts. Please wait a few minutes and try again.');
  await db.prepare('UPDATE attempts SET n=n+1 WHERE k=?').bind(key).run();
}
async function auth(req, db) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  need(t, 401, 'Please sign in.');
  const s = await db.prepare('SELECT user_id, expires FROM sessions WHERE token_hash=?').bind(await sha(t)).first();
  need(s && s.expires > Date.now(), 401, 'Your sign-in has expired. Please sign in again.');
  const u = await db.prepare('SELECT * FROM users WHERE id=?').bind(s.user_id).first();
  need(u, 401, 'Please sign in.');
  return u;
}
async function newSession(db, userId) {
  const token = rand(32), now = Date.now();
  await db.prepare('INSERT INTO sessions (token_hash,user_id,created,expires) VALUES (?,?,?,?)').bind(await sha(token), userId, now, now + 180 * 864e5).run();
  return token;
}
const cleanEmail = e => String(e || '').trim().toLowerCase();
const newCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = crypto.getRandomValues(new Uint8Array(12)); const s = [...b].map(x => a[x % a.length]).join(''); return `HM-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`; };

async function api(req, env, path) {
  const db = env.DB, m = req.method, ip = req.headers.get('CF-Connecting-IP') || 'local';
  const body = (m === 'POST' || m === 'PUT') ? await req.json().catch(() => ({})) : {};
  if (path === '/api/health') return { ok: true };

  if (path === '/api/register' && m === 'POST') {
    await limit(db, 'reg:' + ip, 5, 3600e3);
    const email = cleanEmail(body.email), pass = String(body.password || '');
    need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 200, 400, 'Enter a valid email address.');
    need(pass.length >= 8 && pass.length <= 200, 400, 'Choose a password of at least 8 characters.');
    need(!(await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first()), 409, 'There is already an account with that email. Sign in instead.');
    const salt = rand(16), first = !(await db.prepare('SELECT id FROM users LIMIT 1').first());
    const r = await db.prepare('INSERT INTO users (email,pass_hash,pass_salt,plan,plan_source,admin,created) VALUES (?,?,?,?,?,?,?)')
      .bind(email, await hashPass(pass, salt), salt, first ? 'lifetime' : 'free', first ? 'admin' : null, first ? 1 : 0, Date.now()).run();
    const u = await db.prepare('SELECT * FROM users WHERE id=?').bind(r.meta.last_row_id).first();
    return { token: await newSession(db, u.id), user: pub(u) };
  }
  if (path === '/api/login' && m === 'POST') {
    const email = cleanEmail(body.email);
    await limit(db, 'login:' + ip + ':' + email, 8, 900e3);
    const u = await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    need(u && (await hashPass(String(body.password || ''), u.pass_salt)) === u.pass_hash, 401, 'That email or password is not right.');
    return { token: await newSession(db, u.id), user: pub(u) };
  }

  const u = await auth(req, db);
  if (path === '/api/me' && m === 'GET') return { user: pub(u) };
  if (path === '/api/logout' && m === 'POST') {
    await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''))).run();
    return { ok: true };
  }
  if (path === '/api/password' && m === 'POST') {
    need((await hashPass(String(body.current || ''), u.pass_salt)) === u.pass_hash, 401, 'Your current password is not right.');
    const pass = String(body.password || ''); need(pass.length >= 8 && pass.length <= 200, 400, 'Choose a password of at least 8 characters.');
    const salt = rand(16);
    await db.prepare('UPDATE users SET pass_hash=?, pass_salt=? WHERE id=?').bind(await hashPass(pass, salt), salt, u.id).run();
    return { ok: true };
  }
  if (path === '/api/redeem' && m === 'POST') {
    await limit(db, 'redeem:' + u.id, 10, 3600e3);
    const code = String(body.code || '').trim().toUpperCase();
    const c = await db.prepare('SELECT * FROM codes WHERE code=?').bind(code).first();
    need(c, 404, 'That code was not recognised. Check it and try again.');
    need(!c.used_by, 409, 'That code has already been used.');
    const until = c.days ? Date.now() + c.days * 864e5 : null;
    const res = await db.prepare('UPDATE codes SET used_by=?, used_at=? WHERE code=? AND used_by IS NULL').bind(u.id, Date.now(), code).run();
    need(res.meta.changes === 1, 409, 'That code has already been used.');
    await db.prepare('UPDATE users SET plan=?, plan_until=?, plan_source=? WHERE id=?').bind(c.plan, until, 'gift-code', u.id).run();
    return { user: pub({ ...u, plan: c.plan, plan_until: until }) };
  }
  if (path === '/api/sync') {
    need(activePlan(u) !== 'free', 402, 'Cloud backup is a Hutchmate Pro feature.');
    if (m === 'GET') { const r = await db.prepare('SELECT data, updated FROM sync WHERE user_id=?').bind(u.id).first(); return r ? { data: JSON.parse(r.data), updated: r.updated } : { data: null, updated: null }; }
    if (m === 'PUT') {
      const s = JSON.stringify(body.data || {}); need(s.length <= 900000, 413, 'Your records are too large to back up. Contact support.');
      const now = Date.now();
      await db.prepare('INSERT INTO sync (user_id,data,updated) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated=excluded.updated').bind(u.id, s, now).run();
      return { updated: now };
    }
  }
  if (path === '/api/account' && m === 'DELETE') {
    need(!u.admin, 400, 'The owner account cannot be deleted here.');
    await db.batch([db.prepare('DELETE FROM sync WHERE user_id=?').bind(u.id), db.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id), db.prepare('DELETE FROM users WHERE id=?').bind(u.id)]);
    return { ok: true };
  }

  if (path.startsWith('/api/admin/')) {
    need(u.admin, 403, 'Not allowed.');
    if (path === '/api/admin/users' && m === 'GET') {
      const r = await db.prepare('SELECT email, plan, plan_until, plan_source, admin, created FROM users ORDER BY created DESC LIMIT 500').all();
      return { users: r.results.map(x => ({ email: x.email, plan: activePlan(x), planUntil: x.plan_until, source: x.plan_source, admin: !!x.admin, created: x.created })) };
    }
    if (path === '/api/admin/plan' && m === 'POST') {
      const email = cleanEmail(body.email), plan = String(body.plan || '');
      need(PLANS.includes(plan), 400, 'Unknown plan.');
      const t = await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
      need(t, 404, 'No account with that email yet. Ask them to create an account first, or send them a gift code.');
      const until = plan === 'monthly' ? Date.now() + 31 * 864e5 : plan === 'annual' ? Date.now() + 366 * 864e5 : null;
      await db.prepare('UPDATE users SET plan=?, plan_until=?, plan_source=? WHERE id=?').bind(plan, until, 'admin', t.id).run();
      return { ok: true };
    }
    if (path === '/api/admin/codes' && m === 'GET') {
      const r = await db.prepare('SELECT c.code, c.plan, c.days, c.note, c.created, c.used_at, u.email AS used_by FROM codes c LEFT JOIN users u ON u.id=c.used_by ORDER BY c.created DESC LIMIT 500').all();
      return { codes: r.results };
    }
    if (path === '/api/admin/codes' && m === 'POST') {
      const plan = String(body.plan || 'lifetime'); need(PLANS.includes(plan) && plan !== 'free', 400, 'Unknown plan.');
      const count = Math.max(1, Math.min(50, parseInt(body.count, 10) || 1)), days = plan === 'lifetime' ? null : plan === 'annual' ? 366 : 31, out = [];
      for (let i = 0; i < count; i++) { const code = newCode(); await db.prepare('INSERT INTO codes (code,plan,days,note,created) VALUES (?,?,?,?,?)').bind(code, plan, days, String(body.note || '').slice(0, 120), Date.now()).run(); out.push(code); }
      return { codes: out };
    }
    if (path === '/api/admin/codes' && m === 'DELETE') {
      const code = new URL(req.url).searchParams.get('code') || '';
      await db.prepare('DELETE FROM codes WHERE code=? AND used_by IS NULL').bind(code).run();
      return { ok: true };
    }
  }
  throw new Fail(404, 'Not found.');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    const h = { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    try { return new Response(JSON.stringify(await api(req, env, url.pathname)), { headers: h }); }
    catch (e) {
      if (e instanceof Fail) return new Response(JSON.stringify({ error: e.message }), { status: e.status, headers: h });
      console.error(e);
      return new Response(JSON.stringify({ error: 'Something went wrong on the server. Please try again.' }), { status: 500, headers: h });
    }
  },
};
