/**
 * Token Billing Service Mock
 * For testing purposes
 */

// Plain functions to allow spying in tests
const mockBilling = {
  hasSufficientBalance: function () {
    return Promise.resolve(true);
  },
  deductTokens: function () {
    return Promise.resolve(true);
  },
  checkBalance: function () {
    return Promise.resolve(true);
  },
  getBalance: function () {
    return Promise.resolve({ platform_tokens: 1000, platform_tokens_bonus: 0 });
  },
  ensureBalance: function () {
    return Promise.resolve(true);
  },
  creditTokens: function () {
    return Promise.resolve(true);
  },
  getMargin: function () {
    return Promise.resolve({ margin_percent: 10 });
  },
  getMargins: function () {
    return Promise.resolve([]);
  },
  getOrgBalance: function () {
    return Promise.resolve({ balance: 1000, billingStatus: 'ACTIVE', organizationType: 'PAID' });
  },
  hasOrgSufficientBalance: function () {
    return Promise.resolve({ allowed: true, balance: 1000 });
  },
};

export default mockBilling;
