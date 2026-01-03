/**
 * Consulting Frameworks - Index
 * 
 * Exports all framework services for enterprise AI consulting.
 */

const consultingFrameworks = require('./consultingFrameworks');
const FrameworkEngine = require('./frameworkEngine');
const StrategicRecommendationService = require('./strategicRecommendationService');

export default {
    ...consultingFrameworks,
    FrameworkEngine,
    StrategicRecommendationService
};









