import http from 'http';
import app from './app.js';
import dotenv from 'dotenv';
import { initWebSocketServer } from './services/websocket.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize WebSocket Server
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Dental Management Server is running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});

