/**
 * Seat Management Service
 * Handles seat purchasing, auto-adding, releasing, and seat pool management
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';


const deps = {
    db,
    uuidv4,
};

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    Object.assign(deps, newDeps);
}

/**
 * Get seat configuration for an organization
 */
function getSeatConfiguration(orgId) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            `SELECT os.*, sp.seats_included, sp.seat_price_monthly, sp.billing_model, sp.allow_seat_pooling, sp.max_seats
             FROM organization_seats os
             LEFT JOIN organization_billing ob ON os.organization_id = ob.organization_id
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE os.organization_id = ?`,
            [orgId],
            (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    // Initialize seat configuration if it doesn't exist
                    initializeSeatConfiguration(orgId)
                        .then(() => getSeatConfiguration(orgId))
                        .then(resolve)
                        .catch(reject);
                } else {
                    // Calculate total seats available
                    const totalAvailable = (row.base_seats_included || 0) + (row.additional_seats_purchased || 0);
                    resolve({
                        ...row,
                        total_seats_available: totalAvailable,
                        seats_remaining: Math.max(0, totalAvailable - (row.seats_used || 0)),
                        utilization_percent: totalAvailable > 0 ? ((row.seats_used || 0) / totalAvailable * 100).toFixed(2) : 0
                    });
                }
            }
        );
    });
}

/**
 * Initialize seat configuration for an organization
 */
function initializeSeatConfiguration(orgId) {
    return new Promise((resolve, reject) => {
        // Get plan details
        deps.db.get(
            `SELECT sp.seats_included, sp.seat_price_monthly, sp.billing_model, sp.allow_seat_pooling, sp.max_seats
             FROM organization_billing ob
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.organization_id = ?`,
            [orgId],
            (err, planRow) => {
                if (err) {
                    reject(err);
                    return;
                }

                const seatsIncluded = planRow?.seats_included || 0;
                const seatPrice = planRow?.seat_price_monthly || 0;
                const billingModel = planRow?.billing_model || 'subscription';
                const allowPooling = planRow?.allow_seat_pooling || 0;

                // Count current active users
                deps.db.get(
                    `SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND status = 'active'`,
                    [orgId],
                    (err, userRow) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const seatsUsed = userRow?.count || 0;

                        const id = `seat-${deps.uuidv4()}`;
                        deps.db.run(
                            `INSERT INTO organization_seats(
                                id, organization_id, base_seats_included, additional_seats_purchased,
                                total_seats_available, seats_used, billing_model, seat_price_monthly,
                                auto_add_seats_on_invite, seat_pool_enabled
                            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [id, orgId, seatsIncluded, 0, seatsIncluded, seatsUsed, billingModel, seatPrice, 0, allowPooling ? 1 : 0],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    }
                );
            }
        );
    });
}

/**
 * Purchase additional seats
 */
function purchaseSeats(orgId, quantity, paymentMethodId, triggeredByUserId = null) {
    return new Promise((resolve, reject) => {
        getSeatConfiguration(orgId)
            .then((config) => {
                const seatPrice = config.seat_price_monthly || 0;
                const totalAmount = seatPrice * quantity;

                // Check max seats limit if set
                if (config.max_seats && config.max_seats > 0) {
                    const newTotal = (config.total_seats_available || 0) + quantity;
                    if (newTotal > config.max_seats) {
                        reject(new Error(`Cannot purchase ${quantity} seats. Maximum seats limit is ${config.max_seats}`));
                        return;
                    }
                }

                const transactionId = `seat-txn-${deps.uuidv4()}`;
                const now = new Date();
                const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

                // Create seat transaction
                deps.db.run(
                    `INSERT INTO seat_transactions(
                        id, organization_id, transaction_type, seats_count, unit_price, total_amount,
                        billing_period_start, billing_period_end, triggered_by, triggered_by_user_id, reason
                    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [transactionId, orgId, 'purchase', quantity, seatPrice, totalAmount, periodStart.toISOString(), periodEnd.toISOString(), 'admin', triggeredByUserId, 'Manual seat purchase'],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        // Update organization_seats
                        deps.db.run(
                            `UPDATE organization_seats SET
                                additional_seats_purchased = additional_seats_purchased + ?,
                                total_seats_available = total_seats_available + ?,
                                updated_at = datetime('now')
                            WHERE organization_id = ?`,
                            [quantity, quantity, orgId],
                            (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({
                                        transactionId,
                                        seatsPurchased: quantity,
                                        totalAmount,
                                        newTotalSeats: (config.total_seats_available || 0) + quantity
                                    });
                                }
                            }
                        );
                    }
                );
            })
            .catch(reject);
    });
}

/**
 * Auto-add seat on user invitation
 */
function autoAddSeatOnInvite(orgId, userId) {
    return new Promise((resolve, reject) => {
        getSeatConfiguration(orgId)
            .then((config) => {
                if (!config.auto_add_seats_on_invite) {
                    resolve({ autoAdded: false, reason: 'Auto-add disabled' });
                    return;
                }

                // Check if we need to auto-add based on threshold
                const utilizationPercent = parseFloat(config.utilization_percent || 0);
                if (utilizationPercent < config.auto_add_seats_threshold) {
                    resolve({ autoAdded: false, reason: 'Below threshold' });
                    return;
                }

                // Check if we can add a seat
                if (!canAddUser(orgId)) {
                    // Auto-purchase one seat
                    purchaseSeats(orgId, 1, null, userId)
                        .then((result) => {
                            // Record auto-add transaction
                            const transactionId = `seat-txn-${deps.uuidv4()}`;
                            deps.db.run(
                                `INSERT INTO seat_transactions(
                                    id, organization_id, transaction_type, seats_count, unit_price, total_amount,
                                    triggered_by, triggered_by_user_id, reason
                                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [transactionId, orgId, 'auto_add', 1, config.seat_price_monthly || 0, config.seat_price_monthly || 0, 'auto', userId, 'Auto-added on invitation'],
                                (err) => {
                                    if (err) {
                                        console.error('Error recording auto-add transaction:', err);
                                    }
                                }
                            );
                            resolve({ autoAdded: true, transactionId: result.transactionId });
                        })
                        .catch(reject);
                } else {
                    resolve({ autoAdded: false, reason: 'Seats available' });
                }
            })
            .catch(reject);
    });
}

/**
 * Release a seat (when user is removed)
 */
function releaseSeat(orgId, userId) {
    return new Promise((resolve, reject) => {
        getSeatConfiguration(orgId)
            .then((config) => {
                // Only release if we have more seats used than base seats
                if ((config.seats_used || 0) <= (config.base_seats_included || 0)) {
                    resolve({ released: false, reason: 'No additional seats to release' });
                    return;
                }

                const transactionId = `seat-txn-${deps.uuidv4()}`;
                deps.db.run(
                    `INSERT INTO seat_transactions(
                        id, organization_id, transaction_type, seats_count,
                        triggered_by, triggered_by_user_id, reason
                    ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
                    [transactionId, orgId, 'release', -1, 'admin', userId, 'User removed'],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        // Update organization_seats
                        deps.db.run(
                            `UPDATE organization_seats SET
                                additional_seats_purchased = MAX(0, additional_seats_purchased - 1),
                                total_seats_available = MAX(base_seats_included, total_seats_available - 1),
                                updated_at = datetime('now')
                            WHERE organization_id = ?`,
                            [orgId],
                            (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ released: true, transactionId });
                                }
                            }
                        );
                    }
                );
            })
            .catch(reject);
    });
}

/**
 * Check if a user can be added (seats available)
 */
function canAddUser(orgId) {
    return new Promise((resolve, reject) => {
        getSeatConfiguration(orgId)
            .then((config) => {
                const seatsRemaining = (config.total_seats_available || 0) - (config.seats_used || 0);
                resolve(seatsRemaining > 0);
            })
            .catch(reject);
    });
}

/**
 * Update seat count (recalculate seats_used from active users)
 */
function updateSeatCount(orgId) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            `SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND status = 'active'`,
            [orgId],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                const seatsUsed = row?.count || 0;

                deps.db.run(
                    `UPDATE organization_seats SET seats_used = ?, updated_at = datetime('now') WHERE organization_id = ?`,
                    [seatsUsed, orgId],
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ seatsUsed });
                        }
                    }
                );
            }
        );
    });
}

/**
 * Get seat transaction history
 */
function getSeatHistory(orgId, limit = 50) {
    return new Promise((resolve, reject) => {
        deps.db.all(
            `SELECT st.*, u.email as triggered_by_email, u.first_name, u.last_name
             FROM seat_transactions st
             LEFT JOIN users u ON st.triggered_by_user_id = u.id
             WHERE st.organization_id = ?
             ORDER BY st.created_at DESC
             LIMIT ?`,
            [orgId, limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

/**
 * Toggle auto-add seats on invite
 */
function toggleAutoAddSeats(orgId, enabled, threshold = 80) {
    return new Promise((resolve, reject) => {
        deps.db.run(
            `UPDATE organization_seats SET
                auto_add_seats_on_invite = ?,
                auto_add_seats_threshold = ?,
                updated_at = datetime('now')
            WHERE organization_id = ?`,
            [enabled ? 1 : 0, threshold, orgId],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ enabled, threshold });
                }
            }
        );
    });
}

export default {
    setDependencies,
    getSeatConfiguration,
    initializeSeatConfiguration,
    purchaseSeats,
    autoAddSeatOnInvite,
    releaseSeat,
    canAddUser,
    updateSeatCount,
    getSeatHistory,
    toggleAutoAddSeats
};






