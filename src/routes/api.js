import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as employeeController from '../controllers/employeeController.js';
import * as leaveController from '../controllers/leaveController.js';
import * as payrollController from '../controllers/payrollController.js';
import * as officeController from '../controllers/officeController.js';
import * as reportController from '../controllers/reportController.js';

const router = express.Router();

// --- Public Authentication Routes ---
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/demo-accounts', authController.getDemoAccounts);

// --- Protected Routes (All Authenticated Users) ---
router.use(authenticate);

router.get('/auth/me', authController.getMe);
router.post('/auth/change-password', authController.changePassword);

// Employee Attendance
router.post('/attendance/check-in', attendanceController.checkIn);
router.post('/attendance/check-out', attendanceController.checkOut);
router.get('/attendance/today', attendanceController.getTodayStatus);
router.get('/attendance/my-history', attendanceController.getMyHistory);

// Employee Leaves
router.post('/leaves/apply', leaveController.applyLeave);
router.get('/leaves/my-leaves', leaveController.getMyLeaves);

// Employee Payroll & PDF Payslips
router.get('/payroll/my-slips', payrollController.getMySlips);
router.get('/payroll/slips/:id', payrollController.getPayslipDetails);
router.get('/payroll/slips/:id/pdf', payrollController.downloadPayslipPDF);

// Office locations info
router.get('/office/locations', officeController.getOfficeLocations);

// --- HR & Admin Management Routes ---
const hrOrAdmin = requireRole(['ADMIN', 'HR', 'HR_ADMIN']);
const adminOnly = requireRole(['ADMIN', 'HR_ADMIN']);

// Employee Management
router.get('/employees', hrOrAdmin, employeeController.getEmployees);
router.post('/employees', hrOrAdmin, employeeController.createEmployee);
router.get('/employees/:id', hrOrAdmin, employeeController.getEmployeeById);
router.put('/employees/:id', hrOrAdmin, employeeController.updateEmployee);
router.delete('/employees/:id', adminOnly, employeeController.deleteEmployee);

// Attendance Oversight
router.get('/attendance/all', hrOrAdmin, attendanceController.getAllAttendance);
router.put('/attendance/:id/override', hrOrAdmin, attendanceController.manualOverride);
router.post('/attendance/manual-entry', hrOrAdmin, attendanceController.manualEntry);

// Leave Approval Workflow
router.get('/leaves/all', hrOrAdmin, leaveController.getAllLeaves);
router.patch('/leaves/:id/status', hrOrAdmin, leaveController.updateLeaveStatus);

// Automated Payroll Generation & Oversight
router.post('/payroll/generate', hrOrAdmin, payrollController.generatePayroll);
router.get('/payroll/records', hrOrAdmin, payrollController.getPayrollRecords);
router.patch('/payroll/:id/status', hrOrAdmin, payrollController.updatePayrollStatus);

// Geofence Management
router.put('/office/locations/:id', adminOnly, officeController.updateOfficeLocation);
router.post('/office/sync-current', adminOnly, officeController.setOfficeToCurrentLocation);

// Reports Export (Excel/CSV/JSON)
router.get('/reports/attendance', hrOrAdmin, reportController.exportAttendanceReport);
router.get('/reports/payroll', hrOrAdmin, reportController.exportPayrollReport);

export default router;
