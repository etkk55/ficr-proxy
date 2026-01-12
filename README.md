# FICR Proxy Server

Proxy CORS per accedere ai dati FICR Live Timing dal browser.

## Endpoints

| Endpoint | Descrizione |
|----------|-------------|
| `GET /health` | Health check |
| `GET /proxy?url=<URL>` | Proxy verso FICR (solo domini `livetiming.ficr.it`) |
| `GET /test` | Dati test statici (6 piloti) |
| `GET /test/live` | Simulazione gara in corso |
| `GET /test/live?reset=1` | Reset timer simulazione |

## Uso nel cronometro

```javascript
// URL FICR originale
const ficrUrl = 'https://www.livetiming.ficr.it/cronotreviso/dataSend.php?u=cronotreviso&c=CODICE';

// Via proxy
const proxyUrl = 'https://TUO-PROXY.railway.app/proxy?url=' + encodeURIComponent(ficrUrl);
const response = await fetch(proxyUrl);
const data = await response.json();
```

## Deploy su Railway

### 1. Crea repository GitHub

```bash
cd proxy-server
git init
git add .
git commit -m "Initial commit - FICR proxy"
git remote add origin https://github.com/TUO-USER/ficr-proxy.git
git push -u origin main
```

### 2. Deploy su Railway

1. Vai su [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Seleziona il repository `ficr-proxy`
4. Railway rileva automaticamente Node.js
5. Attendi deploy (~1 minuto)
6. Click "Generate Domain" per ottenere URL pubblico

### 3. Configura cronometro

Sostituisci nel cronometro:
```javascript
const PROXY_BASE_URL = 'https://TUO-NOME.railway.app';
```

## Test locale

```bash
npm install
npm start
# Server attivo su http://localhost:3000

# Test health
curl http://localhost:3000/health

# Test dati simulati
curl http://localhost:3000/test

# Test proxy (solo se FICR raggiungibile)
curl "http://localhost:3000/proxy?url=https://www.livetiming.ficr.it/cronotreviso/dataSend.php?u=cronotreviso&c=CODICE"
```

## Struttura dati FICR

```json
[
  {
    "n": "27",       // Numero pilota
    "p": "ROSSI M.", // Nome pilota
    "g": 3,          // Giri completati
    "j": 95234,      // Ultimo tempo giro (ms)
    "t": 285702      // Tempo totale (ms)
  }
]
```

## Note

- Il proxy accetta SOLO URL con dominio `livetiming.ficr.it`
- Headers CORS abilitati per qualsiasi origine
- Railway si autoscala e gestisce SSL
