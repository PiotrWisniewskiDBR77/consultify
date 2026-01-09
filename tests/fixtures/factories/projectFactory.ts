/**
 * Project Factory
 * Generates synthetic project data for tests
 */

import { faker } from '@faker-js/faker';

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ProjectFactory {
  static create(overrides: Partial<ProjectData> = {}): ProjectData {
    return {
      id: faker.string.uuid(),
      name: faker.company.catchPhrase(),
      description: faker.lorem.paragraph(),
      organizationId: faker.string.uuid(),
      status: faker.helpers.arrayElement(['active', 'inactive', 'archived']),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<ProjectData> = {}): ProjectData[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}










