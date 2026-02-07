
console.log('🚀 SENTINEL CLOUD ORCHESTRATOR STARTING...');

// 1. Start HTTP Server (Express) - Mandatory for Koyeb Health Checks
try {
    require('./01_CORE/cloud_heartbeat.js');
    console.log('✅ HTTP SERVER LAUNCHED');
} catch (e) {
    console.error('❌ HTTP SERVER FAIL:', e.message);
    // If HTTP fails, process exits because Koyeb needs port 8000
    process.exit(1); 
}

// 2. Start Background Worker (Cron Jobs)
try {
    require('./06_CLOUD_WORKERS/sentinel_reporter_service.js');
    console.log('✅ BACKGROUND WORKER LAUNCHED');
} catch (e) {
    console.error('⚠️ WORKER FAIL:', e.message);
    // Worker fail is non-fatal for HTTP, but bad for bot function
}

console.log('🛡️ SENTINEL SYSTEM ONLINE');
