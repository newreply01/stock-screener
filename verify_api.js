fetch('http://localhost:3000/api/market-summary')
    .then(res => res.json())
    .then(data => {
        console.log('API Response latestDate:', data.latestDate);
        process.exit(0);
    })
    .catch(err => {
        console.error('Fetch error:', err);
        process.exit(1);
    });
