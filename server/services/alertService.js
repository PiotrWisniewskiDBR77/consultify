/**
 * AlertService Wrapper
 * Temporary fix: mocking exports to avoid import error from missing dist/
 */

const AlertService = {
    sendAlert: async () => ({ success: true }),
    getAlerts: async () => [],
    checkThresholds: async () => ({}),
    dispatchAlerts: async () => ({})
};

export default AlertService;
export const sendAlert = AlertService.sendAlert;
export const getAlerts = AlertService.getAlerts;
