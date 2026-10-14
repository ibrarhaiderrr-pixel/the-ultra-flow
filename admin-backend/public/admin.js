// The Ultra Flow — Admin panel core (views are in views.js)
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let token = localStorage.getItem('uf_admin_token');
let currentView = 'dashboard';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const pkr = n => 'PKR ' + Number(n || 0).toLocaleString();

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3000);
}

async function api(path, opts = {}) {
  const res = await fetch('/api/admin' + path, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Bad response from server' }));
  if (res.status === 401 && path !== '/login') { logout(); throw new Error('Session expired'); }
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------- auth ----------
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    const d = await api('/login', { method: 'POST', body: { password: $('#loginPassword').value } });
    token = d.token; localStorage.setItem('uf_admin_token', token);
    showApp();
  } catch (err) { $('#loginError').textContent = err.message; }
});

function logout() {
  token = null; localStorage.removeItem('uf_admin_token');
  $('#app').classList.add('hidden'); $('#loginScreen').classList.remove('hidden');
}
$('#logoutBtn').onclick = logout;

function showApp() {
  $('#loginScreen').classList.add('hidden'); $('#app').classList.remove('hidden');
  go(currentView);
}

// ---------- navigation ----------
const VIEWS = {
  dashboard: ['OVERVIEW', 'Dashboard'],
  clients: ['CLIENT DIRECTORY', 'Clients'],
  expiry: ['RENEWALS', 'Expiry Center'],
  notices: ['NOTIFICATION CENTER', 'Client Notices'],
  pricing: ['FINANCE', 'Pricing Analytics'],
  devices: ['DEVICE ACCESS', 'Devices'],
  activity: ['AUDIT LOG', 'Activity'],
  settings: ['CONFIGURATION', 'Settings'],
};
$$('#nav a').forEach(a => a.onclick = () => go(a.dataset.view));

async function go(view) {
  currentView = view;
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  $('#viewEyebrow').textContent = VIEWS[view][0];
  $('#viewTitle').textContent = VIEWS[view][1];
  $('#view').innerHTML = '<div class="empty">Loading…</div>';
  try { await RENDER[view](); } catch (err) { $('#view').innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
}
const refresh = () => go(currentView);

// ---------- modals ----------
function openModal(id) { $(id).classList.add('open'); }
function closeModals() { $$('.modal').forEach(m => m.classList.remove('open')); }
$$('[data-close]').forEach(b => b.onclick = closeModals);
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModals(); }));

// Client create / edit
// Note: always read inputs via form.elements — `form.id` would return the form's own id attribute.
const field = (form, name) => form.elements.namedItem(name);
const cf = $('#clientForm');
function updateProfit() {
  $('#profitPreview').textContent = pkr((+field(cf, 'selling_price').value || 0) - (+field(cf, 'purchase_price').value || 0));
}
field(cf, 'selling_price').oninput = field(cf, 'purchase_price').oninput = updateProfit;

function openClientModal(client) {
  cf.reset();
  const edit = !!client;
  $('#clientModalTitle').textContent = edit ? `Edit ${client.username}` : 'Create Client';
  $('#clientSubmit').textContent = edit ? 'Save changes' : 'Create Client';
  $$('.create-only').forEach(el => el.classList.toggle('hidden', edit));
  field(cf, 'username').disabled = edit;
  field(cf, 'id').value = edit ? client.id : '';
  if (edit) {
    for (const k of ['username', 'email', 'whatsapp', 'display_name', 'device_limit', 'purchase_price', 'selling_price', 'notes']) field(cf, k).value = client[k] ?? '';
  }
  updateProfit();
  openModal('#clientModal');
}
$('#newClientBtn').onclick = () => openClientModal(null);

cf.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(cf));
  try {
    if (data.id) {
      await api('/clients/' + data.id, { method: 'PUT', body: data });
      closeModals(); toast('Client updated'); refresh();
    } else {
      const r = await api('/clients', { method: 'POST', body: data });
      closeModals(); showPackage(r); refresh();
    }
  } catch (err) { toast(err.message); }
});

function showPackage(r) {
  $('#packageText').textContent = r.package;
  const send = $('#sendPackage');
  if (r.whatsapp_link) { send.href = r.whatsapp_link; send.classList.remove('hidden'); }
  else send.classList.add('hidden');
  openModal('#packageModal');
}
$('#copyPackage').onclick = async () => {
  await navigator.clipboard.writeText($('#packageText').textContent);
  toast('Copied — paste it in WhatsApp');
};

// Renew
const rf = $('#renewForm');
function openRenew(c) {
  rf.reset(); field(rf, 'id').value = c.id; field(rf, 'days').value = 30;
  $('#renewName').textContent = c.username;
  openModal('#renewModal');
}
$$('#renewForm .chip').forEach(ch => ch.onclick = () => { field(rf, 'days').value = ch.dataset.days; });
rf.addEventListener('submit', async e => {
  e.preventDefault();
  const days = +field(rf, 'days').value;
  try {
    await api(`/clients/${field(rf, 'id').value}/renew`, { method: 'POST', body: { days } });
    closeModals(); toast(`Renewed +${days} days`); refresh();
  } catch (err) { toast(err.message); }
});

// Client row actions
async function clientAction(id, action) {
  const c = (window.clientsCache || []).find(x => x.id === id);
  if (!c) return;
  try {
    if (action === 'edit') return openClientModal(c);
    if (action === 'renew') return openRenew(c);
    if (action === 'delete') {
      if (!confirm(`Delete ${c.username} permanently?`)) return;
      await api('/clients/' + id, { method: 'DELETE' }); toast('Client deleted');
    }
    if (action === 'suspend') { await api(`/clients/${id}/suspend`, { method: 'POST' }); toast('Client suspended'); }
    if (action === 'activate') { await api(`/clients/${id}/activate`, { method: 'POST' }); toast('Client unsuspended'); }
    if (action === 'reset-devices') {
      if (!confirm(`Sign ${c.username} out of all devices?`)) return;
      await api(`/clients/${id}/reset-devices`, { method: 'POST' }); toast('Devices reset');
    }
    if (action === 'reset-password') {
      if (!confirm(`Generate a new password for ${c.username}?`)) return;
      const r = await api(`/clients/${id}/reset-password`, { method: 'POST' });
      showPackage(r);
    }
    refresh();
  } catch (err) { toast(err.message); }
}

// ---------- start ----------
if (token) showApp();
