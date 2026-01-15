const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Parametro url mancante' });
  if (!url.includes('livetiming.ficr.it')) return res.status(403).json({ error: 'Dominio non permesso' });
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'Errore fetch FICR', details: error.message });
  }
});

app.get('/test', (req, res) => {
  const header = { k: '3:00', l: '3:00' };
  const piloti = [
    { b: '27', c: 'ROSSI Marco', j: '3', h: '1:33.500', q: '1', s: '' },
    { b: '14', c: 'BIANCHI Luca', j: '3', h: '1:32.800', q: '2', s: '0:02.100' },
    { b: '55', c: 'VERDI Giuseppe', j: '3', h: '1:34.000', q: '3', s: '0:04.500' },
    { b: '8', c: 'NERI Alessandro', j: '2', h: '1:33.200', q: '4', s: '1:35.000' },
    { b: '33', c: 'GIALLI Franco', j: '2', h: '1:35.500', q: '5', s: '1:38.000' },
    { b: '71', c: 'RUSSO Antonio', j: '2', h: '1:36.000', q: '6', s: '1:41.000' }
  ];
  res.json([header, piloti]);
});

const sessions = {};
const pilotDefinitions = [
  { num: '27', name: 'ROSSI Marco', baseTime: 93500, startPos: 1 },
  { num: '14', name: 'BIANCHI Luca', baseTime: 92800, startPos: 4 },
  { num: '55', name: 'VERDI Giuseppe', baseTime: 94000, startPos: 2 },
  { num: '8', name: 'NERI Alessandro', baseTime: 93200, startPos: 6 },
  { num: '33', name: 'GIALLI Franco', baseTime: 95500, startPos: 3 },
  { num: '71', name: 'RUSSO Antonio', baseTime: 96000, startPos: 5 }
];
const lapVariations = [0, -200, 100, -300, 200, -100, 300, -200, 100, 0];

function formatTime(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return min + ':' + sec.toString().padStart(2, '0') + '.' + millis.toString().padStart(3, '0');
}

function formatGap(ms) {
  if (ms === 0) return '';
  const sec = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return sec + '.' + millis.toString().padStart(3, '0');
}

app.get('/test/live', (req, res) => {
  const sessionId = req.query.session || 'default';
  if (req.query.reset === '1') {
    sessions[sessionId] = Date.now();
    return res.json({ message: 'Timer reset', session: sessionId });
  }
  if (!sessions[sessionId]) sessions[sessionId] = Date.now();
  
  const elapsed = Date.now() - sessions[sessionId];
  
  const pilotStates = pilotDefinitions.map((pilot) => {
    const startDelay = (pilot.startPos - 1) * 800;
    const pilotElapsed = Math.max(0, elapsed - startDelay);
    let totalTime = 0, laps = 0, lastLapTime = 0;
    
    while (totalTime < pilotElapsed && laps < 20) {
      const variation = lapVariations[laps % lapVariations.length];
      const thisLapTime = pilot.baseTime + variation;
      if (totalTime + thisLapTime <= pilotElapsed) {
        totalTime += thisLapTime;
        lastLapTime = thisLapTime;
        laps++;
      } else break;
    }
    return { num: pilot.num, name: pilot.name, laps, totalTime, lastLapTime };
  });
  
  pilotStates.sort((a, b) => b.laps !== a.laps ? b.laps - a.laps : a.totalTime - b.totalTime);
  
  const leaderTime = pilotStates[0].totalTime;
  const leaderLaps = pilotStates[0].laps;
  
  const pilotiArray = pilotStates.map((pilot, pos) => {
    let gap = '';
    if (pos > 0) {
      if (pilot.laps === leaderLaps) gap = formatGap(pilot.totalTime - leaderTime);
      else gap = '+' + (leaderLaps - pilot.laps) + ' giro';
    }
    return {
      b: pilot.num, c: pilot.name, j: pilot.laps.toString(),
      h: pilot.lastLapTime > 0 ? formatTime(pilot.lastLapTime) : '0:00.000',
      q: (pos + 1).toString(), s: gap
    };
  });
  
  const elapsedMin = Math.floor(elapsed / 60000);
  const elapsedSec = Math.floor((elapsed % 60000) / 1000);
  res.json([{ k: elapsedMin + ':' + elapsedSec.toString().padStart(2, '0'), l: '13:00' }, pilotiArray]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server attivo su porta ' + PORT));
