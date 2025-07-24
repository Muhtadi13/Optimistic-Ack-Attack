import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { StreamingServer } from './server/StreamingServer';
import { MonitoringService } from './services/MonitoringService';
import { WebSocketManager } from './server/WebSocketManager';
import streamingRoutes from './routes/streaming';
import monitoringRoutes from './routes/monitoring';
import attackRoutes from './routes/attack';

class App {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private streamingServer: StreamingServer;
  private monitoringService: MonitoringService;
  private webSocketManager: WebSocketManager;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
    
    this.streamingServer = new StreamingServer();
    this.monitoringService = new MonitoringService();
    this.webSocketManager = new WebSocketManager(this.io);

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeWebSockets();
  }

  private initializeMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  private initializeRoutes(): void {
    this.app.use('/api/streaming', streamingRoutes);
    this.app.use('/api/monitoring', monitoringRoutes);
    this.app.use('/api/attack', attackRoutes);
  }

  private initializeWebSockets(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      this.webSocketManager.handleConnection(socket);
    });
  }

  public start(port: number = 3001): void {
    this.server.listen(port, () => {
      console.log(`Server running on port ${port}`);
      this.monitoringService.start();
    });
  }
}

export default App;
