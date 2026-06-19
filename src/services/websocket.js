import { WebSocketServer } from 'ws';
import os from 'os';

let wss = null;

function getCpuTicks() {
  const cpus = os.cpus() || [];
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  const total = user + nice + sys + idle + irq;
  return { idle, total };
}

let lastCpuInfo = getCpuTicks();

function getCpuUsage() {
  const currentCpuInfo = getCpuTicks();
  const idleDifference = currentCpuInfo.idle - lastCpuInfo.idle;
  const totalDifference = currentCpuInfo.total - lastCpuInfo.total;
  lastCpuInfo = currentCpuInfo;
  
  if (totalDifference === 0) return 0;
  const usage = 100 - (100 * idleDifference / totalDifference);
  return Math.max(0, Math.min(100, Math.round(usage)));
}

function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
}

export function initWebSocketServer(server) {
  wss = new WebSocketServer({
    server,
    verifyClient: ({ origin, req }, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : ['http://localhost:5000', 'http://localhost:3000'];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(true);
      } else {
        console.warn(`[WEBSOCKET] Rejected connection from unauthorized origin: ${origin}`);
        callback(false, 403, 'Forbidden');
      }
    }
  });

  wss.on('connection', (ws) => {
    // Send initial metrics immediately on connection
    const currentCpu = getCpuUsage();
    const currentRam = getMemoryUsage();
    const activeUsers = wss.clients.size;

    ws.send(JSON.stringify({
      type: 'metrics',
      data: {
        activeUsers,
        cpu: currentCpu,
        ram: currentRam
      }
    }));

    // Broadcast updated connections count to all clients
    broadcastEvent({
      type: 'metrics',
      data: {
        activeUsers,
        cpu: currentCpu,
        ram: currentRam
      }
    });

    ws.on('close', () => {
      broadcastEvent({
        type: 'metrics',
        data: {
          activeUsers: wss ? wss.clients.size : 0,
          cpu: getCpuUsage(),
          ram: getMemoryUsage()
        }
      });
    });
  });

  // Run a periodic metrics broadcast every 3 seconds
  setInterval(() => {
    if (!wss) return;
    const cpu = getCpuUsage();
    const ram = getMemoryUsage();
    const activeUsers = wss.clients.size;

    broadcastEvent({
      type: 'metrics',
      data: {
        activeUsers,
        cpu,
        ram
      }
    });
  }, 3000);

  console.log('[WEBSOCKET] Server registered successfully.');
  return wss;
}

/**
 * Broadcasts an event JSON payload to all open admin WebSocket clients.
 * @param {object} event - Payload containing type and data fields
 */
export function broadcastEvent(event) {
  if (!wss) return;
  const message = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // 1 = OPEN
      try {
        client.send(message);
      } catch (err) {
        console.error('[WEBSOCKET BROADCAST ERROR]', err.message);
      }
    }
  }
}
