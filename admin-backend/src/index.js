// The Ultra Flow — licensing backend (Cloudflare Worker + D1)
// Admin API:  /api/admin/*   (Bearer admin token)
// App API:    /api/app/*     (used by the Windows / Android apps)
// Everything else is served from ./public (the admin panel UI).

const enc = new TextEncoder();
const DAY = 86400000;
const nowIso = () => new Date().toISOString();

// ---------- helpers ----------
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
  });
const fail = (error, status = 400) => json({ ok: false, error }, status);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

// PBKDF2 password hashing (format: pbkdf2$iterations$salt$hash)
const PBKDF2_ITER = 20000;
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return `pbkdf2$${PBKDF2_ITER}$${b64url(salt)}$${b64url(bits)}`;
}
async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [, iter, salt, hash] = stored.split('$');
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64url(salt), iterations: +iter }, key, 256);
  return b64url(bits) === hash;
}

// Minimal signed tokens (HMAC-SHA256)
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signToken(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}
async function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), enc.encode(body));
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
  if (payload.exp && payload.exp < Date.now()) return null;
  return payload;
}

function randomPassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(r, b => chars[b % chars.length]).join('');
}

async function logActivity(env, type, detail) {
  await env.DB.prepare('INSERT INTO activity (type, detail, created_at) VALUES (?, ?, ?)').bind(type, detail, nowIso()).run();
}

async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const s = {
    brand_name: 'THE ULTRA FLOW',
    portal_url: 'https://the-ultra-flow.vercel.app',
    support_whatsapp: '',
    windows_version: '1.0.0', windows_url: '',
    android_version: '1.0.0', android_url: '',
    min_app_version: '',
  };
  for (const r of results) s[r.key] = r.value;
  return s;
}

// Status + days remaining for a client row
function describe(c) {
  const now = Date.now();
  let status, daysRemaining;
  if (c.suspended) status = 'suspended';
  else if (!c.activated_at) status = 'pending';
  else if (new Date(c.expires_at).getTime() <= now) status = 'expired';
  else status = 'active';
  if (!c.activated_at) daysRemaining = c.duration_days;
  else daysRemaining = Math.max(0, Math.ceil((new Date(c.expires_at).getTime() - now) / DAY));
  const { password_hash, ...rest } = c;
  return { ...rest, status, days_remaining: daysRemaining, profit: (c.selling_price || 0) - (c.purchase_price || 0) };
}

function packageText(c, password, settings) {
  return [
    `🚀 *${settings.brand_name} ACCOUNT*`,
    '━━━━━━━━━━━━━━━━━━',
    `👤 Username: ${c.username}`,
    `🔑 Password: ${password}`,
    `⏳ Plan: ${c.duration_days} days (starts on first login)`,
    `📱 Devices allowed: ${c.device_limit}`,
    '━━━━━━━━━━━━━━━━━━',
    `⬇️ Download & setup guide: ${settings.portal_url}`,
    'Install the app and sign in with the details above.',
  ].join('\n');
}

function waLink(number, text) {
  const n = (number || '').replace(/[^\d]/g, '');
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

// ---------- auth ----------
async function requireAdmin(request, env) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  const p = await verifyToken(token, env.JWT_SECRET);
  if (!p || p.role !== 'admin') throw new HttpError(401, 'Admin login required');
  return p;
}

async function requireClient(request, env) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  const p = await verifyToken(token, env.JWT_SECRET);
  if (!p || p.role !== 'client') throw new HttpError(401, 'Session expired. Please sign in again.');
  const c = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(p.sub).first();
  if (!c) throw new HttpError(401, 'Account not found');
  const dev = await env.DB.prepare('SELECT * FROM devices WHERE client_id = ? AND device_id = ?').bind(c.id, p.dev).first();
  if (!dev || dev.revoked) throw new HttpError(401, 'This device has been signed out by the admin.');
  return { client: c, device: dev };
}

// ---------- admin routes ----------
async function adminRoutes(request, env, path, method) {
  if (path === '/api/admin/login' && method === 'POST') {
    const { password } = await body(request);
    const s = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").first();
    const ok = s ? await verifyPassword(password || '', s.value) : password === env.ADMIN_PASSWORD;
    if (!ok) return fail('Wrong admin password', 401);
    const token = await signToken({ role: 'admin', exp: Date.now() + 7 * DAY }, env.JWT_SECRET);
    return json({ ok: true, token });
  }

  await requireAdmin(request, env);
  const settings = await getSettings(env);
  let m;

  if (path === '/api/admin/dashboard' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM clients').all();
    const clients = results.map(describe);
    const count = st => clients.filter(c => c.status === st).length;
    const devices = await env.DB.prepare('SELECT COUNT(*) n FROM devices WHERE revoked = 0').first();
    const events = await env.DB.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 8').all();
    const soon = clients.filter(c => c.status === 'active' && c.days_remaining <= 3).length;
    return json({
      ok: true,
      stats: {
        total: clients.length, active: count('active'), pending: count('pending'),
        expired: count('expired'), suspended: count('suspended'), devices: devices.n, expiring_soon: soon,
        revenue: clients.reduce((a, c) => a + (c.selling_price || 0), 0),
        profit: clients.reduce((a, c) => a + c.profit, 0),
      },
      events: events.results,
      releases: { windows: settings.windows_version, android: settings.android_version },
    });
  }

  if (path === '/api/admin/clients' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT c.*, (SELECT COUNT(*) FROM devices d WHERE d.client_id = c.id AND d.revoked = 0) AS device_count FROM clients c ORDER BY c.id DESC'
    ).all();
    return json({ ok: true, clients: results.map(describe) });
  }

  if (path === '/api/admin/clients' && method === 'POST') {
    const b = await body(request);
    const username = (b.username || '').trim();
    if (!username) return fail('Username is required');
    const exists = await env.DB.prepare('SELECT id FROM clients WHERE username = ?').bind(username).first();
    if (exists) return fail('This username already exists');
    const password = (b.password || '').trim() || randomPassword();
    const row = {
      username, email: b.email || null, whatsapp: b.whatsapp || null, display_name: b.display_name || username,
      duration_days: Math.max(1, +b.duration_days || 30), device_limit: Math.max(1, +b.device_limit || 1),
      purchase_price: +b.purchase_price || 0, selling_price: +b.selling_price || 0, notes: b.notes || null,
    };
    const r = await env.DB.prepare(
      `INSERT INTO clients (username, email, whatsapp, display_name, password_hash, duration_days, device_limit,
        purchase_price, selling_price, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(row.username, row.email, row.whatsapp, row.display_name, await hashPassword(password), row.duration_days,
      row.device_limit, row.purchase_price, row.selling_price, row.notes, nowIso()).run();
    await logActivity(env, 'Client Created', username);
    const text = packageText(row, password, settings);
    return json({ ok: true, id: r.meta.last_row_id, password, package: text, whatsapp_link: waLink(row.whatsapp, text) });
  }

  if ((m = path.match(/^\/api\/admin\/clients\/(\d+)$/))) {
    const id = +m[1];
    const c = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
    if (!c) return fail('Client not found', 404);

    if (method === 'PUT') {
      const b = await body(request);
      await env.DB.prepare(
        `UPDATE clients SET email=?, whatsapp=?, display_name=?, device_limit=?, purchase_price=?, selling_price=?, notes=? WHERE id=?`
      ).bind(b.email ?? c.email, b.whatsapp ?? c.whatsapp, b.display_name ?? c.display_name,
        Math.max(1, +(b.device_limit ?? c.device_limit)), +(b.purchase_price ?? c.purchase_price),
        +(b.selling_price ?? c.selling_price), b.notes ?? c.notes, id).run();
      await logActivity(env, 'Client Updated', c.username);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM devices WHERE client_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id).run();
      await logActivity(env, 'Client Deleted', c.username);
      return json({ ok: true });
    }
  }

  if ((m = path.match(/^\/api\/admin\/clients\/(\d+)\/(renew|suspend|activate|reset-devices|reset-password)$/)) && method === 'POST') {
    const [, idStr, action] = m;
    const id = +idStr;
    const c = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
    if (!c) return fail('Client not found', 404);

    if (action === 'renew') {
      const days = Math.max(1, +(await body(request)).days || 30);
      if (!c.activated_at) {
        await env.DB.prepare('UPDATE clients SET duration_days = duration_days + ? WHERE id = ?').bind(days, id).run();
      } else {
        const base = Math.max(Date.now(), new Date(c.expires_at).getTime());
        await env.DB.prepare('UPDATE clients SET expires_at = ? WHERE id = ?').bind(new Date(base + days * DAY).toISOString(), id).run();
      }
      await logActivity(env, 'License Renewed', `${c.username} +${days}d`);
    }
    if (action === 'suspend') {
      await env.DB.prepare('UPDATE clients SET suspended = 1 WHERE id = ?').bind(id).run();
      await logActivity(env, 'Client Suspended', c.username);
    }
    if (action === 'activate') {
      await env.DB.prepare('UPDATE clients SET suspended = 0 WHERE id = ?').bind(id).run();
      await logActivity(env, 'Client Unsuspended', c.username);
    }
    if (action === 'reset-devices') {
      await env.DB.prepare('DELETE FROM devices WHERE client_id = ?').bind(id).run();
      await logActivity(env, 'Devices Reset', c.username);
    }
    if (action === 'reset-password') {
      const password = (await body(request)).password || randomPassword();
      await env.DB.prepare('UPDATE clients SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), id).run();
      await logActivity(env, 'Password Reset', c.username);
      const text = packageText(c, password, settings);
      return json({ ok: true, password, package: text, whatsapp_link: waLink(c.whatsapp, text) });
    }
    return json({ ok: true });
  }

  if (path === '/api/admin/expiry' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM clients').all();
    const list = results.map(describe).filter(c => c.status === 'expired' || (c.status === 'active' && c.days_remaining <= 7))
      .sort((a, b) => a.days_remaining - b.days_remaining)
      .map(c => {
        const text = c.status === 'expired'
          ? `Assalam o Alaikum ${c.display_name}! Your ${settings.brand_name} plan has expired. Reply to renew your access.`
          : `Assalam o Alaikum ${c.display_name}! Your ${settings.brand_name} plan expires in ${c.days_remaining} day(s). Reply to renew.`;
        return { ...c, whatsapp_link: waLink(c.whatsapp, text) };
      });
    return json({ ok: true, clients: list });
  }

  if (path === '/api/admin/analytics' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM clients ORDER BY id DESC').all();
    const clients = results.map(describe);
    const sum = k => clients.reduce((a, c) => a + (c[k] || 0), 0);
    const revenue = sum('selling_price'), cost = sum('purchase_price');
    return json({
      ok: true,
      totals: { revenue, cost, profit: revenue - cost, margin: revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0, clients: clients.length },
      clients: clients.map(c => ({ id: c.id, username: c.username, status: c.status, purchase_price: c.purchase_price, selling_price: c.selling_price, profit: c.profit, created_at: c.created_at })),
    });
  }

  if (path === '/api/admin/notices' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM notices ORDER BY id DESC').all();
    return json({ ok: true, notices: results });
  }
  if (path === '/api/admin/notices' && method === 'POST') {
    const b = await body(request);
    if (!b.title || !b.message) return fail('Title and message are required');
    await env.DB.prepare('INSERT INTO notices (audience, priority, title, message, starts_at, ends_at, created_at) VALUES (?,?,?,?,?,?,?)')
      .bind((b.audience || 'all').trim() || 'all', b.priority || 'info', b.title, b.message, b.starts_at || null, b.ends_at || null, nowIso()).run();
    await logActivity(env, 'Notice Sent', b.title);
    return json({ ok: true });
  }
  if ((m = path.match(/^\/api\/admin\/notices\/(\d+)$/)) && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM notices WHERE id = ?').bind(+m[1]).run();
    return json({ ok: true });
  }

  if (path === '/api/admin/devices' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT d.*, c.username FROM devices d JOIN clients c ON c.id = d.client_id ORDER BY d.last_seen DESC'
    ).all();
    return json({ ok: true, devices: results });
  }
  if ((m = path.match(/^\/api\/admin\/devices\/(\d+)\/revoke$/)) && method === 'POST') {
    const d = await env.DB.prepare('SELECT d.*, c.username FROM devices d JOIN clients c ON c.id = d.client_id WHERE d.id = ?').bind(+m[1]).first();
    if (!d) return fail('Device not found', 404);
    await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(d.id).run();
    await logActivity(env, 'Device Revoked', `${d.username} (${d.platform || 'device'})`);
    return json({ ok: true });
  }

  if (path === '/api/admin/activity' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 200').all();
    return json({ ok: true, activity: results });
  }

  if (path === '/api/admin/settings' && method === 'GET') return json({ ok: true, settings });
  if (path === '/api/admin/settings' && method === 'PUT') {
    const b = await body(request);
    const allowed = ['brand_name', 'portal_url', 'support_whatsapp', 'windows_version', 'windows_url', 'android_version', 'android_url', 'min_app_version'];
    for (const k of allowed) {
      if (k in b) await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, String(b[k])).run();
    }
    if (b.new_admin_password) {
      if (String(b.new_admin_password).length < 8) return fail('Admin password must be at least 8 characters');
      await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('admin_password_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(await hashPassword(b.new_admin_password)).run();
      await logActivity(env, 'Admin Password Changed', '');
    }
    await logActivity(env, 'Settings Updated', '');
    return json({ ok: true });
  }

  return fail('Not found', 404);
}

// ---------- app routes (Windows / Android) ----------
async function appStatus(env, c, device) {
  const settings = await getSettings(env);
  const d = describe(c);
  const now = nowIso();
  const { results } = await env.DB.prepare(
    `SELECT id, priority, title, message, created_at FROM notices
     WHERE (audience = 'all' OR audience = ?) AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
     ORDER BY id DESC LIMIT 10`
  ).bind(c.username, now, now).all();
  return {
    ok: true,
    allowed: d.status === 'active',
    account: { username: d.username, display_name: d.display_name, status: d.status, days_remaining: d.days_remaining, expires_at: d.expires_at, device_limit: d.device_limit },
    device: { id: device.device_id, platform: device.platform },
    notices: results,
    releases: {
      windows: { version: settings.windows_version, url: settings.windows_url },
      android: { version: settings.android_version, url: settings.android_url },
      min_app_version: settings.min_app_version,
    },
    support_whatsapp: settings.support_whatsapp,
  };
}

async function appRoutes(request, env, path, method) {
  if (path === '/api/app/login' && method === 'POST') {
    const b = await body(request);
    const username = (b.username || '').trim();
    const deviceId = (b.device_id || '').trim();
    if (!username || !b.password || !deviceId) return fail('Username, password and device are required');
    const c = await env.DB.prepare('SELECT * FROM clients WHERE username = ?').bind(username).first();
    if (!c || !(await verifyPassword(b.password, c.password_hash))) return fail('Wrong username or password', 401);
    if (c.suspended) return fail('Your account is suspended. Please contact support.', 403);
    if (c.activated_at && new Date(c.expires_at).getTime() <= Date.now()) return fail('Your plan has expired. Please contact support to renew.', 403);

    const now = nowIso();
    let dev = await env.DB.prepare('SELECT * FROM devices WHERE client_id = ? AND device_id = ?').bind(c.id, deviceId).first();
    if (!dev) {
      const used = await env.DB.prepare('SELECT COUNT(*) n FROM devices WHERE client_id = ? AND revoked = 0').bind(c.id).first();
      if (used.n >= c.device_limit) return fail(`Device limit reached (${c.device_limit}). Ask support to reset your devices.`, 403);
      await env.DB.prepare('INSERT INTO devices (client_id, device_id, device_name, platform, app_version, first_seen, last_seen) VALUES (?,?,?,?,?,?,?)')
        .bind(c.id, deviceId, b.device_name || null, b.platform || null, b.app_version || null, now, now).run();
      await logActivity(env, 'Device Added', `${c.username} (${b.platform || 'device'})`);
    } else {
      await env.DB.prepare('UPDATE devices SET last_seen = ?, app_version = ?, revoked = 0 WHERE id = ?').bind(now, b.app_version || dev.app_version, dev.id).run();
    }
    if (!c.activated_at) {
      const exp = new Date(Date.now() + c.duration_days * DAY).toISOString();
      await env.DB.prepare('UPDATE clients SET activated_at = ?, expires_at = ? WHERE id = ?').bind(now, exp, c.id).run();
      c.activated_at = now; c.expires_at = exp;
      await logActivity(env, 'Client Activated', c.username);
    }
    dev = await env.DB.prepare('SELECT * FROM devices WHERE client_id = ? AND device_id = ?').bind(c.id, deviceId).first();
    const token = await signToken({ role: 'client', sub: c.id, dev: deviceId, exp: Date.now() + 30 * DAY }, env.JWT_SECRET);
    return json({ ...(await appStatus(env, c, dev)), token });
  }

  if (path === '/api/app/status' && method === 'GET') {
    const { client, device } = await requireClient(request, env);
    await env.DB.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').bind(nowIso(), device.id).run();
    return json(await appStatus(env, client, device));
  }

  if (path === '/api/app/logout' && method === 'POST') {
    const { client, device } = await requireClient(request, env);
    await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(device.id).run();
    await logActivity(env, 'Device Signed Out', client.username);
    return json({ ok: true });
  }

  return fail('Not found', 404);
}

// ---------- entry ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;
    if (method === 'OPTIONS') return json({ ok: true });

    try {
      if (!env.JWT_SECRET || !env.ADMIN_PASSWORD) return fail('Server is not configured (missing secrets)', 500);
      if (path.startsWith('/api/admin')) return await adminRoutes(request, env, path, method);
      if (path.startsWith('/api/app')) return await appRoutes(request, env, path, method);
      if (path === '/api/public/releases') {
        const s = await getSettings(env);
        return json({ ok: true, windows: { version: s.windows_version, url: s.windows_url }, android: { version: s.android_version, url: s.android_url } });
      }
      if (path.startsWith('/api/')) return fail('Not found', 404);
      return env.ASSETS.fetch(request);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.message, err.status);
      return fail('Server error: ' + err.message, 500);
    }
  },
};
