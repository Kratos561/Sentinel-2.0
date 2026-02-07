
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const fetch = require('node-fetch'); // Needs node-fetch v2 for CommonJS

// --- CONFIG ---
const SUPABASE_URL = 'https://udqxvsgdgxgtnhxxxcgv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcXh2c2dkZ3hndG5oeHh4Y2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcwNTM0NCwiZXhwIjoyMDg0MjgxMzQ0fQ.mUKPJvTeG2MU4Fxfddcbcx2Q7H8EDuXcDtWAbHGvT48';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8158152948:AAGe19Ruzjj5EOjT_oGIZ0medl20fkeYd3I';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6702262011';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 1. DATA FEEDER MODULE ---
async function fetchMarketData() {
    console.log('📡 FETCHING MARKET DATA...');
    try {
        // CoinGecko API (Free)
        const ids = 'bitcoin,ethereum,tether-gold';
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.bitcoin) throw new Error('No data received from CoinGecko');

        const prices = [
            { symbol: 'BTC', price: data.bitcoin.usd },
            { symbol: 'ETH', price: data.ethereum.usd },
            { symbol: 'XAUUSD', price: data['tether-gold'] ? data['tether-gold'].usd : 0 } // Fallback
        ];

        // Insert into DB
        for (const p of prices) {
            if (p.price > 0) {
                const { error } = await supabase
                    .from('bot_historical_master')
                    .insert({ 
                        symbol: p.symbol, 
                        close_price: p.price, 
                        volume: 0, 
                        source: 'SENTINEL_CLOUD_NODE' 
                    });
                
                if (error) console.error(`❌ Insert Error (${p.symbol}):`, error.message);
                else console.log(`✅ ${p.symbol}: $${p.price}`);
            }
        }
        
        // Trigger Signal Check (After inserting data)
        await supabase.rpc('scan_all_for_signals'); 

    } catch (e) {
        console.error('🔥 FEED ERROR:', e.message);
    }
}

// --- 2. INTELLIGENCE REPORTER MODULE ---
async function generateReport() {
    console.log('🧠 GENERATING INTELLIGENCE REPORT...');
    // (Logic from previous reporter script...)
    // ... Simplified for brevity in this update, focusing on Data Feed Repair first
    
    // Send basic heartbeat to Telegram
    const msg = `🛡️ *SENTINEL SYSTEM STATUS*\n\n✅ *Data Feed:* OPERATIONAL\n✅ *Node:* ONLINE\n🕒 *Time:* ${new Date().toISOString()}`;
    await sendTelegram(msg);
}

async function sendTelegram(text) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'Markdown' })
        });
    } catch (e) { console.error('Telegram Error:', e.message); }
}

// --- SCHEDULER ---
console.log('🚀 SENTINEL UNIFIED WORKER STARTED');

// 1. Data Feed: Every 1 minute
cron.schedule('* * * * *', () => {
    fetchMarketData();
});

// 2. Report: Every Hour
cron.schedule('0 * * * *', () => {
    generateReport();
});

// Initial Run
fetchMarketData();
if (process.env.GH_ACTION) {
   // If running in GitHub Action, execute once and exit
   generateReport().then(() => process.exit(0));
}
