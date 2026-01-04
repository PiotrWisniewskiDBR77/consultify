/**
 * Organization Factory
 * Generates synthetic organization data for tests
 */

import { faker } from '@faker-js/faker';

export interface OrganizationData {
  id: string;
  name: string;
  plan: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class OrganizationFactory {
  static create(overrides: Partial<OrganizationData> = {}): OrganizationData {
    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      plan: faker.helpers.arrayElement(['free', 'pro', 'enterprise']),
      status: faker.helpers.arrayElement(['active', 'inactive', 'suspended']),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<OrganizationData> = {}): OrganizationData[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createActive(overrides: Partial<OrganizationData> = {}): OrganizationData {
    return this.create({ status: 'active', ...overrides });
  }
}

