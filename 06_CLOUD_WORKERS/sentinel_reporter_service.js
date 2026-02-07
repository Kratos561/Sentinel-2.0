require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://udqxvsgdgxgtnhxxxcgv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcXh2c2dkZ3hndG5oeHh4Y2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcwNTM0NCwiZXhwIjoyMDg0MjgxMzQ0fQ.mUKPJvTeG2MU4Fxfddcbcx2Q7H8EDuXcDtWAbHGvT48';
const OPENROUTER_KEY = process.env.OPENROUTER_KEY || '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';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8158152948:AAGe19Ruzjj5EOjT_oGIZ0medl20fkeYd3I';
const CHAT_ID = '6702262011';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🛡️ SENTINEL REPORTER SERVICE STARTED');

async function report() {
    try {
        console.log('Generating report...');
        
        // 1. Market Data
        const { data: prices } = await supabase
            .from('bot_historical_master')
            .select('symbol, close_price')
            .order('created_at', { ascending: false })
            .limit(20);
            
        const map = {};
        if(prices) prices.forEach(p => { if(!map[p.symbol]) map[p.symbol] = p.close_price; });
        const market = Object.keys(map).map(s => `| ${s} | $${Number(map[s]).toFixed(2)} | -- | NEUTRAL | MEDIA |`).join('\n');

        // 2. PnL
        const today = new Date().toISOString().split('T')[0];
        const { data: trades } = await supabase.from('bot_trades').select('pnl').eq('status', 'CLOSED').gt('closed_at', today + 'T00:00:00Z');
        const pnl = trades ? trades.reduce((sum, t) => sum + (Number(t.pnl)||0), 0) : 0;

        // 3. AI
        const prompt = `Genera REPORTE MILITAR EJECUTIVO Sentinel. Formato EXACTO:
🛡️ REPORTE GLOBAL - ${new Date().toISOString().substring(11, 16)} UTC
ESTADO: NEUTRAL. PnL: $${pnl.toFixed(2)}.

---
| ACTIVO | PRECIO |
| :---: | :---: |
${market}

---
ANALISIS RIESGO: 1. General: Neutral. 2. Prioridad: Ninguna. 3. Accion: Esperar.
JUSTIFICACION: Mercado consolidando.`;

        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-001",
                "messages": [{ "role": "user", "content": prompt }]
            })
        });
        const aiJson = await aiRes.json();
        const text = aiJson.choices?.[0]?.message?.content || "AI Error";

        // 4. Telegram
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: "Markdown" })
        });
        console.log('Report sent.');
    } catch (e) { console.error(e); }
}

// Run immediately
report();

// Schedule
cron.schedule('0 * * * *', report);
