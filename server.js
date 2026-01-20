const express = require('express');
const cors = require('cors');

const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// DATI FICR REALI (gara demo)
// ============================================
let demoData = null;
let demoState = {
  startTime: null,
  currentIndex: 0
};

// Carica dati demo se disponibili
try {
  const dataPath = path.join(__dirname, 'ficr-demo-data.json');
  if (fs.existsSync(dataPath)) {
    demoData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`✓ Loaded demo data: ${demoData.totalSnapshots} snapshots`);
  }
} catch (e) {
  console.log('Demo data not found, will use simulation');
}

// Reset demo race
function resetDemo() {
  demoState.startTime = Date.now();
  demoState.currentIndex = 0;
  console.log('Demo race reset');
}

// Get current demo snapshot based on elapsed time
function getDemoSnapshot() {
  if (!demoData) return null;
  
  if (!demoState.startTime) {
    resetDemo();
  }
  
  const elapsed = (Date.now() - demoState.startTime) / 1000;
  const interval = demoData.intervalSeconds || 3;
  
  // Calcola indice basato su tempo trascorso
  let index = Math.floor(elapsed / interval);
  
  // Loop alla fine
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

// Proxy FICR con supporto demo
app.get('/proxy', async (req, res) => {
  const { u, c } = req.query;
  
  // Se codice gara = demo, usa dati reali catturati
  if (c === 'demo' && demoData) {
    const snapshot = getDemoSnapshot();
    if (snapshot) {
      console.log(`Demo: serving snapshot ${snapshot.sequence}/${demoData.totalSnapshots}`);
      return res.json(snapshot.data);
    }
  }
  
  // Altrimenti proxy a FICR reale
  if (!u || !c) {
    return res.status(400).json({ error: 'Missing parameters u and c' });
  }
  
  const ficrUrl = `https://www.livetiming.ficr.it/${u}/dataSend.php?u=${u}&c=${c}`;
  
  try {
    const response = await fetch(ficrUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`FICR responded with ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('FICR proxy error:', error.message);
    res.status(502).json({ error: 'Failed to fetch from FICR', details: error.message });
  }
});

// Reset demo race
app.post('/demo/reset', (req, res) => {
  resetDemo();
  res.json({ success: true, message: 'Demo race reset' });
});

// Demo status
app.get('/demo/status', (req, res) => {
  if (!demoData) {
    return res.json({ available: false });
  }
  
  const elapsed = demoState.startTime ? (Date.now() - demoState.startTime) / 1000 : 0;
  res.json({
    available: true,
    totalSnapshots: demoData.totalSnapshots,
    currentIndex: demoState.currentIndex,
    elapsedSeconds: Math.floor(elapsed),
    raceId: demoData.raceId
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    demoAvailable: !!demoData,
    demoSnapshots: demoData ? demoData.totalSnapshots : 0
  });
});

// Info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FICR Proxy Server',
    version: '2.0.0',
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
  console.log(`FICR Proxy running on port ${PORT}`);
  console.log(`Demo data: ${demoData ? 'LOADED' : 'NOT AVAILABLE'}`);
});
