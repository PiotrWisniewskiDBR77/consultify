/**
 * User Factory
 * Generates synthetic user data for tests using Faker.js
 */

import { faker } from '@faker-js/faker';

export interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: string;
  password?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserFactory {
  /**
   * Create a single user with random data
   */
  static create(overrides: Partial<UserData> = {}): UserData {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      organizationId: faker.string.uuid(),
      role: faker.helpers.arrayElement(['USER', 'ADMIN', 'VIEWER']),
      password: faker.internet.password(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Create multiple users
   */
  static createMany(count: number, overrides: Partial<UserData> = {}): UserData[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create a user with specific role
   */
  static createAdmin(overrides: Partial<UserData> = {}): UserData {
    return this.create({ role: 'ADMIN', ...overrides });
  }

  /**
   * Create a user with specific organization
   */
  static createForOrg(organizationId: string, overrides: Partial<UserData> = {}): UserData {
    return this.create({ organizationId, ...overrides });
  }
}

