
const config = {
    url: 'https://udqxvsgdgxgtnhxxxcgv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcXh2c2dkZ3hndG5oeHh4Y2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcwNTM0NCwiZXhwIjoyMDg0MjgxMzQ0fQ.mUKPJvTeG2MU4Fxfddcbcx2Q7H8EDuXcDtWAbHGvT48',
    seed: 'OMEGA_ZETA_99_QUANTUM_HASH_KEY_V1'
};

// Función para generar SHA-256 nativo en el navegador
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Función para firmar y consultar el Kernel
async function queryKernel(sql) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).substring(7);

    // Generar la firma digital requerida por el Kernel
    const signature = await sha256(config.seed + timestamp + nonce + sql);

    const payload = {
        p_timestamp: timestamp,
        p_nonce: nonce,
        p_signature: signature,
        p_payload: sql,
        p_mode: 'R'
    };

    const res = await fetch(`${config.url}/rest/v1/rpc/_sys_kernel_opt_v9`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    return data;
}

async function updateDashboard() {
    try {
        console.log("Pulsando núcleo...");

        // 1. Obtener Balance y Equity
        const accountData = await queryKernel("SELECT balance, equity FROM public.bot_account ORDER BY created_at DESC LIMIT 1");

        if (accountData && accountData.length > 0) {
            document.getElementById('balance-val').innerText = `$${parseFloat(accountData[0].balance).toLocaleString()}`;
            document.getElementById('equity-val').innerText = `$${parseFloat(accountData[0].equity).toLocaleString()}`;
        }

        // 2. Obtener Trades Activos
        const trades = await queryKernel("SELECT * FROM public.bot_trades WHERE status = 'OPEN' ORDER BY created_at DESC");
        const tbody = document.getElementById('trades-body');
        tbody.innerHTML = '';

        let totalPnL = 0;

        if (trades && trades.length > 0) {
            trades.forEach(trade => {
                const pnl = parseFloat(trade.floating_pnl || 0);
                totalPnL += pnl;

                const row = `
                    <tr>
                        <td><strong>${trade.symbol}</strong></td>
                        <td><span class="type-${trade.side.toLowerCase()}">${trade.side}</span></td>
                        <td>$${parseFloat(trade.entry_price).toFixed(2)}</td>
                        <td>$${parseFloat(trade.current_price || trade.entry_price).toFixed(2)}</td>
                        <td class="${pnl >= 0 ? 'positive' : 'negative'}">$${pnl.toFixed(2)}</td>
                        <td><span class="status-live">EN CACERÍA</span></td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:gray;">No hay cacerías activas ahora mismo.</td></tr>';
        }

        // 3. Actualizar Visuales PnL
        const pnlEl = document.getElementById('pnl-val');
        pnlEl.innerText = `$${totalPnL.toFixed(2)}`;
        pnlEl.style.color = totalPnL >= 0 ? '#00ff88' : '#ff3366';

        document.getElementById('trade-count').innerText = trades ? trades.length : 0;
        document.getElementById('last-update').innerText = new Date().toLocaleTimeString();

        addLog(`Sincronización completa. ${trades ? trades.length : 0} trades activos.`);

    } catch (e) {
        console.error(e);
        addLog("Error de enlace: Reconectando...");
    }
}

function addLog(msg) {
    const list = document.getElementById('log-list');
    if (!list) return;
    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    list.prepend(item);
    if (list.children.length > 8) list.lastChild.remove();
}

// Bucle de actualización cada 10 segundos
setInterval(updateDashboard, 10000);
updateDashboard();
