// The Ultra Flow — Admin panel views (loaded before admin.js)
let clientFilter = 'all';
let clientSearch = '';

function clientRow(c) {
  const sus = c.status === 'suspended';
  return `<tr>
    <td><strong>${esc(c.display_name || c.username)}</strong><span class="sub">@${esc(c.username)}</span></td>
    <td>${c.whatsapp ? `<a class="mini wa" target="_blank" rel="noopener" href="https://wa.me/${esc(c.whatsapp.replace(/\D/g, ''))}">${esc(c.whatsapp)}</a>` : '<span class="muted">—</span>'}</td>
    <td>${fmtDate(c.created_at)}</td>
    <td>${c.activated_at ? fmtDate(c.expires_at) : '<span class="muted">Not activated</span>'}<span class="sub">${c.days_remaining} days left</span></td>
    <td>${c.device_count}/${c.device_limit}</td>
    <td><span class="badge ${c.status}">${c.status === 'pending' ? 'not activated' : c.status}</span></td>
    <td><div class="actions">
      <button class="mini" onclick="clientAction(${c.id},'renew')">Renew</button>
      <button class="mini" onclick="clientAction(${c.id},'edit')">Edit</button>
      <button class="mini" onclick="clientAction(${c.id},'reset-devices')">Reset devices</button>
      <button class="mini" onclick="clientAction(${c.id},'reset-password')">New password</button>
      <button class="mini warn" onclick="clientAction(${c.id},'${sus ? 'activate' : 'suspend'}')">${sus ? 'Unsuspend' : 'Suspend'}</button>
      <button class="mini danger" onclick="clientAction(${c.id},'delete')">Delete</button>
    </div></td>
  </tr>`;
}

function drawClientTable() {
  const list = window.clientsCache
    .filter(c => clientFilter === 'all' || c.status === clientFilter)
    .filter(c => !clientSearch || [c.username, c.display_name, c.whatsapp, c.email].some(v => (v || '').toLowerCase().includes(clientSearch)));
  $('#clientRows').innerHTML = list.length ? list.map(clientRow).join('') : '<tr><td colspan="7" class="empty">No clients here yet</td></tr>';
}

const RENDER = {
  async dashboard() {
    const { stats: s, events, releases } = await api('/dashboard');
    const pct = n => s.total ? Math.round((n / s.total) * 100) : 0;
    $('#view').innerHTML = `
      <div class="stats">
        <div class="stat"><small>Total clients</small><strong>${s.total}</strong></div>
        <div class="stat green"><small>Active</small><strong>${s.active}</strong></div>
        <div class="stat cyan"><small>Not activated</small><strong>${s.pending}</strong></div>
        <div class="stat yellow"><small>Expired</small><strong>${s.expired}</strong></div>
        <div class="stat red"><small>Suspended</small><strong>${s.suspended}</strong></div>
        <div class="stat"><small>Devices</small><strong>${s.devices}</strong></div>
      </div>
      <div class="two-col">
        <div class="card">
          <h3>Status breakdown</h3>
          ${[['Active', s.active, 'var(--green)'], ['Not activated', s.pending, 'var(--cyan)'], ['Expired', s.expired, 'var(--yellow)'], ['Suspended', s.suspended, 'var(--red)']]
            .map(([l, n, c]) => `<div class="bar-row"><div class="lbl"><span>${l}</span><span>${n}</span></div><div class="bar"><i style="width:${pct(n)}%;background:${c}"></i></div></div>`).join('')}
          <div class="stats" style="margin:14px 0 0">
            <div class="stat"><small>Revenue</small><strong style="font-size:18px">${pkr(s.revenue)}</strong></div>
            <div class="stat green"><small>Profit</small><strong style="font-size:18px">${pkr(s.profit)}</strong></div>
            <div class="stat yellow"><small>Expiring ≤ 3 days</small><strong style="font-size:18px">${s.expiring_soon}</strong></div>
          </div>
        </div>
        <div class="card">
          <h3>Latest events</h3>
          <ul class="events">${events.length ? events.map(e => `<li><div><i class="dot"></i>${esc(e.type)} <span>${esc(e.detail)}</span></div><span>${fmtTime(e.created_at)}</span></li>`).join('') : '<li class="muted">No activity yet</li>'}</ul>
          <h3 style="margin-top:16px">Releases</h3>
          <p class="muted">Windows v${esc(releases.windows)} · Android v${esc(releases.android)}</p>
        </div>
      </div>`;
  },

  async clients() {
    const { clients } = await api('/clients');
    window.clientsCache = clients;
    const count = f => f === 'all' ? clients.length : clients.filter(c => c.status === f).length;
    const label = { all: 'All', active: 'Active', pending: 'Not activated', expired: 'Expired', suspended: 'Suspended' };
    $('#view').innerHTML = `
      <div class="toolbar">
        <input id="clientSearch" placeholder="Search name, username, WhatsApp…" value="${esc(clientSearch)}" />
        <div class="chips">${Object.keys(label).map(f => `<button class="chip ${f === clientFilter ? 'active' : ''}" data-f="${f}">${label[f]} ${count(f)}</button>`).join('')}</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Client</th><th>WhatsApp</th><th>Created</th><th>Expiry</th><th>Devices</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="clientRows"></tbody>
      </table></div>`;
    $$('.toolbar .chip').forEach(ch => ch.onclick = () => {
      clientFilter = ch.dataset.f;
      $$('.toolbar .chip').forEach(x => x.classList.toggle('active', x === ch));
      drawClientTable();
    });
    $('#clientSearch').oninput = e => { clientSearch = e.target.value.toLowerCase().trim(); drawClientTable(); };
    drawClientTable();
  },

  async expiry() {
    const { clients } = await api('/expiry');
    window.clientsCache = clients;
    $('#view').innerHTML = `
      <p class="muted" style="margin-bottom:14px">Clients that have expired or expire within 7 days. Send them a WhatsApp reminder in one tap.</p>
      <div class="cards-grid">${clients.length ? clients.map(c => `
        <div class="client-card">
          <div class="row"><strong style="color:var(--text);font-size:14px">${esc(c.display_name || c.username)}</strong><span class="badge ${c.status}">${c.status}</span></div>
          <div class="big" style="color:${c.status === 'expired' ? 'var(--yellow)' : 'var(--cyan)'}">${c.status === 'expired' ? 'Expired' : c.days_remaining + ' days left'}</div>
          <div class="row"><span>Expiry</span><span>${fmtDate(c.expires_at)}</span></div>
          <div class="row"><span>WhatsApp</span><span>${esc(c.whatsapp || '—')}</span></div>
          <div style="display:flex;gap:6px;margin-top:4px">
            ${c.whatsapp_link ? `<a class="btn btn-whatsapp" style="flex:1" target="_blank" rel="noopener" href="${esc(c.whatsapp_link)}">Send WhatsApp</a>` : ''}
            <button class="btn btn-ghost" onclick="clientAction(${c.id},'renew')">Renew</button>
          </div>
        </div>`).join('') : '<div class="empty">No clients are expiring soon 🎉</div>'}</div>`;
  },

  async notices() {
    const { notices } = await api('/notices');
    $('#view').innerHTML = `
      <div class="two-col">
        <form class="card" id="noticeForm">
          <h3>New client notice</h3>
          <div class="form-grid">
            <label>Audience<input name="audience" value="all" placeholder="all  or  a username" /><small>"all" = every client, ya kisi ek client ka username</small></label>
            <label>Priority<select name="priority"><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
            <label>Show from (optional)<input name="starts_at" type="datetime-local" /></label>
            <label>Show until (optional)<input name="ends_at" type="datetime-local" /></label>
            <label class="full">Title<input name="title" required placeholder="Important account update" /></label>
            <label class="full">Message<textarea name="message" required placeholder="Write the message clients will see in the app"></textarea></label>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:14px">Send notice</button>
        </form>
        <div class="card">
          <h3>Current notices</h3>
          ${notices.length ? notices.map(n => `
            <div style="padding:10px 0;border-bottom:1px solid var(--line)">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
                <strong>${esc(n.title)}</strong>
                <span><span class="badge ${n.priority}">${n.priority}</span> <button class="mini danger" onclick="deleteNotice(${n.id})">Delete</button></span>
              </div>
              <p class="muted" style="margin:4px 0;font-size:13px">${esc(n.message)}</p>
              <span class="sub" style="color:var(--dim);font-size:11px">To: ${esc(n.audience)} · ${fmtTime(n.created_at)}${n.ends_at ? ' · until ' + fmtTime(n.ends_at) : ''}</span>
            </div>`).join('') : '<div class="empty">No notices yet</div>'}
        </div>
      </div>`;
    $('#noticeForm').onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      for (const k of ['starts_at', 'ends_at']) d[k] = d[k] ? new Date(d[k]).toISOString() : '';
      try { await api('/notices', { method: 'POST', body: d }); toast('Notice sent'); refresh(); } catch (err) { toast(err.message); }
    };
  },

  async pricing() {
    const { totals: t, clients } = await api('/analytics');
    $('#view').innerHTML = `
      <div class="stats">
        <div class="stat"><small>Revenue</small><strong>${pkr(t.revenue)}</strong></div>
        <div class="stat red"><small>Cost</small><strong>${pkr(t.cost)}</strong></div>
        <div class="stat green"><small>Profit</small><strong>${pkr(t.profit)}</strong></div>
        <div class="stat cyan"><small>Margin</small><strong>${t.margin}%</strong></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Client</th><th>Status</th><th>Purchase</th><th>Selling</th><th>Profit</th><th>Created</th></tr></thead>
        <tbody>${clients.length ? clients.map(c => `<tr>
          <td>@${esc(c.username)}</td><td><span class="badge ${c.status}">${c.status}</span></td>
          <td>${pkr(c.purchase_price)}</td><td>${pkr(c.selling_price)}</td>
          <td style="color:${c.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${pkr(c.profit)}</td><td>${fmtDate(c.created_at)}</td>
        </tr>`).join('') : '<tr><td colspan="6" class="empty">No clients yet</td></tr>'}</tbody>
      </table></div>`;
  },

  async devices() {
    const { devices } = await api('/devices');
    $('#view').innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Client</th><th>Platform</th><th>Device</th><th>App</th><th>First seen</th><th>Last seen</th><th></th></tr></thead>
        <tbody>${devices.length ? devices.map(d => `<tr>
          <td>@${esc(d.username)}</td><td>${esc(d.platform || '—')}</td><td>${esc(d.device_name || d.device_id.slice(0, 10))}</td>
          <td>${esc(d.app_version || '—')}</td><td>${fmtTime(d.first_seen)}</td><td>${fmtTime(d.last_seen)}</td>
          <td><button class="mini danger" onclick="revokeDevice(${d.id})">Revoke</button></td>
        </tr>`).join('') : '<tr><td colspan="7" class="empty">No devices yet — they appear when clients sign in to the app</td></tr>'}</tbody>
      </table></div>`;
  },

  async activity() {
    const { activity } = await api('/activity');
    $('#view').innerHTML = `<div class="card"><ul class="events">${activity.length ? activity.map(e =>
      `<li><div><i class="dot"></i>${esc(e.type)} <span>${esc(e.detail)}</span></div><span>${fmtTime(e.created_at)}</span></li>`).join('') : '<li class="muted">No activity yet</li>'}</ul></div>`;
  },

  async settings() {
    const { settings: s } = await api('/settings');
    const f = (k, label, ph = '') => `<label>${label}<input name="${k}" value="${esc(s[k] || '')}" placeholder="${ph}" /></label>`;
    $('#view').innerHTML = `
      <form id="settingsForm">
        <div class="card"><h3>Brand</h3><div class="form-grid">
          ${f('brand_name', 'Brand name')}${f('portal_url', 'Download website', 'https://…')}
          ${f('support_whatsapp', 'Support WhatsApp', '923001234567')}${f('min_app_version', 'Minimum app version', 'e.g. 1.0.0')}
        </div></div>
        <div class="card"><h3>App releases</h3><div class="form-grid">
          ${f('windows_version', 'Windows version')}${f('windows_url', 'Windows download link', 'https://…')}
          ${f('android_version', 'Android version')}${f('android_url', 'Android download link', 'https://…')}
        </div></div>
        <div class="card"><h3>Admin password</h3><div class="form-grid">
          <label>New admin password<input name="new_admin_password" type="password" placeholder="Leave blank to keep current" minlength="8" /></label>
        </div></div>
        <button class="btn btn-primary">Save settings</button>
      </form>`;
    $('#settingsForm').onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      if (!d.new_admin_password) delete d.new_admin_password;
      try { await api('/settings', { method: 'PUT', body: d }); toast('Settings saved'); refresh(); } catch (err) { toast(err.message); }
    };
  },
};

async function deleteNotice(id) {
  if (!confirm('Delete this notice?')) return;
  try { await api('/notices/' + id, { method: 'DELETE' }); toast('Notice deleted'); refresh(); } catch (err) { toast(err.message); }
}
async function revokeDevice(id) {
  if (!confirm('Sign this device out?')) return;
  try { await api(`/devices/${id}/revoke`, { method: 'POST' }); toast('Device revoked'); refresh(); } catch (err) { toast(err.message); }
}
