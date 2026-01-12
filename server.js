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

  // Validazione: solo domini FICR permessi
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

// Dati test simulati
app.get('/test', (req, res) => {
  const testData = [
    { n: '27',  p: 'ROSSI Marco',      g: 3, j: 95234,  t: 285702 },
    { n: '14',  p: 'BIANCHI Luca',     g: 3, j: 96512,  t: 289536 },
    { n: '55',  p: 'VERDI Giuseppe',   g: 3, j: 97891,  t: 293673 },
    { n: '8',   p: 'NERI Alessandro',  g: 2, j: 98234,  t: 196468 },
    { n: '33',  p: 'GIALLI Franco',    g: 2, j: 99102,  t: 198204 },
    { n: '71',  p: 'RUSSO Antonio',    g: 2, j: 100456, t: 200912 }
  ];
  res.json(testData);
});

// Dati test dinamici (simula gara in corso)
let testStartTime = null;
app.get('/test/live', (req, res) => {
  if (req.query.reset === '1') {
    testStartTime = Date.now();
    return res.json({ message: 'Timer reset', startTime: testStartTime });
  }
  
  if (!testStartTime) {
    testStartTime = Date.now();
  }
  
  const elapsed = Date.now() - testStartTime;
  const lapTime = 95000; // ~1:35 per giro
  
  const pilots = [
    { n: '27', p: 'ROSSI Marco' },
    { n: '14', p: 'BIANCHI Luca' },
    { n: '55', p: 'VERDI Giuseppe' },
    { n: '8',  p: 'NERI Alessandro' },
    { n: '33', p: 'GIALLI Franco' },
    { n: '71', p: 'RUSSO Antonio' }
  ];
  
  const data = pilots.map((pilot, i) => {
    const offset = i * 3000; // 3s distacco tra piloti
    const pilotElapsed = Math.max(0, elapsed - offset);
    const giri = Math.floor(pilotElapsed / lapTime);
    const lastLapMs = giri > 0 ? lapTime + (Math.random() * 2000 - 1000) : 0;
    const totalMs = giri * lapTime + (Math.random() * 1000);
    
    return {
      n: pilot.n,
      p: pilot.p,
      g: giri,
      j: Math.round(lastLapMs),
      t: Math.round(totalMs)
    };
  });
  
  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Proxy FICR attivo su porta ${PORT}`);
  console.log(`   /health     → health check`);
  console.log(`   /proxy?url= → proxy FICR`);
  console.log(`   /test       → dati statici`);
  console.log(`   /test/live  → simulazione gara`);
});
