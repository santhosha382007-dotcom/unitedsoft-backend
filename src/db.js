import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

// Ensure data directory exists
const dataDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(config.DB_PATH);

// Initialize Tables
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      employee_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('EMPLOYEE', 'HR_ADMIN')),
      department TEXT,
      designation TEXT,
      phone TEXT,
      base_salary REAL DEFAULT 0,
      hra REAL DEFAULT 0,
      allowances REAL DEFAULT 0,
      pf_deduction REAL DEFAULT 0,
      tax_deduction REAL DEFAULT 0,
      joining_date TEXT,
      status TEXT DEFAULT 'ACTIVE',
      must_change_password INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS office_locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL NOT NULL DEFAULT 150,
      address TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      check_in_time TEXT,
      check_out_time TEXT,
      check_in_lat REAL,
      check_in_lng REAL,
      check_in_photo TEXT,
      check_out_lat REAL,
      check_out_lng REAL,
      status TEXT DEFAULT 'PRESENT',
      working_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      verification_method TEXT DEFAULT 'GPS_BIOMETRIC',
      distance_meters REAL DEFAULT 0,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_days REAL NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      approved_by TEXT,
      action_at TEXT,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      month_year TEXT NOT NULL,
      total_working_days INTEGER NOT NULL,
      present_days REAL NOT NULL,
      paid_leave_days REAL NOT NULL,
      unpaid_leave_days REAL NOT NULL,
      overtime_hours REAL NOT NULL,
      base_salary REAL NOT NULL,
      hra REAL NOT NULL,
      allowances REAL NOT NULL,
      overtime_pay REAL NOT NULL,
      gross_salary REAL NOT NULL,
      lop_deduction REAL NOT NULL,
      pf_deduction REAL NOT NULL,
      tax_deduction REAL NOT NULL,
      net_salary REAL NOT NULL,
      status TEXT DEFAULT 'PROCESSED',
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, month_year)
    );
  `);

  try {
    db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0');
  } catch (e) {}

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    console.log('Seeding initial UnitedSoft database records...');

    const salt = bcrypt.genSaltSync(10);
    const adminPass = bcrypt.hashSync('admin123', salt);

    // Seed Office Location
    const insertOffice = db.prepare(`
      INSERT INTO office_locations (id, name, latitude, longitude, radius_meters, address, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertOffice.run(
      config.DEFAULT_OFFICE.id,
      config.DEFAULT_OFFICE.name,
      config.DEFAULT_OFFICE.latitude,
      config.DEFAULT_OFFICE.longitude,
      config.DEFAULT_OFFICE.radius_meters,
      config.DEFAULT_OFFICE.address,
      1
    );

    // Seed Users (HR Admin)
    const insertUser = db.prepare(`
      INSERT INTO users (
        id, employee_code, full_name, email, password_hash, role,
        department, designation, phone, base_salary, hra, allowances,
        pf_deduction, tax_deduction, joining_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. HR / Admin
    insertUser.run(
      'usr-admin-01',
      'US-ADM-001',
      'Sarah Jenkins',
      'admin@unitedsoft.com',
      adminPass,
      'HR_ADMIN',
      'Human Resources',
      'HR Director & Admin',
      '+1-555-0100',
      95000,
      25000,
      10000,
      4000,
      12000,
      '2022-01-15',
      'ACTIVE'
    );

    console.log('Database initialized with HR Admin successfully.');
  }
}
