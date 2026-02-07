
const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use((req, res, next) => {
    console.log('[REQUEST]', req.method, req.url);
    next();
});

// PING Endpoint (Critical for Keep-Alive)
app.get('/ping', (req, res) => {
    res.status(200).send('PONG - Sentinel Awake');
});

// Root Endpoint
app.get('/', (req, res) => {
    res.status(200).send('<h1>🛡️ SENTINEL CORE ONLINE</h1><p>System operational.</p>');
});

// Error Handling
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).send('Internal Error');
});

// Start
app.listen(port, () => {
    console.log('🚀 Heartbeat Server listening on port ' + port);
});
