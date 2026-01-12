import autocannon from 'autocannon';

const runLoadTest = () => {
    console.log('Running Level 5: High-Concurrency Load Test (Simulating 10k users)...');
    console.log('Target: http://localhost:3005/api/health');

    const instance = autocannon({
        url: 'http://localhost:3005/api/health',
        connections: 1000, // High concurrency
        pipelining: 10,    // Requests per connection
        duration: 30,      // 30 seconds
        workers: 4,        // Use worker threads
        timeout: 10,       // 10s timeout
    }, (err, result) => {
        if (err) {
            console.error('Error running load test:', err);
            return;
        }
        console.log(result);
    });

    autocannon.track(instance, { renderProgressBar: true });
};

runLoadTest();
