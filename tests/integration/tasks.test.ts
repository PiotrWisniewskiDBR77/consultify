import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { testFactory } from '../helpers/TestFactory';
import app from '../../server/src/index'; // Ensure this exports the express app

describe('Tasks Integration', () => {
    let token: string;
    let orgId: string;
    let userId: string;
    let projectId: string;

    beforeAll(async () => {
        // Use Factory for deterministic setup
        const context = await testFactory.createFullContext();
        token = context.token;
        orgId = context.org.id;
        userId = context.user.id;
        projectId = context.project.id;
    });

    it('should list tasks', async () => {
        const res = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        if (res.body.length > 0) {
            const task = res.body[0];
            expect(task).toHaveProperty('id');
            expect(task).toHaveProperty('title');
            expect(task).toHaveProperty('status');
        }
    });

    it('should create a task', async () => {
        const newTask = {
            title: `New Task ${Date.now()}`,
            status: 'todo',
            type: 'TASK',
            projectId: projectId
        };

        const res = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send(newTask);

        if (res.status !== 201) {
            console.error('Task creation failed:', JSON.stringify(res.body, null, 2));
        }

        console.log('Create Task Response:', res.status, res.body);

        expect(res.status).toBe(201);
        expect(res.body).toBeTruthy();
        expect(res.body.title).toBe(newTask.title);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('organization_id', orgId);
    });
});
