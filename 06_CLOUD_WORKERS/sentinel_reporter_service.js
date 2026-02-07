
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const fetch = require('node-fetch');

// --- CONFIG ---
const SUPABASE_URL = 'https://udqxvsgdgxgtnhxxxcgv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcXh2c2dkZ3hndG5oeHh4Y2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcwNTM0NCwiZXhwIjoyMDg0MjgxMzQ0fQ.mUKPJvTeG2MU4Fxfddcbcx2Q7H8EDuXcDtWAbHGvT48';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8158152948:AAGe19Ruzjj5EOjT_oGIZ0medl20fkeYd3I';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6702262011';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 1. DATA FEEDER MODULE (Pulse) ---
async function fetchMarketData() {
    console.log('📡 FETCHING MARKET DATA...');
    try {
        const ids = 'bitcoin,ethereum,tether-gold';
        const url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd';
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.bitcoin) throw new Error('No data received from CoinGecko');

        const prices = [
            { symbol: 'BTC', price: data.bitcoin.usd },
            { symbol: 'ETH', price: data.ethereum.usd },
            { symbol: 'XAUUSD', price: data['tether-gold'] ? data['tether-gold'].usd : 0 }
        ];

        for (const p of prices) {
            if (p.price > 0) {
                // Insert Price
                await supabase.from('bot_historical_master').insert({ 
                    symbol: p.symbol, close_price: p.price, volume: 0, source: 'SENTINEL_CLOUD_NODE' 
                });
                
                // Calculate RSI (Simple approximation or call DB function)
                // For now, we let the DB trigger handle indicators via 'scan_all_for_signals'
            }
        }
        
        // Trigger DB Analysis
        const { error } = await supabase.rpc('scan_all_for_signals');
        if (error) console.error('Signal Error:', error.message);
        else console.log('✅ SIGNALS SCANNED');

    } catch (e) {
        console.error('🔥 FEED ERROR:', e.message);
    }
}

// --- 2. AI INTELLIGENCE MODULE (Cortex) ---
async function generateReport() {
    console.log('🧠 GENERATING INTELLIGENCE REPORT...');
    try {
        // 1. Get Market Snapshot
        const { data: market } = await supabase
            .from('bot_historical_master')
            .select('symbol, close_price, created_at')
            .order('created_at', { ascending: false })
            .limit(10);
            
        // 2. Get Recent Trades
        const { data: trades } = await supabase
            .from('bot_trades')
            .select('*')
            .order('opened_at', { ascending: false })
            .limit(5);

        // 3. Get PnL
        const { data: pnl } = await supabase.rpc('calculate_total_pnl');

        // 4. PREPARE PROMPT
        const prompt = `
        ACT AS SENTINEL AI, AN ELITE TRADING ALGORITHM.
        
        MARKET DATA:
        ${JSON.stringify(market)}
        
        RECENT TRADES:
        ${JSON.stringify(trades)}
        
        TOTAL PNL: ${pnl}
        
        TASK:
        Generate a "SITREP" (Situation Report) for the human commander.
        Style: Military, Concise, Machine-like but respectful.
        Structure:
        1. 📊 MARKET STATUS (Bullish/Bearish/Neutral per asset)
        2. 🛡️ DEFENSIVE METRICS (Any human errors detected? Fomo levels?)
        3. 💰 PERFORMANCE (Brief PnL comment)
        4. 🎯 TACTICAL RECOMMENDATION (Hold/Wait/Aggressive)
        
        Keep it under 200 words. Use Telegram Markdown/Emojis.
        `;

        // 5. CALL GEMINI (OPENROUTER)
        const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + OPENROUTER_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-lite-preview-02-05:free", // Efficient & Free
                "messages": [{ "role": "user", "content": prompt }]
            })
        });
        
        const aiData = await completion.json();
        
        if (aiData.choices && aiData.choices.length > 0) {
            const report = aiData.choices[0].message.content;
            await sendTelegram(report);
            console.log('✅ REPORT SENT');
        } else {
            console.error('❌ AI ERROR:', JSON.stringify(aiData));
            await sendTelegram('⚠️ *CORTEX FALLBACK:* AI Unavailable. Systems Operational. Data Feed Active.');
        }

    } catch (e) {
        console.error('FAILURE:', e.message);
        await sendTelegram('🔥 *CRITICAL FAILURE:* Report Generation Failed. ' + e.message);
    }
}

async function sendTelegram(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'Markdown' })
    });
}

// --- SCHEDULER & ENTRY POINT ---
console.log('🚀 SENTINEL UNIFIED WORKER STARTED (FEED + AI)');

// Cron Jobs
cron.schedule('* * * * *', fetchMarketData); // Feed every min
cron.schedule('0 * * * *', generateReport);  // AI every hour

// Initial Checks
fetchMarketData();

// If run via GitHub Action (Manual/Scheduled), run report immediately
if (process.env.GH_ACTION || process.argv.includes('--report')) {
    generateReport().then(() => {
        // Keep running for a bit if needed or exit
        // For GH Actions, we usually want to exit after the task
        setTimeout(() => process.exit(0), 10000); 
    });
}
