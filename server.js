const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');

// === SAFETY: previeni crash su errori non gestiti ===
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message || err);
});

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// FETCH FICR con bypass SSL (certificato non valido)
// Usa https.request nativo — nessuna env var necessaria
// ============================================
function fetchFICR(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      rejectUnauthorized: false,   // bypass SSL FICR
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode < 400, status: res.statusCode, json: () => JSON.parse(data) });
        } catch (e) {
          reject(new Error('Invalid JSON from FICR'));
        }
      });
    });
    req.setTimeout(10000, () => {
      req.destroy(new Error('FICR request timeout (10s)'));
    });
    req.on('error', reject);
  });
}

// ============================================
// DATI FICR REALI (gara demo)
// ============================================
let demoData = null;
let demoState = {
  startTime: null,
  currentIndex: 0
};

try {
  const dataPath = path.join(__dirname, 'ficr-demo-data.json');
  if (fs.existsSync(dataPath)) {
    demoData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`✓ Loaded demo data: ${demoData.totalSnapshots} snapshots`);
  }
} catch (e) {
  console.log('Demo data not found, will use simulation');
}

function resetDemo() {
  demoState.startTime = Date.now();
  demoState.currentIndex = 0;
  console.log('Demo race reset');
}

function getDemoSnapshot() {
  if (!demoData) return null;
  if (!demoState.startTime) resetDemo();
  
  const elapsed = (Date.now() - demoState.startTime) / 1000;
  const interval = demoData.intervalSeconds || 3;
  let index = Math.floor(elapsed / interval);
  
  if (index >= demoData.totalSnapshots) {
    resetDemo();
    index = 0;
  }
  
  demoState.currentIndex = index;
  return demoData.snapshots[index];
}

// ============================================
// ENDPOINT PRINCIPALE
// ============================================

app.get('/proxy', async (req, res) => {
  const { u, c, url } = req.query;
  
  // Modalità DEMO
  if ((c === 'demo' || (url && url.includes('c=demo'))) && demoData) {
    const snapshot = getDemoSnapshot();
    if (snapshot) {
      console.log(`Demo: serving snapshot ${snapshot.sequence}/${demoData.totalSnapshots}`);
      return res.json(snapshot.data);
    }
  }
  
  // Costruisce URL FICR — accetta sia ?url=<encodato> (client MX) che ?u=&c=
  let ficrUrl;
  if (url) {
    ficrUrl = decodeURIComponent(url);
    if (!ficrUrl.includes('livetiming.ficr.it')) {
      return res.status(400).json({ error: 'Invalid FICR URL' });
    }
  } else if (u && c) {
    ficrUrl = `https://www.livetiming.ficr.it/${u}/dataSend.php?u=${u}&c=${c}`;
  } else {
    return res.status(400).json({ error: 'Missing parameters: use ?url= or ?u=&c=' });
  }
  
  try {
    const response = await fetchFICR(ficrUrl);
    if (!response.ok) {
      throw new Error(`FICR responded with ${response.status}`);
    }
    const data = response.json();
    res.json(data);
  } catch (error) {
    console.error('FICR proxy error:', error.message);
    res.status(502).json({ error: 'Failed to fetch from FICR', details: error.message });
  }
});

app.post('/demo/reset', (req, res) => {
  resetDemo();
  res.json({ success: true, message: 'Demo race reset' });
});

app.get('/demo/reset', (req, res) => {
  resetDemo();
  res.json({ success: true, message: 'Demo race reset', timestamp: Date.now() });
});

app.get('/demo/status', (req, res) => {
  if (!demoData) return res.json({ available: false });
  const elapsed = demoState.startTime ? (Date.now() - demoState.startTime) / 1000 : 0;
  res.json({
    available: true,
    totalSnapshots: demoData.totalSnapshots,
    currentIndex: demoState.currentIndex,
    elapsedSeconds: Math.floor(elapsed),
    raceId: demoData.raceId
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    demoAvailable: !!demoData,
    demoSnapshots: demoData ? demoData.totalSnapshots : 0
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'FICR Proxy Server',
    version: '2.1.0',
    endpoints: {
      '/proxy?u=USER&c=CODE': 'Proxy FICR data (use c=demo for captured race)',
      '/demo/status': 'Get demo race status',
      '/demo/reset': 'POST to reset demo race',
      '/health': 'Health check'
    },
    demoAvailable: !!demoData
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FICR Proxy v2.1.0 running on port ${PORT}`);
  console.log(`Demo data: ${demoData ? 'LOADED' : 'NOT AVAILABLE'}`);
  console.log(`SSL bypass: ENABLED via https.Agent`);
});
