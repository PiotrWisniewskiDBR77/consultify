const debugExport = require('debug');
console.log('require("debug") type:', typeof debugExport);
console.log('require("debug") value:', debugExport);
try {
    const debug = debugExport('test');
    debug('Hello world');
} catch (e) {
    console.error('Error calling debug export:', e);
}
