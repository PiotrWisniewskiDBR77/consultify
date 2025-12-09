import autocannon from 'autocannon';

const runLoadTest = () => {
    console.log('Running Level 5: Performance Load Test...');

    const instance = autocannon({
        url: 'http://localhost:3001/api/health',
        connections: 10, // default
        pipelining: 1, // default
        duration: 10, // default
    }, console.log);

    // audit usage results
    autocannon.track(instance, { renderProgressBar: true });
};

runLoadTest();
