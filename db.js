const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Initial seed state
const defaultData = {
  admin: {
    username: 'admin',
    // bcrypt hash of 'admin123'
    passwordHash: '$2b$10$UVR/fd/sCrqAfzyKS1xwFu71GoROjF6lMdnZAYea.TT3NeJkoucz.', 
  },
  settings: {
    siteName: 'The Ultra Flow',
    tagline: 'Create Beyond Limits',
    announcement: 'The Ultra Flow v5.0 is now live for all active members!'
  },
  downloads: {
    windows: {
      version: '5.0.0',
      fileName: 'The-Ultra-Flow-v5.0.0-Setup.exe',
      url: '#', // placeholder, editable in admin panel
      note: 'Windows 10/11 (64-bit)',
      size: '84.2 MB'
    },
    android: {
      version: '5.3.1',
      fileName: 'The-Ultra-Flow-v5.3.1.apk',
      url: '#', // placeholder, editable in admin panel
      note: 'Android 8.0 or newer',
      size: '42.6 MB'
    }
  },
  users: []
};

// Ensure data dir exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function loadData() {
  if (!fs.existsSync(DB_FILE)) {
    // Generate demo user with password 'flow123'
    const salt = bcrypt.genSaltSync(10);
    const demoUser = {
      id: 'usr_demo_1',
      username: 'vip_creator',
      passwordHash: bcrypt.hashSync('flow123', salt),
      plan: '30 Days Pro Access',
      daysDuration: 30,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active'
    };
    const initData = { ...defaultData, users: [demoUser] };
    saveData(initData);
    return initData;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading DB, restoring fallback:', err);
    return defaultData;
  }
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// User Helpers
function calculateDaysRemaining(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function findUserByUsername(username) {
  const data = loadData();
  return data.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
}

function findUserById(id) {
  const data = loadData();
  return data.users.find(u => u.id === id);
}

function createUser({ username, password, plan, days }) {
  const data = loadData();
  const existing = data.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (existing) {
    throw new Error('Username already exists. Please choose a different username.');
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const daysNum = parseInt(days) || 30;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000).toISOString();

  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    username: username.trim(),
    passwordHash,
    plan: plan || `${daysNum} Days Access`,
    daysDuration: daysNum,
    createdAt: now.toISOString(),
    expiresAt,
    status: 'active'
  };

  data.users.push(newUser);
  saveData(data);
  return newUser;
}

function extendUser(id, addDays) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user) throw new Error('User not found');

  const currentExpiry = new Date(user.expiresAt).getTime();
  const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
  const newExpiry = new Date(baseTime + addDays * 24 * 60 * 60 * 1000).toISOString();

  user.expiresAt = newExpiry;
  user.status = 'active';
  saveData(data);
  return user;
}

function toggleUserStatus(id) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user) throw new Error('User not found');

  user.status = user.status === 'active' ? 'blocked' : 'active';
  saveData(data);
  return user;
}

function resetUserPassword(id, newPassword) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user) throw new Error('User not found');

  const salt = bcrypt.genSaltSync(10);
  user.passwordHash = bcrypt.hashSync(newPassword, salt);
  saveData(data);
  return true;
}

function deleteUser(id) {
  const data = loadData();
  const index = data.users.findIndex(u => u.id === id);
  if (index === -1) throw new Error('User not found');

  data.users.splice(index, 1);
  saveData(data);
  return true;
}

function getAllUsers() {
  const data = loadData();
  return data.users.map(u => ({
    id: u.id,
    username: u.username,
    plan: u.plan,
    daysRemaining: calculateDaysRemaining(u.expiresAt),
    expiresAt: u.expiresAt,
    createdAt: u.createdAt,
    status: u.status,
    isExpired: calculateDaysRemaining(u.expiresAt) === 0
  }));
}

function getDownloads() {
  const data = loadData();
  return data.downloads;
}

function updateDownloads(downloadsData) {
  const data = loadData();
  data.downloads = {
    ...data.downloads,
    ...downloadsData
  };
  saveData(data);
  return data.downloads;
}

function getStats() {
  const users = getAllUsers();
  const total = users.length;
  const active = users.filter(u => u.status === 'active' && !u.isExpired).length;
  const expired = users.filter(u => u.isExpired).length;
  const blocked = users.filter(u => u.status === 'blocked').length;

  return { total, active, expired, blocked };
}

module.exports = {
  loadData,
  findUserByUsername,
  findUserById,
  createUser,
  extendUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
  getAllUsers,
  getDownloads,
  updateDownloads,
  getStats,
  calculateDaysRemaining
};
