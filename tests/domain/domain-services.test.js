/**
 * Domain Service Pattern Tests
 * Tests for business logic encapsulation
 * 
 * @module tests/domain/domain-services.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Value object
const createMoney = (amount, currency = 'USD') => {
    return {
        amount,
        currency,

        add: (other) => {
            if (other.currency !== currency) throw new Error('Currency mismatch');
            return createMoney(amount + other.amount, currency);
        },

        subtract: (other) => {
            if (other.currency !== currency) throw new Error('Currency mismatch');
            return createMoney(amount - other.amount, currency);
        },

        multiply: (factor) => createMoney(amount * factor, currency),

        equals: (other) => amount === other.amount && currency === other.currency,

        isPositive: () => amount > 0,

        isNegative: () => amount < 0,

        isZero: () => amount === 0,

        format: () => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount),

        toJSON: () => ({ amount, currency }),
    };
};

// Entity base
const createEntity = (id, data = {}) => {
    const events = [];

    return {
        id,
        ...data,

        equals: (other) => other?.id === id,

        addEvent: (event) => events.push({ ...event, timestamp: Date.now() }),

        getEvents: () => [...events],

        clearEvents: () => { events.length = 0; },
    };
};

// Aggregate root
const createOrder = (id, customerId) => {
    const items = [];
    let status = 'draft';
    const events = [];

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum.add(item.total), createMoney(0));
    };

    return {
        id,
        customerId,

        getStatus: () => status,

        getItems: () => [...items],

        getTotal: () => calculateTotal(),

        addItem: (productId, quantity, price) => {
            if (status !== 'draft') throw new Error('Cannot modify non-draft order');

            items.push({
                productId,
                quantity,
                price,
                total: createMoney(price.amount * quantity, price.currency),
            });

            events.push({ type: 'ItemAdded', productId, quantity });
        },

        removeItem: (productId) => {
            if (status !== 'draft') throw new Error('Cannot modify non-draft order');

            const idx = items.findIndex(i => i.productId === productId);
            if (idx !== -1) {
                items.splice(idx, 1);
                events.push({ type: 'ItemRemoved', productId });
            }
        },

        submit: () => {
            if (status !== 'draft') throw new Error('Order already submitted');
            if (items.length === 0) throw new Error('Cannot submit empty order');

            status = 'submitted';
            events.push({ type: 'OrderSubmitted', orderId: id, total: calculateTotal() });
        },

        confirm: () => {
            if (status !== 'submitted') throw new Error('Order not submitted');
            status = 'confirmed';
            events.push({ type: 'OrderConfirmed', orderId: id });
        },

        cancel: () => {
            if (status === 'cancelled') throw new Error('Already cancelled');
            status = 'cancelled';
            events.push({ type: 'OrderCancelled', orderId: id });
        },

        getEvents: () => [...events],
    };
};

// Domain service
const createPricingService = () => {
    const discountRules = [];

    return {
        addDiscountRule: (rule) => {
            discountRules.push(rule);
        },

        calculatePrice: (product, quantity, customer) => {
            let price = createMoney(product.basePrice * quantity, product.currency);

            for (const rule of discountRules) {
                if (rule.applies(product, quantity, customer)) {
                    price = rule.apply(price, product, quantity, customer);
                }
            }

            return price;
        },

        calculateDiscount: (originalPrice, finalPrice) => {
            const discount = originalPrice.amount - finalPrice.amount;
            return {
                amount: createMoney(discount, originalPrice.currency),
                percentage: (discount / originalPrice.amount) * 100,
            };
        },
    };
};

// Specification pattern
const createSpecification = (predicate) => {
    return {
        isSatisfiedBy: predicate,

        and: (other) => createSpecification(
            (candidate) => predicate(candidate) && other.isSatisfiedBy(candidate)
        ),

        or: (other) => createSpecification(
            (candidate) => predicate(candidate) || other.isSatisfiedBy(candidate)
        ),

        not: () => createSpecification(
            (candidate) => !predicate(candidate)
        ),
    };
};

describe('Value Object Tests', () => {
    it('should create money', () => {
        const money = createMoney(100, 'USD');

        expect(money.amount).toBe(100);
        expect(money.currency).toBe('USD');
    });

    it('should add money', () => {
        const m1 = createMoney(100);
        const m2 = createMoney(50);

        const result = m1.add(m2);

        expect(result.amount).toBe(150);
    });

    it('should throw on currency mismatch', () => {
        const m1 = createMoney(100, 'USD');
        const m2 = createMoney(50, 'EUR');

        expect(() => m1.add(m2)).toThrow('Currency mismatch');
    });

    it('should multiply', () => {
        const money = createMoney(100);
        const result = money.multiply(1.5);

        expect(result.amount).toBe(150);
    });

    it('should format', () => {
        const money = createMoney(1234.56, 'USD');

        expect(money.format()).toContain('1,234.56');
    });
});

describe('Aggregate Tests', () => {
    let order;

    beforeEach(() => {
        order = createOrder('order-1', 'customer-1');
    });

    it('should add items', () => {
        order.addItem('product-1', 2, createMoney(10));

        expect(order.getItems()).toHaveLength(1);
        expect(order.getTotal().amount).toBe(20);
    });

    it('should submit order', () => {
        order.addItem('product-1', 1, createMoney(10));
        order.submit();

        expect(order.getStatus()).toBe('submitted');
    });

    it('should not submit empty order', () => {
        expect(() => order.submit()).toThrow('empty order');
    });

    it('should not modify submitted order', () => {
        order.addItem('product-1', 1, createMoney(10));
        order.submit();

        expect(() => order.addItem('product-2', 1, createMoney(20))).toThrow();
    });

    it('should track domain events', () => {
        order.addItem('product-1', 1, createMoney(10));
        order.submit();

        const events = order.getEvents();
        expect(events.some(e => e.type === 'ItemAdded')).toBe(true);
        expect(events.some(e => e.type === 'OrderSubmitted')).toBe(true);
    });
});

describe('Domain Service Tests', () => {
    let pricingService;

    beforeEach(() => {
        pricingService = createPricingService();
    });

    it('should calculate base price', () => {
        const product = { basePrice: 100, currency: 'USD' };
        const price = pricingService.calculatePrice(product, 2, {});

        expect(price.amount).toBe(200);
    });

    it('should apply discount rules', () => {
        pricingService.addDiscountRule({
            applies: (p, qty) => qty >= 5,
            apply: (price) => price.multiply(0.9), // 10% off
        });

        const product = { basePrice: 100, currency: 'USD' };
        const price = pricingService.calculatePrice(product, 5, {});

        expect(price.amount).toBe(450); // 500 * 0.9
    });
});

describe('Specification Tests', () => {
    it('should check predicate', () => {
        const isAdult = createSpecification(p => p.age >= 18);

        expect(isAdult.isSatisfiedBy({ age: 20 })).toBe(true);
        expect(isAdult.isSatisfiedBy({ age: 15 })).toBe(false);
    });

    it('should combine with and', () => {
        const isAdult = createSpecification(p => p.age >= 18);
        const isActive = createSpecification(p => p.status === 'active');

        const spec = isAdult.and(isActive);

        expect(spec.isSatisfiedBy({ age: 20, status: 'active' })).toBe(true);
        expect(spec.isSatisfiedBy({ age: 20, status: 'inactive' })).toBe(false);
    });

    it('should combine with or', () => {
        const isAdmin = createSpecification(p => p.role === 'admin');
        const isOwner = createSpecification(p => p.isOwner);

        const spec = isAdmin.or(isOwner);

        expect(spec.isSatisfiedBy({ role: 'user', isOwner: true })).toBe(true);
    });

    it('should negate', () => {
        const isBanned = createSpecification(p => p.banned);
        const isNotBanned = isBanned.not();

        expect(isNotBanned.isSatisfiedBy({ banned: false })).toBe(true);
    });
});
