/**
 * Professional Test Factory System
 *
 * Enterprise-grade factory functions for generating consistent test data
 * Following the Factory Pattern and Builder Pattern
 */
import { vi } from 'vitest';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface FactoryOptions<T> {
    overrides?: Partial<T>;
    traits?: string[];
    count?: number;
}

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'manager' | 'member' | 'viewer';
    organizationId: string;
    status: 'active' | 'pending' | 'suspended';
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
    settings: UserSettings;
}

export interface UserSettings {
    theme: 'light' | 'dark' | 'system';
    language: string;
    notifications: NotificationPreferences;
}

export interface NotificationPreferences {
    email: boolean;
    push: boolean;
    inApp: boolean;
    digest: 'daily' | 'weekly' | 'none';
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: 'free' | 'starter' | 'professional' | 'enterprise';
    status: 'active' | 'trial' | 'suspended' | 'cancelled';
    createdAt: Date;
    settings: OrganizationSettings;
}

export interface OrganizationSettings {
    timezone: string;
    currency: string;
    dateFormat: string;
    features: string[];
}

export interface Project {
    id: string;
    name: string;
    slug: string;
    organizationId: string;
    status: 'draft' | 'active' | 'on_hold' | 'completed' | 'archived';
    ownerId: string;
    startDate: Date | null;
    endDate: Date | null;
    budget: number;
    createdAt: Date;
}

export interface Initiative {
    id: string;
    title: string;
    description: string;
    projectId: string;
    status: 'ideation' | 'planning' | 'execution' | 'monitoring' | 'closure';
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedValue: number;
    effort: 'low' | 'medium' | 'high';
    ownerId: string;
    createdAt: Date;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    initiativeId: string | null;
    projectId: string;
    assigneeId: string | null;
    status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueDate: Date | null;
    estimatedHours: number | null;
    actualHours: number;
    createdAt: Date;
}

// ============================================================================
// Counter for unique IDs
// ============================================================================

let idCounters: Record<string, number> = {};

export function resetFactoryCounters(): void {
    idCounters = {};
}

function getNextId(prefix: string): string {
    if (!idCounters[prefix]) {
        idCounters[prefix] = 0;
    }
    idCounters[prefix]++;
    return `${prefix}-${String(idCounters[prefix]).padStart(6, '0')}`;
}

// ============================================================================
// Base Factory Class
// ============================================================================

export abstract class BaseFactory<T> {
    protected abstract defaultAttributes(): T;
    protected traits: Record<string, Partial<T>> = {};

    build(options: FactoryOptions<T> = {}): T {
        let result = this.defaultAttributes();

        // Apply traits
        if (options.traits) {
            for (const traitName of options.traits) {
                const trait = this.traits[traitName];
                if (trait) {
                    result = { ...result, ...trait };
                }
            }
        }

        // Apply overrides
        if (options.overrides) {
            result = { ...result, ...options.overrides };
        }

        return result;
    }

    buildMany(count: number, options: FactoryOptions<T> = {}): T[] {
        return Array.from({ length: count }, () => this.build(options));
    }

    protected registerTrait(name: string, attributes: Partial<T>): void {
        this.traits[name] = attributes;
    }
}

// ============================================================================
// User Factory
// ============================================================================

class UserFactoryClass extends BaseFactory<User> {
    constructor() {
        super();
        this.registerTrait('admin', { role: 'admin' });
        this.registerTrait('manager', { role: 'manager' });
        this.registerTrait('suspended', { status: 'suspended' });
        this.registerTrait('pending', { status: 'pending' });
    }

    protected defaultAttributes(): User {
        const id = getNextId('usr');
        return {
            id,
            email: `user-${id}@example.com`,
            firstName: 'John',
            lastName: 'Doe',
            role: 'member',
            organizationId: 'org-000001',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: new Date(),
            settings: {
                theme: 'system',
                language: 'en',
                notifications: {
                    email: true,
                    push: true,
                    inApp: true,
                    digest: 'daily',
                },
            },
        };
    }
}

export const UserFactory = new UserFactoryClass();

// ============================================================================
// Organization Factory
// ============================================================================

class OrganizationFactoryClass extends BaseFactory<Organization> {
    constructor() {
        super();
        this.registerTrait('enterprise', { plan: 'enterprise' });
        this.registerTrait('trial', { status: 'trial' });
        this.registerTrait('suspended', { status: 'suspended' });
    }

    protected defaultAttributes(): Organization {
        const id = getNextId('org');
        return {
            id,
            name: `Organization ${id}`,
            slug: `org-${id}`,
            plan: 'professional',
            status: 'active',
            createdAt: new Date(),
            settings: {
                timezone: 'Europe/Warsaw',
                currency: 'PLN',
                dateFormat: 'DD/MM/YYYY',
                features: ['ai', 'reports', 'integrations'],
            },
        };
    }
}

export const OrganizationFactory = new OrganizationFactoryClass();

// ============================================================================
// Project Factory
// ============================================================================

class ProjectFactoryClass extends BaseFactory<Project> {
    constructor() {
        super();
        this.registerTrait('completed', { status: 'completed' });
        this.registerTrait('on_hold', { status: 'on_hold' });
        this.registerTrait('large_budget', { budget: 1000000 });
    }

    protected defaultAttributes(): Project {
        const id = getNextId('prj');
        return {
            id,
            name: `Project ${id}`,
            slug: `project-${id}`,
            organizationId: 'org-000001',
            status: 'active',
            ownerId: 'usr-000001',
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            budget: 100000,
            createdAt: new Date(),
        };
    }
}

export const ProjectFactory = new ProjectFactoryClass();

// ============================================================================
// Initiative Factory
// ============================================================================

class InitiativeFactoryClass extends BaseFactory<Initiative> {
    constructor() {
        super();
        this.registerTrait('high_priority', { priority: 'critical' });
        this.registerTrait('high_value', { estimatedValue: 500000 });
        this.registerTrait('in_execution', { status: 'execution' });
    }

    protected defaultAttributes(): Initiative {
        const id = getNextId('ini');
        return {
            id,
            title: `Initiative ${id}`,
            description: `Description for initiative ${id}`,
            projectId: 'prj-000001',
            status: 'ideation',
            priority: 'medium',
            estimatedValue: 50000,
            effort: 'medium',
            ownerId: 'usr-000001',
            createdAt: new Date(),
        };
    }
}

export const InitiativeFactory = new InitiativeFactoryClass();

// ============================================================================
// Task Factory
// ============================================================================

class TaskFactoryClass extends BaseFactory<Task> {
    constructor() {
        super();
        this.registerTrait('urgent', { priority: 'urgent' });
        this.registerTrait('blocked', { status: 'blocked' });
        this.registerTrait('overdue', {
            dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        });
    }

    protected defaultAttributes(): Task {
        const id = getNextId('tsk');
        return {
            id,
            title: `Task ${id}`,
            description: `Description for task ${id}`,
            initiativeId: null,
            projectId: 'prj-000001',
            assigneeId: null,
            status: 'todo',
            priority: 'medium',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            estimatedHours: 8,
            actualHours: 0,
            createdAt: new Date(),
        };
    }
}

export const TaskFactory = new TaskFactoryClass();

// ============================================================================
// Sequence Generator
// ============================================================================

export function sequence<T>(generator: (n: number) => T): () => T {
    let counter = 0;
    return () => generator(++counter);
}

// ============================================================================
// Mock Helpers
// ============================================================================

export function createMockFn<T extends (...args: unknown[]) => unknown>(
    implementation?: T
): ReturnType<typeof vi.fn<T>> {
    return vi.fn(implementation);
}

export function createSpyOn<T extends object, M extends keyof T>(
    obj: T,
    method: M
): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(obj, method as never);
}

// ============================================================================
// Random Data Generators
// ============================================================================

export const RandomData = {
    email: (domain = 'example.com') =>
        `user-${Math.random().toString(36).slice(2, 10)}@${domain}`,

    name: () => {
        const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'];
        return {
            first: firstNames[Math.floor(Math.random() * firstNames.length)],
            last: lastNames[Math.floor(Math.random() * lastNames.length)],
        };
    },

    number: (min: number, max: number) =>
        Math.floor(Math.random() * (max - min + 1)) + min,

    decimal: (min: number, max: number, precision = 2) =>
        Number((Math.random() * (max - min) + min).toFixed(precision)),

    boolean: (probability = 0.5) => Math.random() < probability,

    date: (startYear = 2020, endYear = 2025) => {
        const start = new Date(startYear, 0, 1).getTime();
        const end = new Date(endYear, 11, 31).getTime();
        return new Date(start + Math.random() * (end - start));
    },

    futureDate: (daysAhead = 30) =>
        new Date(Date.now() + Math.random() * daysAhead * 24 * 60 * 60 * 1000),

    pastDate: (daysBack = 30) =>
        new Date(Date.now() - Math.random() * daysBack * 24 * 60 * 60 * 1000),

    uuid: () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        }),

    pick: <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)],

    shuffle: <T>(array: T[]): T[] => {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    },

    paragraph: (sentences = 3) => {
        const words = [
            'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur',
            'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor',
        ];
        return Array.from({ length: sentences }, () =>
            Array.from(
                { length: RandomData.number(5, 15) },
                () => words[Math.floor(Math.random() * words.length)]
            ).join(' ') + '.'
        ).join(' ');
    },
};

// ============================================================================
// Test Context Builder
// ============================================================================

export interface TestContext {
    organization: Organization;
    users: User[];
    projects: Project[];
    initiatives: Initiative[];
    tasks: Task[];
}

export class TestContextBuilder {
    private context: Partial<TestContext> = {};

    withOrganization(options?: FactoryOptions<Organization>): this {
        this.context.organization = OrganizationFactory.build(options);
        return this;
    }

    withUsers(count: number, options?: FactoryOptions<User>): this {
        const orgId = this.context.organization?.id || 'org-000001';
        this.context.users = UserFactory.buildMany(count, {
            ...options,
            overrides: { ...options?.overrides, organizationId: orgId },
        });
        return this;
    }

    withProjects(count: number, options?: FactoryOptions<Project>): this {
        const orgId = this.context.organization?.id || 'org-000001';
        const ownerId = this.context.users?.[0]?.id || 'usr-000001';
        this.context.projects = ProjectFactory.buildMany(count, {
            ...options,
            overrides: { ...options?.overrides, organizationId: orgId, ownerId },
        });
        return this;
    }

    withInitiatives(count: number, options?: FactoryOptions<Initiative>): this {
        const projectId = this.context.projects?.[0]?.id || 'prj-000001';
        const ownerId = this.context.users?.[0]?.id || 'usr-000001';
        this.context.initiatives = InitiativeFactory.buildMany(count, {
            ...options,
            overrides: { ...options?.overrides, projectId, ownerId },
        });
        return this;
    }

    withTasks(count: number, options?: FactoryOptions<Task>): this {
        const projectId = this.context.projects?.[0]?.id || 'prj-000001';
        this.context.tasks = TaskFactory.buildMany(count, {
            ...options,
            overrides: { ...options?.overrides, projectId },
        });
        return this;
    }

    build(): TestContext {
        return {
            organization: this.context.organization || OrganizationFactory.build(),
            users: this.context.users || [],
            projects: this.context.projects || [],
            initiatives: this.context.initiatives || [],
            tasks: this.context.tasks || [],
        };
    }
}

export function createTestContext(): TestContextBuilder {
    return new TestContextBuilder();
}
