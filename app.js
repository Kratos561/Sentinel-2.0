
const config = {
    url: 'https://udqxvsgdgxgtnhxxxcgv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcXh2c2dkZ3hndG5oeHh4Y2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcwNTM0NCwiZXhwIjoyMDg0MjgxMzQ0fQ.mUKPJvTeG2MU4Fxfddcbcx2Q7H8EDuXcDtWAbHGvT48',
    seed: 'OMEGA_ZETA_99_QUANTUM_HASH_KEY_V1'
};

// Función para firmar y consultar el Kernel
async function queryKernel(sql) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).substring(7);

    // NOTA: En producción (Vercel), nunca expondríamos la lógica de firma en el frontend.
    // Usaríamos una Serverless Function. Para este demo, usaremos el RPC directamente.

    const payload = {
        p_timestamp: timestamp,
        p_nonce: nonce,
        p_payload: sql,
        p_mode: 'R'
    };

    // Firmar el payload (Esto debería ser del lado del servidor idealmente)
    // Para simplificar la conexión directa desde el navegador:
    const res = await fetch(`${config.url}/rest/v1/rpc/_sys_kernel_opt_v9`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify(payload)
    });

    return await res.json();
}

async function updateDashboard() {
    try {
        addLog("Pulsando núcleo de datos...");

        // 1. Obtener Balance y Equity
        const accountData = await queryKernel("SELECT balance, equity FROM public.bot_account ORDER BY created_at DESC LIMIT 1");
        if (accountData && accountData[0]) {
            document.getElementById('balance-val').innerText = `$${parseFloat(accountData[0].balance).toLocaleString()}`;
            document.getElementById('equity-val').innerText = `$${parseFloat(accountData[0].equity).toLocaleString()}`;
        }

        // 2. Obtener Trades Activos
        const trades = await queryKernel("SELECT * FROM public.bot_trades WHERE status = 'OPEN' ORDER BY created_at DESC");
        const tbody = document.getElementById('trades-body');
        tbody.innerHTML = '';

        let totalPnL = 0;

        trades.forEach(trade => {
            const pnl = parseFloat(trade.floating_pnl || 0);
            totalPnL += pnl;

            const row = `
                <tr>
                    <td><strong>${trade.symbol}</strong></td>
                    <td><span class="type ${trade.side.toLowerCase()}">${trade.side}</span></td>
                    <td>$${parseFloat(trade.entry_price).toFixed(2)}</td>
                    <td>$${parseFloat(trade.current_price || trade.entry_price).toFixed(2)}</td>
                    <td class="${pnl >= 0 ? 'positive' : 'negative'}">$${pnl.toFixed(2)}</td>
                    <td><span class="status-live">EN CACERÍA</span></td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        // 3. Actualizar Visuales PnL
        const pnlEl = document.getElementById('pnl-val');
        pnlEl.innerText = `$${totalPnL.toFixed(2)}`;
        pnlEl.className = `value ${totalPnL >= 0 ? 'positive' : 'negative'}`;

        document.getElementById('trade-count').innerText = trades.length;
        document.getElementById('last-update').innerText = new Date().toLocaleTimeString();

        addLog(`Sincronización completa. ${trades.length} trades activos.`);

    } catch (e) {
        console.error(e);
        addLog("Error de enlace: Reconectando...");
    }
}

function addLog(msg) {
    const list = document.getElementById('log-list');
    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    list.prepend(item);
    if (list.children.length > 10) list.lastChild.remove();
}

// Bucle de actualización cada 10 segundos
setInterval(updateDashboard, 10000);
updateDashboard();
