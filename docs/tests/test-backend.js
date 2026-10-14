// End-to-end test of the licensing backend running at http://localhost:8787
const B = 'http://localhost:8787';
let adminToken;
const call = async (path, { method = 'GET', body, token } = {}) => {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json()) };
};
const check = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);

(async () => {
  check('wrong admin password rejected', (await call('/api/admin/login', { method: 'POST', body: { password: 'nope' } })).status === 401);
  const login = await call('/api/admin/login', { method: 'POST', body: { password: 'admin12345' } });
  adminToken = login.token; check('admin login', !!adminToken);
  check('admin API blocked without token', (await call('/api/admin/clients')).status === 401);

  const uname = 'test' + Date.now().toString().slice(-6);
  const created = await call('/api/admin/clients', { method: 'POST', token: adminToken, body: { username: uname, whatsapp: '923001234567', duration_days: 30, device_limit: 1, purchase_price: 500, selling_price: 1500 } });
  check('create client', created.ok && created.password && created.whatsapp_link?.startsWith('https://wa.me/923001234567'), created.error || '');
  check('duplicate username rejected', !(await call('/api/admin/clients', { method: 'POST', token: adminToken, body: { username: uname } })).ok);

  let list = await call('/api/admin/clients', { token: adminToken });
  const c = list.clients.find(x => x.username === uname);
  check('new client is not activated yet', c.status === 'pending' && c.days_remaining === 30);
  check('password hash never sent to panel', !('password_hash' in c));

  check('wrong app password rejected', (await call('/api/app/login', { method: 'POST', body: { username: uname, password: 'bad', device_id: 'PC-1' } })).status === 401);
  const app = await call('/api/app/login', { method: 'POST', body: { username: uname, password: created.password, device_id: 'PC-1', platform: 'windows', app_version: '1.0.0' } });
  check('app login + activation', app.ok && app.allowed && app.account.status === 'active' && app.account.days_remaining === 30, app.error || '');
  check('device limit enforced', (await call('/api/app/login', { method: 'POST', body: { username: uname, password: created.password, device_id: 'PHONE-2', platform: 'android' } })).status === 403);
  check('same device can sign in again', (await call('/api/app/login', { method: 'POST', body: { username: uname, password: created.password, device_id: 'PC-1', platform: 'windows' } })).ok);

  await call('/api/admin/notices', { method: 'POST', token: adminToken, body: { title: 'Hello', message: 'Test notice', audience: 'all' } });
  const st = await call('/api/app/status', { token: app.token });
  check('app status shows notice', st.ok && st.notices.some(n => n.title === 'Hello'));

  await call(`/api/admin/clients/${c.id}/renew`, { method: 'POST', token: adminToken, body: { days: 15 } });
  check('renew adds days', (await call('/api/app/status', { token: app.token })).account.days_remaining === 45);

  await call(`/api/admin/clients/${c.id}/suspend`, { method: 'POST', token: adminToken });
  const sus = await call('/api/app/status', { token: app.token });
  check('suspended client blocked in app', sus.allowed === false && sus.account.status === 'suspended');
  check('suspended client cannot log in', (await call('/api/app/login', { method: 'POST', body: { username: uname, password: created.password, device_id: 'PC-1' } })).status === 403);
  await call(`/api/admin/clients/${c.id}/activate`, { method: 'POST', token: adminToken });

  const devs = await call('/api/admin/devices', { token: adminToken });
  const d = devs.devices.find(x => x.username === uname);
  await call(`/api/admin/devices/${d.id}/revoke`, { method: 'POST', token: adminToken });
  check('revoked device kicked out', (await call('/api/app/status', { token: app.token })).status === 401);

  const rp = await call(`/api/admin/clients/${c.id}/reset-password`, { method: 'POST', token: adminToken });
  check('reset password works', (await call('/api/app/login', { method: 'POST', body: { username: uname, password: rp.password, device_id: 'PHONE-2', platform: 'android' } })).ok);

  for (const p of ['dashboard', 'expiry', 'analytics', 'activity', 'settings']) check('admin ' + p, (await call('/api/admin/' + p, { token: adminToken })).ok);
  const an = await call('/api/admin/analytics', { token: adminToken });
  check('profit calculated', an.totals.profit >= 1000);

  await call('/api/admin/clients/' + c.id, { method: 'DELETE', token: adminToken });
  check('delete client', !(await call('/api/admin/clients', { token: adminToken })).clients.some(x => x.username === uname));
  const html = await fetch(B + '/').then(r => r.text());
  check('admin panel page served', html.includes('Admin Console'));
})();
