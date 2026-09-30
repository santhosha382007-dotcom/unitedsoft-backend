import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { config } from '../config.js';

// In-memory reset tokens for password recovery demo
const resetCodes = new Map();

export function login(req, res) {
  const { email, loginId, password } = req.body;
  const identifier = (loginId || email || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Login ID / Email and password are required' });
  }

  // Support login using either Email or Employee Code (Login ID)
  const user = db.prepare('SELECT * FROM users WHERE (email = ? COLLATE NOCASE OR employee_code = ? COLLATE NOCASE)').get(identifier, identifier);
  if (!user) {
    return res.status(401).json({ error: 'Invalid Login ID / Email or password' });
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Account is deactivated. Contact HR.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid Login ID / Email or password' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.JWT_SECRET,
    { expiresIn: '30d' }
  );

  const { password_hash, ...userProfile } = user;
  const office = db.prepare('SELECT * FROM office_locations WHERE is_active = 1 LIMIT 1').get();

  res.json({
    message: 'Login successful',
    token,
    user: userProfile,
    mustChangePassword: !!user.must_change_password,
    office
  });
}

export function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  const user = db.prepare('SELECT id, full_name, email FROM users WHERE email = ? COLLATE NOCASE').get(email.trim());
  if (!user) {
    // Return friendly message even if email not found for security
    return res.json({ message: 'If this email exists in our records, a password reset verification code has been dispatched.' });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  resetCodes.set(user.email.toLowerCase(), {
    code,
    userId: user.id,
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
  });

  res.json({
    message: 'Password reset code generated successfully',
    demo_code: code, // returned for mobile demo convenience
    email: user.email
  });
}

export function resetPassword(req, res) {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, verification code, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const record = resetCodes.get(email.toLowerCase().trim());
  if (!record || record.code !== code.trim() || Date.now() > record.expiresAt) {
    return res.status(400).json({ error: 'Invalid or expired verification code' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(newPassword, salt);

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, record.userId);
  resetCodes.delete(email.toLowerCase().trim());

  res.json({ message: 'Password has been reset successfully. You can now log in.' });
}

export function getMe(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { password_hash, ...userProfile } = user;
  const office = db.prepare('SELECT * FROM office_locations WHERE is_active = 1 LIMIT 1').get();

  res.json({ user: userProfile, office });
}

export function getDemoAccounts(req, res) {
  const users = db.prepare(`
    SELECT id, employee_code, full_name, email, role, department, designation
    FROM users
    WHERE status = 'ACTIVE'
  `).all();

  res.json({
    accounts: users.map(u => ({
      ...u,
      sample_password: (u.role === 'ADMIN' || u.role === 'HR_ADMIN') ? 'admin123' : 'emp123'
    }))
  });
}

export function changePassword(req, res) {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // If currentPassword provided, verify it (unless first-time password reset by staff)
  if (currentPassword) {
    const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match' });
    }
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(newPassword.trim(), salt);

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(passwordHash, userId);

  const updatedUser = db.prepare('SELECT id, employee_code, full_name, email, role, department, designation, phone, status, must_change_password FROM users WHERE id = ?').get(userId);

  res.json({
    message: 'Password updated successfully! You can now use your new password.',
    user: updatedUser
  });
}
