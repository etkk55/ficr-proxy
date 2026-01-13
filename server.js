const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Health check per Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy FICR
app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'Parametro url mancante' });
  }

  if (!url.includes('livetiming.ficr.it')) {
    return res.status(403).json({ error: 'Dominio non permesso' });
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({ error: 'Errore fetch FICR', details: error.message });
  }
});

// ============================================================
// DEMO LIVE - Simula gara in corso con formato FICR reale
// ============================================================

let demoStartTime = null;

// Piloti demo (basati su dati reali FICR)
const demoPilots = [
  { b: '302', c: 'FRANCESCO ASTE', d: 'MANZANO', e: 'GASGAS 250 4T', baseLap: 70000 },
  { b: '85',  c: 'THOMAS BASSO', d: 'FANNA', e: 'KTM 250 4T', baseLap: 72000 },
  { b: '461', c: 'CRISTIANO DOTTI', d: 'POLISPORTIVA', e: 'GASGAS 250 4T', baseLap: 73000 },
  { b: '116', c: 'HANNES PFATTNER', d: 'ALP-RIDERS MERAN', e: 'GASGAS 250 2T', baseLap: 72500 },
  { b: '15',  c: 'RICCARDO MINERVINI', d: 'CARSO', e: 'KTM 250 4T', baseLap: 73500 },
  { b: '245', c: 'FILIPPO TRICHES', d: 'TRE PINI', e: 'YAMAHA 250 2T', baseLap: 74000 }
];

// Formatta tempo in mm:ss.mmm (formato FICR)
function formatLapTime(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
}

// Formatta distacco
function formatGap(ms) {
  if (ms === 0) return '';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
  }
  return `00:${seconds.toFixed(3).padStart(6, '0')}`;
}

app.get('/test/live', (req, res) => {
  // Reset timer
  if (req.query.reset === '1') {
    demoStartTime = Date.now();
    return res.json({ message: 'Demo reset', startTime: demoStartTime });
  }
  
  // Inizializza al primo accesso
  if (!demoStartTime) {
    demoStartTime = Date.now();
  }
  
  const elapsed = Date.now() - demoStartTime;
  const raceDuration = 13 * 60 * 1000; // 13 minuti
  const remaining = Math.max(0, raceDuration - elapsed);
  
  // Header gara (formato FICR)
  const header = {
    a: 'gara',
    c: 'Demo Gara MX1-MX2',
    d: 'MX1 RIDER',
    e: '1.720',
    f: 'Circuito Demo',
    j: '13:00',
    k: formatLapTime(elapsed).substring(0, 5),
    l: formatLapTime(remaining).substring(0, 5),
    m: 'Green',
    s: 'demo'
  };
  
  // Calcola stato piloti
  const pilotsState = demoPilots.map((pilot, index) => {
    // Offset partenza (simula distacchi iniziali)
    const startOffset = index * 2000;
    const pilotElapsed = Math.max(0, elapsed - startOffset);
    
    // Variazione casuale sul lap time (±3%)
    const variation = 1 + (Math.sin(elapsed / 10000 + index) * 0.03);
    const currentLapTime = Math.round(pilot.baseLap * variation);
    
    // Calcola giri completati
    const giri = pilotElapsed > 0 ? Math.floor(pilotElapsed / currentLapTime) + 1 : 1;
    
    // Tempo totale
    const tempoTotale = giri * currentLapTime;
    
    return {
      pilot,
      giri: Math.min(giri, 15), // Max 15 giri
      lapTime: currentLapTime,
      tempoTotale,
      index
    };
  });
  
  // Ordina per giri (desc) poi tempo totale (asc)
  pilotsState.sort((a, b) => {
    if (b.giri !== a.giri) return b.giri - a.giri;
    return a.tempoTotale - b.tempoTotale;
  });
  
  // Genera risposta formato FICR
  const leaderTempo = pilotsState[0].tempoTotale;
  
  const riders = pilotsState.map((state, pos) => {
    const gap = state.tempoTotale - leaderTempo;
    
    return {
      a: String(1000 + state.index),
      b: state.pilot.b,
      c: state.pilot.c,
      d: state.pilot.d,
      e: state.pilot.e,
      f: 'Demo Gara MX1-MX2',
      g: 'MX1 RIDER',
      y: 'MX2 RIDER',
      i: '1',
      j: String(state.giri),  // GIRI COMPLETATI (stringa!)
      h: formatLapTime(state.lapTime),  // Lap time formato mm:ss.mmm
      m: formatLapTime(state.lapTime),  // Best lap
      p: formatLapTime(state.tempoTotale),  // Tempo totale
      q: String(pos + 1),  // Posizione
      r: String(pos + 1),
      s: formatGap(gap),  // Distacco dal primo
      t: pos > 0 ? formatGap(state.tempoTotale - pilotsState[pos - 1].tempoTotale) : '',
      v: '0',
      w: String(50 + state.index),
      x: '0'
    };
  });
  
  // Risposta formato FICR: [header, [riders...]]
  res.json([header, riders]);
});

// Dati test statici
app.get('/test', (req, res) => {
  const testData = [
    { b: '302', c: 'FRANCESCO ASTE', j: '5', h: '01:10.907', q: '1', s: '' },
    { b: '85',  c: 'THOMAS BASSO', j: '5', h: '01:12.453', q: '2', s: '00:05.156' },
    { b: '461', c: 'CRISTIANO DOTTI', j: '5', h: '01:13.547', q: '3', s: '00:06.313' },
    { b: '116', c: 'HANNES PFATTNER', j: '5', h: '01:12.641', q: '4', s: '00:07.469' },
    { b: '15',  c: 'RICCARDO MINERVINI', j: '5', h: '01:12.828', q: '5', s: '00:07.594' },
    { b: '245', c: 'FILIPPO TRICHES', j: '5', h: '01:13.094', q: '6', s: '00:08.391' }
  ];
  res.json(testData);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏁 FICR Proxy Server attivo su porta ${PORT}`);
  console.log(`   /health     - Health check`);
  console.log(`   /proxy?url= - Proxy FICR`);
  console.log(`   /test/live  - Demo gara simulata`);
  console.log(`   /test       - Dati statici`);
});
