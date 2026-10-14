// The Ultra Flow - Client Script
document.addEventListener('DOMContentLoaded', () => {
  loadPublicDownloads();

  // If on admin.html (secret console), check admin login
  if (document.getElementById('adminLoginView')) {
    checkAdminAuth();
  }
});

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// Public Downloads Fetcher (Landing Page)
async function loadPublicDownloads() {
  try {
    const res = await fetch('/api/public/downloads');
    const data = await res.json();
    if (data.ok && data.downloads) {
      const { windows, android } = data.downloads;

      // Update Windows Card
      const winTag = document.getElementById('winVersionTag');
      const winBtn = document.getElementById('btnWinDownload');
      if (winTag && windows) {
        winTag.textContent = `v${windows.version} · Setup Installer`;
      }
      if (winBtn && windows) {
        if (windows.url && windows.url !== '#') {
          winBtn.href = windows.url;
          winBtn.target = '_blank';
        } else {
          winBtn.href = '#';
          winBtn.onclick = (e) => {
            e.preventDefault();
            showToast('Windows download link will be activated shortly.');
          };
        }
      }

      // Update Android Card
      const androidTag = document.getElementById('androidVersionTag');
      const androidBtn = document.getElementById('btnAndroidDownload');
      if (androidTag && android) {
        androidTag.textContent = `v${android.version} · APK`;
      }
      if (androidBtn && android) {
        if (android.url && android.url !== '#') {
          androidBtn.href = android.url;
          androidBtn.target = '_blank';
        } else {
          androidBtn.href = '#';
          androidBtn.onclick = (e) => {
            e.preventDefault();
            showToast('Android APK download link will be activated shortly.');
          };
        }
      }
    }
  } catch (err) {
    console.error('Failed to load public downloads:', err);
  }
}

// --- STANDALONE ADMIN / SELLER LOGIC (Only for secret admin.html) ---
function checkAdminAuth() {
  const token = localStorage.getItem('ultra_admin_token');
  if (token) {
    loadAdminDashboard();
  } else {
    const loginView = document.getElementById('adminLoginView');
    const dashView = document.getElementById('adminDashboardView');
    if (loginView) loginView.style.display = 'block';
    if (dashView) dashView.style.display = 'none';
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('adminUser').value.trim();
  const password = document.getElementById('adminPass').value.trim();
  const errBox = document.getElementById('adminLoginError');

  if (errBox) errBox.style.display = 'none';

  try {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      if (errBox) {
        errBox.textContent = data.error || 'Invalid credentials';
        errBox.style.display = 'block';
      }
      return;
    }

    localStorage.setItem('ultra_admin_token', data.token);
    showToast('Admin logged in');
    loadAdminDashboard();
  } catch (err) {
    if (errBox) {
      errBox.textContent = 'Connection error';
      errBox.style.display = 'block';
    }
  }
}

function handleAdminLogout() {
  localStorage.removeItem('ultra_admin_token');
  const loginView = document.getElementById('adminLoginView');
  const dashView = document.getElementById('adminDashboardView');
  if (loginView) loginView.style.display = 'block';
  if (dashView) dashView.style.display = 'none';
  showToast('Logged out');
}

async function loadAdminDashboard() {
  const loginView = document.getElementById('adminLoginView');
  const dashView = document.getElementById('adminDashboardView');
  if (loginView) loginView.style.display = 'none';
  if (dashView) dashView.style.display = 'block';

  await Promise.all([
    fetchAdminStats(),
    fetchAdminUsers(),
    fetchAdminDownloads()
  ]);
}

function switchAdminTab(tabName) {
  const tabs = ['createUser', 'manageUsers', 'downloadSettings'];
  tabs.forEach(t => {
    const content = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (content) content.style.display = (t === tabName) ? 'block' : 'none';
  });

  const buttons = document.querySelectorAll('.atab-btn');
  buttons.forEach((btn, index) => {
    btn.classList.toggle('active', tabs[index] === tabName);
  });
}

async function fetchAdminStats() {
  const token = localStorage.getItem('ultra_admin_token');
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.ok) {
      const t = document.getElementById('statTotalUsers');
      const a = document.getElementById('statActiveUsers');
      const e = document.getElementById('statExpiredUsers');
      const b = document.getElementById('statBlockedUsers');
      if (t) t.textContent = data.stats.total;
      if (a) a.textContent = data.stats.active;
      if (e) e.textContent = data.stats.expired;
      if (b) b.textContent = data.stats.blocked;
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

let allAdminUsers = [];
async function fetchAdminUsers() {
  const token = localStorage.getItem('ultra_admin_token');
  try {
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.ok) {
      allAdminUsers = data.users;
      renderAdminUsersTable(allAdminUsers);
    }
  } catch (err) {
    console.error('Users error:', err);
  }
}

function renderAdminUsersTable(users) {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">No users found.</td></tr>`;
    return;
  }

  users.forEach(u => {
    const tr = document.createElement('tr');
    const isAct = u.status === 'active' && !u.isExpired;
    const statusChip = `<span class="chip chip-${isAct ? 'active' : (u.status === 'blocked' ? 'blocked' : 'expired')}">${u.status === 'blocked' ? 'Blocked' : (isAct ? 'Active' : 'Expired')}</span>`;
    const expStr = u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : '-';

    tr.innerHTML = `
      <td><strong>@${u.username}</strong></td>
      <td>${u.plan}</td>
      <td><strong style="color:var(--primary-cyan);">${u.daysRemaining}d</strong></td>
      <td>${expStr}</td>
      <td>${statusChip}</td>
      <td class="actions-cell">
        <button class="btn btn-secondary btn-xs" onclick="adminExtendUser('${u.id}', 30)">+30d</button>
        <button class="btn btn-secondary btn-xs" onclick="adminToggleStatus('${u.id}')">${u.status === 'active' ? 'Block' : 'Unblock'}</button>
        <button class="btn btn-danger-ghost btn-xs" onclick="adminDeleteUser('${u.id}', '${u.username}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterUsersTable() {
  const input = document.getElementById('userSearchInput');
  if (!input) return;
  const query = input.value.toLowerCase().trim();
  const filtered = allAdminUsers.filter(u => u.username.toLowerCase().includes(query));
  renderAdminUsersTable(filtered);
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let pass = '';
  for (let i = 0; i < 9; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const input = document.getElementById('newPasswordInput');
  if (input) input.value = pass;
}

async function handleCreateUser(e) {
  e.preventDefault();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPasswordInput').value.trim();
  const plan = document.getElementById('newPlanName').value.trim();
  const days = document.getElementById('newDays').value;
  const token = localStorage.getItem('ultra_admin_token');

  try {
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username, password, plan, days })
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      showToast(data.error || 'Failed to create user');
      return;
    }

    showToast(`Account created for @${data.user.username}!`);
    document.getElementById('createUserForm').reset();
    document.getElementById('newPlanName').value = '30 Days Pro Access';
    document.getElementById('newDays').value = '30';

    const origin = window.location.origin;
    const template = `🚀 THE ULTRA FLOW ACCOUNT
━━━━━━━━━━━━━━━━━━━━
👤 Username: ${data.user.username}
🔑 Password: ${data.user.rawPassword}
📦 Plan: ${data.user.plan}
⏳ Duration: ${data.user.daysDuration} Days
━━━━━━━━━━━━━━━━━━━━
Use these credentials inside the app to sign in!`;

    document.getElementById('generatedAccountText').textContent = template;
    document.getElementById('generatedCard').style.display = 'block';

    fetchAdminStats();
    fetchAdminUsers();
  } catch (err) {
    showToast('Failed to create account.');
  }
}

function copyAccountDetails() {
  const text = document.getElementById('generatedAccountText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!');
  }).catch(() => {
    showToast('Copy failed, please copy manually.');
  });
}

async function adminExtendUser(id, days) {
  const token = localStorage.getItem('ultra_admin_token');
  try {
    const res = await fetch('/api/admin/users/extend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id, days })
    });
    const data = await res.json();
    if (data.ok) {
      showToast(`Added ${days} days!`);
      fetchAdminStats();
      fetchAdminUsers();
    }
  } catch (err) {
    showToast('Failed to extend days.');
  }
}

async function adminToggleStatus(id) {
  const token = localStorage.getItem('ultra_admin_token');
  try {
    const res = await fetch('/api/admin/users/toggle-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.ok) {
      showToast(`Status updated: ${data.status}`);
      fetchAdminStats();
      fetchAdminUsers();
    }
  } catch (err) {
    showToast('Failed to update status.');
  }
}

async function adminDeleteUser(id, username) {
  if (!confirm(`Delete @${username}?`)) return;
  const token = localStorage.getItem('ultra_admin_token');
  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.ok) {
      showToast(`Deleted @${username}`);
      fetchAdminStats();
      fetchAdminUsers();
    }
  } catch (err) {
    showToast('Failed to delete.');
  }
}

async function fetchAdminDownloads() {
  try {
    const res = await fetch('/api/public/downloads');
    const data = await res.json();
    if (data.ok && data.downloads) {
      const { windows, android } = data.downloads;
      if (windows) {
        const v = document.getElementById('winVersionInput');
        const f = document.getElementById('winFileNameInput');
        const u = document.getElementById('winUrlInput');
        if (v) v.value = windows.version || '5.0.0';
        if (f) f.value = windows.fileName || '';
        if (u) u.value = windows.url === '#' ? '' : (windows.url || '');
      }
      if (android) {
        const v = document.getElementById('androidVersionInput');
        const f = document.getElementById('androidFileNameInput');
        const u = document.getElementById('androidUrlInput');
        if (v) v.value = android.version || '5.3.1';
        if (f) f.value = android.fileName || '';
        if (u) u.value = android.url === '#' ? '' : (android.url || '');
      }
    }
  } catch (err) {
    console.error('Downloads fetch error:', err);
  }
}

async function handleSaveDownloads(e) {
  e.preventDefault();
  const token = localStorage.getItem('ultra_admin_token');

  const windows = {
    version: document.getElementById('winVersionInput').value.trim(),
    fileName: document.getElementById('winFileNameInput').value.trim(),
    url: document.getElementById('winUrlInput').value.trim() || '#'
  };

  const android = {
    version: document.getElementById('androidVersionInput').value.trim(),
    fileName: document.getElementById('androidFileNameInput').value.trim(),
    url: document.getElementById('androidUrlInput').value.trim() || '#'
  };

  try {
    const res = await fetch('/api/admin/downloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ windows, android })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('Download links updated!');
      loadPublicDownloads();
    }
  } catch (err) {
    showToast('Failed to save links.');
  }
}
