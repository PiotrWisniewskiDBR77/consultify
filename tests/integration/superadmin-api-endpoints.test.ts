/**
 * @vitest-environment node
 * 
 * SuperAdmin API Endpoints Verification Test
 * Verifies all 32 SuperAdmin API endpoints are correctly defined and mapped
 * to controller methods in server/routes/superadmin.js
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const routerFilePath = path.resolve(__dirname, '../../server/routes/superadmin.js');
const routerFileContent = readFileSync(routerFilePath, 'utf-8');

describe('SuperAdmin API Endpoints Verification', () => {
    
    describe('Organizations Endpoints (6 routes)', () => {
        it('GET /organizations - getOrganizations', () => {
            expect(routerFileContent).toContain("router.get('/organizations', superAdminController.getOrganizations)");
        });

        it('GET /dashboard - getDashboardStats', () => {
            expect(routerFileContent).toContain("router.get('/dashboard', superAdminController.getDashboardStats)");
        });

        it('GET /activities - getActivities', () => {
            expect(routerFileContent).toContain("router.get('/activities', superAdminController.getActivities)");
        });

        it('GET /activities/stats - getActivities', () => {
            expect(routerFileContent).toContain("router.get('/activities/stats', superAdminController.getActivities)");
        });

        it('PUT /organizations/:id - updateOrganization', () => {
            expect(routerFileContent).toContain("router.put('/organizations/:id', superAdminController.updateOrganization)");
        });

        it('DELETE /organizations/:id - deleteOrganization', () => {
            expect(routerFileContent).toContain("router.delete('/organizations/:id', superAdminController.deleteOrganization)");
        });

        it('GET /organizations/:id/billing - getOrgBilling', () => {
            expect(routerFileContent).toContain("router.get('/organizations/:id/billing', superAdminController.getOrgBilling)");
        });
    });

    describe('Users Endpoints (5 routes)', () => {
        it('GET /users - getUsers', () => {
            expect(routerFileContent).toContain("router.get('/users', superAdminController.getUsers)");
        });

        it('PUT /users/:id - updateUser', () => {
            expect(routerFileContent).toContain("router.put('/users/:id', superAdminController.updateUser)");
        });

        it('POST /users - createUser', () => {
            expect(routerFileContent).toContain("router.post('/users', superAdminController.createUser)");
        });

        it('POST /users/invite - inviteUser', () => {
            expect(routerFileContent).toContain("router.post('/users/invite', superAdminController.inviteUser)");
        });

        it('POST /users/:id/reset-password - resetUserPassword', () => {
            expect(routerFileContent).toContain("router.post('/users/:id/reset-password', superAdminController.resetUserPassword)");
        });
    });

    describe('Access Control Endpoints (5 routes)', () => {
        it('GET /access-requests - getAccessRequests', () => {
            expect(routerFileContent).toContain("router.get('/access-requests', superAdminController.getAccessRequests)");
        });

        it('POST /access-requests/:id/approve - approveAccessRequest', () => {
            expect(routerFileContent).toContain("router.post('/access-requests/:id/approve', superAdminController.approveAccessRequest)");
        });

        it('POST /access-requests/:id/reject - rejectAccessRequest', () => {
            expect(routerFileContent).toContain("router.post('/access-requests/:id/reject', superAdminController.rejectAccessRequest)");
        });

        it('GET /access-codes - getAccessCodes', () => {
            expect(routerFileContent).toContain("router.get('/access-codes', superAdminController.getAccessCodes)");
        });

        it('POST /access-codes - createAccessCode', () => {
            expect(routerFileContent).toContain("router.post('/access-codes', superAdminController.createAccessCode)");
        });
    });

    describe('Database Endpoints (2 routes)', () => {
        it('GET /database/tables - getDatabaseTables', () => {
            expect(routerFileContent).toContain("router.get('/database/tables', superAdminController.getDatabaseTables)");
        });

        it('GET /database/rows/:tableName - getDatabaseRows', () => {
            expect(routerFileContent).toContain("router.get('/database/rows/:tableName', superAdminController.getDatabaseRows)");
        });
    });

    describe('Storage Endpoints (3 routes)', () => {
        it('GET /storage/usage - getStorageUsage', () => {
            expect(routerFileContent).toContain("router.get('/storage/usage', superAdminController.getStorageUsage)");
        });

        it('GET /storage/files/:orgId - getStorageFiles', () => {
            expect(routerFileContent).toContain("router.get('/storage/files/:orgId', superAdminController.getStorageFiles)");
        });

        it('DELETE /storage/files - deleteStorageFile', () => {
            expect(routerFileContent).toContain("router.delete('/storage/files', superAdminController.deleteStorageFile)");
        });
    });

    describe('Legal Document Endpoints (6 routes)', () => {
        it('GET /legal/all - getAllLegalDocs', () => {
            expect(routerFileContent).toContain("router.get('/legal/all', superAdminController.getAllLegalDocs)");
        });

        it('POST /legal/publish - publishLegalDoc', () => {
            expect(routerFileContent).toContain("router.post('/legal/publish', superAdminController.publishLegalDoc)");
        });

        it('PUT /legal/:id/toggle-active - toggleLegalDocActive', () => {
            expect(routerFileContent).toContain("router.put('/legal/:id/toggle-active', superAdminController.toggleLegalDocActive)");
        });

        it('GET /legal/:id - getLegalDocById', () => {
            expect(routerFileContent).toContain("router.get('/legal/:id', superAdminController.getLegalDocById)");
        });

        it('GET /legal-events - getLegalEvents', () => {
            expect(routerFileContent).toContain("router.get('/legal-events', superAdminController.getLegalEvents)");
        });

        it('GET /legal-events/stats - getLegalEventStats', () => {
            expect(routerFileContent).toContain("router.get('/legal-events/stats', superAdminController.getLegalEventStats)");
        });
    });

    describe('Attribution Endpoints (4 routes)', () => {
        it('GET /organizations/:id/attribution - getOrgAttribution', () => {
            expect(routerFileContent).toContain("router.get('/organizations/:id/attribution', superAdminController.getOrgAttribution)");
        });

        it('GET /attribution/export - exportAttribution', () => {
            expect(routerFileContent).toContain("router.get('/attribution/export', superAdminController.exportAttribution)");
        });

        it('GET /attribution/partner-summary - getPartnerSummary', () => {
            expect(routerFileContent).toContain("router.get('/attribution/partner-summary', superAdminController.getPartnerSummary)");
        });
    });

    describe('Other Endpoints (1 route)', () => {
        it('POST /impersonate - impersonateUser', () => {
            expect(routerFileContent).toContain("router.post('/impersonate', superAdminController.impersonateUser)");
        });
    });

    describe('Middleware Verification', () => {
        it('should use verifySuperAdmin middleware', () => {
            expect(routerFileContent).toContain('router.use(verifySuperAdmin)');
        });

        it('should import superAdminController', () => {
            expect(routerFileContent).toContain("require('../controllers/superAdminController')");
        });
    });

    describe('Route Count Verification', () => {
        it('should have exactly 32 route definitions', () => {
            const routeMatches = routerFileContent.match(/router\.(get|post|put|delete|patch)\(/g) || [];
            expect(routeMatches.length).toBe(32);
        });

        it('should have GET routes', () => {
            const getRoutes = (routerFileContent.match(/router\.get\(/g) || []).length;
            expect(getRoutes).toBe(19); // Updated based on actual routes file
        });

        it('should have POST routes', () => {
            const postRoutes = (routerFileContent.match(/router\.post\(/g) || []).length;
            expect(postRoutes).toBe(8);
        });

        it('should have PUT routes', () => {
            const putRoutes = (routerFileContent.match(/router\.put\(/g) || []).length;
            expect(putRoutes).toBe(3); // Updated based on actual routes file
        });

        it('should have DELETE routes', () => {
            const deleteRoutes = (routerFileContent.match(/router\.delete\(/g) || []).length;
            expect(deleteRoutes).toBe(2);
        });
    });
});

describe('API-Frontend Mapping Verification', () => {
    // Check that services/api.ts has corresponding methods for critical endpoints
    const apiFilePath = path.resolve(__dirname, '../../services/api.ts');
    let apiFileContent: string;
    
    try {
        apiFileContent = readFileSync(apiFilePath, 'utf-8');
    } catch {
        apiFileContent = '';
    }

    it('Api.getOrganizations should map to /superadmin/organizations', () => {
        expect(apiFileContent).toContain('getOrganizations');
        expect(apiFileContent).toContain('/superadmin/organizations');
    });

    it('Api.getSuperAdminDashboard should map to /superadmin/dashboard', () => {
        expect(apiFileContent).toContain('getSuperAdminDashboard');
        expect(apiFileContent).toContain('/superadmin/dashboard');
    });

    it('Api.getSuperAdminUsers should map to /superadmin/users', () => {
        expect(apiFileContent).toContain('getSuperAdminUsers');
        expect(apiFileContent).toContain('/superadmin/users');
    });

    it('Api.getAccessRequests should map to /superadmin/access-requests', () => {
        expect(apiFileContent).toContain('getAccessRequests');
        expect(apiFileContent).toContain('/superadmin/access-requests');
    });

    it('Api.getAccessCodes should map to /superadmin/access-codes', () => {
        expect(apiFileContent).toContain('getAccessCodes');
        expect(apiFileContent).toContain('/superadmin/access-codes');
    });

    it('Api.getFeedback should exist for feedback functionality', () => {
        expect(apiFileContent).toContain('getFeedback');
    });
});
