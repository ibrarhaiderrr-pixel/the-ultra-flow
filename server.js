const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ultra-flow-secret-key-2026-xyz';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to authenticate regular users
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const user = db.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact your seller.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// Middleware to authenticate admin
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin access required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Admin session expired. Please log in again.' });
  }
}

// --- PUBLIC APIS ---

// Get public download info
app.get('/api/public/downloads', (req, res) => {
  const downloads = db.getDownloads();
  res.json({ ok: true, downloads });
});

// User Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. Please verify your login details.' });
  }

  const passwordMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials. Password is incorrect.' });
  }

  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Account suspended. Contact your seller for assistance.' });
  }

  const daysRemaining = db.calculateDaysRemaining(user.expiresAt);
  const token = jwt.sign(
    { id: user.id, username: user.username, role: 'user' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    ok: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      plan: user.plan,
      daysRemaining,
      expiresAt: user.expiresAt,
      status: user.status,
      isExpired: daysRemaining === 0
    }
  });
});

// Admin Login
app.post('/api/auth/admin-login', (req, res) => {
  const { username, password } = req.body;
  const data = db.loadData();

  if (username !== data.admin.username) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const isMatch = bcrypt.compareSync(password, data.admin.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = jwt.sign(
    { username: data.admin.username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ ok: true, token });
});

// --- USER PORTAL APIS ---

// Get current user details and downloads
app.get('/api/user/me', authenticateUser, (req, res) => {
  const user = req.user;
  const daysRemaining = db.calculateDaysRemaining(user.expiresAt);
  const downloads = db.getDownloads();

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      plan: user.plan,
      daysRemaining,
      expiresAt: user.expiresAt,
      status: user.status,
      createdAt: user.createdAt,
      isExpired: daysRemaining === 0
    },
    downloads
  });
});

// User self password change
app.post('/api/user/change-password', authenticateUser, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const isMatch = bcrypt.compareSync(currentPassword, req.user.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Current password is not correct' });
  }

  db.resetUserPassword(req.user.id, newPassword);
  res.json({ ok: true, message: 'Password updated successfully' });
});

// --- ADMIN CONTROL APIS ---

app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
  const stats = db.getStats();
  res.json({ ok: true, stats });
});

app.get('/api/admin/users', authenticateAdmin, (req, res) => {
  const users = db.getAllUsers();
  res.json({ ok: true, users });
});

app.post('/api/admin/users/create', authenticateAdmin, (req, res) => {
  const { username, password, plan, days } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const newUser = db.createUser({ username, password, plan, days });
    res.json({
      ok: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        plan: newUser.plan,
        daysDuration: newUser.daysDuration,
        expiresAt: newUser.expiresAt,
        rawPassword: password // returned once so seller can copy it immediately
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/users/extend', authenticateAdmin, (req, res) => {
  const { id, days } = req.body;
  if (!id || !days) {
    return res.status(400).json({ error: 'User ID and days are required' });
  }

  try {
    const updated = db.extendUser(id, parseInt(days));
    res.json({ ok: true, user: updated, daysRemaining: db.calculateDaysRemaining(updated.expiresAt) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/users/toggle-status', authenticateAdmin, (req, res) => {
  const { id } = req.body;
  try {
    const user = db.toggleUserStatus(id);
    res.json({ ok: true, status: user.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/users/reset-password', authenticateAdmin, (req, res) => {
  const { id, newPassword } = req.body;
  if (!id || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required' });
  }
  try {
    db.resetUserPassword(id, newPassword);
    res.json({ ok: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authenticateAdmin, (req, res) => {
  try {
    db.deleteUser(req.params.id);
    res.json({ ok: true, message: 'User deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/downloads', authenticateAdmin, (req, res) => {
  const { windows, android } = req.body;
  try {
    const updated = db.updateDownloads({ windows, android });
    res.json({ ok: true, downloads: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fallback to frontend index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 The Ultra Flow Server is running!`);
  console.log(`🌐 Website URL: http://localhost:${PORT}`);
  console.log(`🔑 Admin Login: Username: admin | Password: admin123`);
  console.log(`👤 Demo User:   Username: vip_creator | Password: flow123`);
  console.log(`===============================================`);
});
