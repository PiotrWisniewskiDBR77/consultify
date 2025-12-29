const express = require('express');
const router = express.Router();
const verifySuperAdmin = require('../middleware/superAdminMiddleware');
const superAdminController = require('../controllers/superAdminController');

router.use(verifySuperAdmin);

// Organizations
router.get('/organizations', superAdminController.getOrganizations);
router.get('/activities', superAdminController.getActivities);
router.get('/activities/stats', superAdminController.getActivities);
router.get('/dashboard', superAdminController.getDashboardStats);
router.put('/organizations/:id', superAdminController.updateOrganization);

// DELETE Organization
router.delete('/organizations/:id', superAdminController.deleteOrganization);

// GET Organization Billing Details
router.get('/organizations/:id/billing', superAdminController.getOrgBilling);

// GET All Users (Super Admin)
router.get('/users', superAdminController.getUsers);

// UPDATE User (Super Admin - e.g. move org, change role)
router.put('/users/:id', superAdminController.updateUser);

// CREATE Super Admin User
router.post('/users', superAdminController.createUser);

// INVITE USER (Super Admin)
router.post('/users/invite', superAdminController.inviteUser);

// RESET PASSWORD LINK (Super Admin)
router.post('/users/:id/reset-password', superAdminController.resetUserPassword);

// ACCESS REQUESTS
router.get('/access-requests', superAdminController.getAccessRequests);
router.post('/access-requests/:id/approve', superAdminController.approveAccessRequest);
router.post('/access-requests/:id/reject', superAdminController.rejectAccessRequest);

// ACCESS CODES
router.get('/access-codes', superAdminController.getAccessCodes);
router.post('/access-codes', superAdminController.createAccessCode);

// IMPERSONATE USER
router.post('/impersonate', superAdminController.impersonateUser);

// DATABASE EXPLORER
router.get('/database/tables', superAdminController.getDatabaseTables);
router.get('/database/rows/:tableName', superAdminController.getDatabaseRows);

// STORAGE
router.get('/storage/usage', superAdminController.getStorageUsage);
router.get('/storage/files/:orgId', superAdminController.getStorageFiles);
router.delete('/storage/files', superAdminController.deleteStorageFile);

// LEGAL DOCUMENT MANAGEMENT
router.get('/legal/all', superAdminController.getAllLegalDocs);
router.post('/legal/publish', superAdminController.publishLegalDoc);
router.put('/legal/:id/toggle-active', superAdminController.toggleLegalDocActive);
router.get('/legal/:id', superAdminController.getLegalDocById);

// LEGAL EVENTS AUDIT LOG
router.get('/legal-events', superAdminController.getLegalEvents);
router.get('/legal-events/stats', superAdminController.getLegalEventStats);

// ATTRIBUTION SYSTEM
router.get('/organizations/:id/attribution', superAdminController.getOrgAttribution);
router.get('/attribution/export', superAdminController.exportAttribution);
router.get('/attribution/partner-summary', superAdminController.getPartnerSummary);

module.exports = router;
