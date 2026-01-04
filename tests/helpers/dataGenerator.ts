/**
 * Synthetic Data Generator
 * Uses Faker.js to generate realistic test data
 */

import { faker } from '@faker-js/faker';

export class DataGenerator {
  /**
   * Generate random UUID
   */
  static uuid(): string {
    return faker.string.uuid();
  }

  /**
   * Generate random email
   */
  static email(): string {
    return faker.internet.email();
  }

  /**
   * Generate random name
   */
  static name(): string {
    return faker.person.fullName();
  }

  /**
   * Generate random company name
   */
  static companyName(): string {
    return faker.company.name();
  }

  /**
   * Generate random text
   */
  static text(length: number = 100): string {
    return faker.lorem.paragraphs(Math.ceil(length / 100));
  }

  /**
   * Generate random date in the past
   */
  static pastDate(daysAgo: number = 30): Date {
    return faker.date.past({ days: daysAgo });
  }

  /**
   * Generate random date in the future
   */
  static futureDate(daysAhead: number = 30): Date {
    return faker.date.future({ days: daysAhead });
  }

  /**
   * Generate random number
   */
  static number(min: number = 0, max: number = 1000): number {
    return faker.number.int({ min, max });
  }

  /**
   * Generate random boolean
   */
  static boolean(): boolean {
    return faker.datatype.boolean();
  }

  /**
   * Generate random array element
   */
  static arrayElement<T>(array: T[]): T {
    return faker.helpers.arrayElement(array);
  }

  /**
   * Generate random password
   */
  static password(length: number = 12): string {
    return faker.internet.password({ length });
  }

  /**
   * Generate random URL
   */
  static url(): string {
    return faker.internet.url();
  }

  /**
   * Generate random IP address
   */
  static ipAddress(): string {
    return faker.internet.ip();
  }

  /**
   * Generate random color
   */
  static color(): string {
    return faker.internet.color();
  }

  /**
   * Generate random sentence
   */
  static sentence(): string {
    return faker.lorem.sentence();
  }

  /**
   * Generate random words
   */
  static words(count: number = 5): string {
    return faker.lorem.words(count);
  }

  /**
   * Generate random phone number
   */
  static phoneNumber(): string {
    return faker.phone.number();
  }

  /**
   * Generate random address
   */
  static address(): {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  } {
    return {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zipCode: faker.location.zipCode(),
      country: faker.location.country(),
    };
  }

  /**
   * Set seed for reproducible data
   */
  static setSeed(seed: number): void {
    faker.seed(seed);
  }

  /**
   * Reset seed to random
   */
  static resetSeed(): void {
    faker.seed();
  }
}

