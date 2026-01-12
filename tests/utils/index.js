/**
 * Test Utilities Index
 * 
 * Central export for all test utilities.
 * Usage: const { createUser, createAuthenticatedClient } = require('../utils');
 */

const testUtils = require('./testUtils');
const apiTestHelpers = require('./apiTestHelpers');

module.exports = {
    // Re-export everything from testUtils
    ...testUtils,

    // Re-export everything from apiTestHelpers
    ...apiTestHelpers,
};
