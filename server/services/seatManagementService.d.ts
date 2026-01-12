declare namespace _default {
    export { setDependencies };
    export { getSeatConfiguration };
    export { initializeSeatConfiguration };
    export { purchaseSeats };
    export { autoAddSeatOnInvite };
    export { releaseSeat };
    export { canAddUser };
    export { updateSeatCount };
    export { getSeatHistory };
    export { toggleAutoAddSeats };
}
export default _default;
/**
 * Set dependencies (for testing)
 */
export function setDependencies(newDeps?: {}): void;
/**
 * Get seat configuration for an organization
 */
export function getSeatConfiguration(orgId: any): Promise<any>;
/**
 * Initialize seat configuration for an organization
 */
export function initializeSeatConfiguration(orgId: any): Promise<any>;
/**
 * Purchase additional seats
 */
export function purchaseSeats(orgId: any, quantity: any, paymentMethodId: any, triggeredByUserId?: null): Promise<any>;
/**
 * Auto-add seat on user invitation
 */
export function autoAddSeatOnInvite(orgId: any, userId: any): Promise<any>;
/**
 * Release a seat (when user is removed)
 */
export function releaseSeat(orgId: any, userId: any): Promise<any>;
/**
 * Check if a user can be added (seats available)
 */
export function canAddUser(orgId: any): Promise<any>;
/**
 * Update seat count (recalculate seats_used from active users)
 */
export function updateSeatCount(orgId: any): Promise<any>;
/**
 * Get seat transaction history
 */
export function getSeatHistory(orgId: any, limit?: number): Promise<any>;
/**
 * Toggle auto-add seats on invite
 */
export function toggleAutoAddSeats(orgId: any, enabled: any, threshold?: number): Promise<any>;
//# sourceMappingURL=seatManagementService.d.ts.map