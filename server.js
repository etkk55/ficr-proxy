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

// Dati test statici - formato FICR compatibile
app.get('/test', (req, res) => {
  const header = { k: '3:00', l: '3:00' };
  const piloti = [
    { b: '27', c: 'ROSSI Marco',      j: '3', h: '1:35.234', q: '1', s: '' },
    { b: '14', c: 'BIANCHI Luca',     j: '3', h: '1:36.512', q: '2', s: '0:03.200' },
    { b: '55', c: 'VERDI Giuseppe',   j: '3', h: '1:37.891', q: '3', s: '0:06.500' },
    { b: '8',  c: 'NERI Alessandro',  j: '2', h: '1:38.234', q: '4', s: '1:35.000' },
    { b: '33', c: 'GIALLI Franco',    j: '2', h: '1:39.102', q: '5', s: '1:38.000' },
    { b: '71', c: 'RUSSO Antonio',    j: '2', h: '1:40.456', q: '6', s: '1:41.000' }
  ];
  res.json([header, piloti]);
});

// Dati test dinamici (simula gara in corso) - formato FICR compatibile
// SESSIONI: ogni sessionId ha il suo timer indipendente
const sessions = {};

app.get('/test/live', (req, res) => {
  const sessionId = req.query.session || 'default';
  
  // Reset sessione specifica
  if (req.query.reset === '1') {
    sessions[sessionId] = Date.now();
    return res.json({ message: 'Timer reset', session: sessionId, startTime: sessions[sessionId] });
  }
  
  // Prima chiamata di questa sessione: inizializza timer
  if (!sessions[sessionId]) {
    sessions[sessionId] = Date.now();
  }
  
  const elapsed = Date.now() - sessions[sessionId] + 180000; // +2min per demo veloce
  const lapTime = 95000; // ~1:35 per giro
  
  // Formato tempo: "M:SS.mmm"
  function formatTime(ms) {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${min}:${sec.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
  
  const pilots = [
    { num: '27', name: 'ROSSI Marco' },
    { num: '14', name: 'BIANCHI Luca' },
    { num: '55', name: 'VERDI Giuseppe' },
    { num: '8',  name: 'NERI Alessandro' },
    { num: '33', name: 'GIALLI Franco' },
    { num: '71', name: 'RUSSO Antonio' }
  ];
  
  const pilotiArray = pilots.map((pilot, i) => {
    const offset = i * 3000; // 3s distacco tra piloti
    const pilotElapsed = Math.max(0, elapsed - offset);
    const giri = Math.floor(pilotElapsed / lapTime);
    const lastLapMs = giri > 0 ? lapTime + Math.floor(Math.random() * 2000 - 1000) : 0;
    const distaccoMs = i * 3000;
    
    return {
      b: pilot.num,           // numero pilota
      c: pilot.name,          // nome pilota
      j: giri.toString(),     // giri completati
      h: formatTime(lastLapMs), // ultimo tempo giro (stringa)
      q: (i + 1).toString(),  // posizione
      s: i === 0 ? '' : formatTime(distaccoMs) // distacco dal primo
    };
  });
  
  // Header gara (formato FICR)
  const elapsedMin = Math.floor(elapsed / 60000);
  const elapsedSec = Math.floor((elapsed % 60000) / 1000);
  const header = {
    k: `${elapsedMin}:${elapsedSec.toString().padStart(2, '0')}`, // tempo trascorso
    l: '6:00' // tempo rimanente (fisso per test)
  };
  
  // Formato FICR: [header, [piloti]]
  res.json([header, pilotiArray]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Proxy FICR attivo su porta ${PORT}`);
  console.log(`   /health     → health check`);
  console.log(`   /proxy?url= → proxy FICR`);
  console.log(`   /test       → dati statici`);
  console.log(`   /test/live  → simulazione gara`);
  console.log(`   /test/live?session=XXX → sessione dedicata`);
  console.log(`   /test/live?session=XXX&reset=1 → reset sessione`);
});
