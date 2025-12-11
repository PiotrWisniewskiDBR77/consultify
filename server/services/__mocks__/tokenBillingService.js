// const { vi } = require('vitest'); // relied on global vi

// Plain functions to allow spying in tests
const mockBilling = {
    hasSufficientBalance: function () { return Promise.resolve(true); },
    deductTokens: function () { return Promise.resolve(true); },
    checkBalance: function () { return Promise.resolve(true); },
    getBalance: function () { return Promise.resolve({ platform_tokens: 1000, platform_tokens_bonus: 0 }); },
    ensureBalance: function () { return Promise.resolve(true); },
    creditTokens: function () { return Promise.resolve(true); },
    getMargin: function () { return Promise.resolve({ margin_percent: 10 }); },
    getMargins: function () { return Promise.resolve([]); }
};

module.exports = mockBilling;
