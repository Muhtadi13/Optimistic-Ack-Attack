import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { StreamingServer } from './server/StreamingServer.js';

class App {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private streamingServer: StreamingServer;
  private metricsInterval: NodeJS.Timeout | null = null;
  private statusInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
    
    this.streamingServer = new StreamingServer();

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
    // Mount the streaming server routes directly
    this.app.get('/download/:filename', (req, res) => {
      this.streamingServer['handleFileDownload'](req, res);
    });

    this.app.get('/stream/:streamId/playlist.m3u8', (req, res) => {
      this.streamingServer['handleStreamPlaylist'](req, res);
    });

    this.app.get('/stream/:streamId/:segment', (req, res) => {
      this.streamingServer['handleStreamSegment'](req, res);
    });

    // Server control endpoints
    this.app.post('/api/server/start', (req, res) => {
      // Logic to start server monitoring
      this.startMetricsEmission();
      this.io.emit('server-status', true);
      res.json({ status: 'started' });
    });

    this.app.post('/api/server/stop', (req, res) => {
      // Logic to stop server monitoring
      this.stopMetricsEmission();
      this.io.emit('server-status', false);
      res.json({ status: 'stopped' });
    });

    // Basic health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });
  }

  private initializeWebSockets(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Send initial server status
      socket.emit('server-status', true);
      
      // Send initial metrics if available
      try {
        const metrics = this.getSystemMetrics();
        socket.emit('metrics-update', metrics);
      } catch (error) {
        console.error('Error getting initial metrics:', error);
      }
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });

      socket.on('request-metrics', () => {
        try {
          const metrics = this.getSystemMetrics();
          socket.emit('metrics-update', metrics);
        } catch (error) {
          console.error('Error sending metrics:', error);
        }
      });

      socket.on('request-server-status', () => {
        socket.emit('server-status', true);
      });
    });
  }

  private startMetricsEmission(): void {
    if (this.metricsInterval) return;

    // this.metricsInterval = setInterval(() => {
      try {
        const metrics = this.getSystemMetrics();
        this.io.emit('metrics-update', metrics);
      } catch (error) {
        console.error('Error emitting metrics:', error);
      }
    //}, 2000); // Emit metrics every 2 seconds
  }

  private stopMetricsEmission(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private startStatusEmission(): void {
    if (this.statusInterval) return;
    //this.statusInterval = setInterval(() => {
      this.io.emit('server-status', true);
    //}, 5000); // Emit status every 5 seconds
  }

  private stopStatusEmission(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }

  private getSystemMetrics() {
    // Generate mock metrics for now - replace with actual system monitoring
    return {
      timestamp: Date.now(),
      cpu: {
        usage: Math.random() * 100,
        temperature: Math.floor(Math.random() * 20) + 45
      },
      memory: {
        total: 16 * 1024 * 1024 * 1024, // 16GB
        used: Math.random() * 8 * 1024 * 1024 * 1024, // Random usage up to 8GB
        free: 0,
        percentage: Math.random() * 80
      },
      disk: {
        total: 500 * 1024 * 1024 * 1024, // 500GB
        used: Math.random() * 250 * 1024 * 1024 * 1024,
        free: 0,
        percentage: Math.random() * 70
      },
      network: {
        bytesSent: Math.floor(Math.random() * 1000000),
        bytesReceived: Math.floor(Math.random() * 1000000),
        packetsSent: Math.floor(Math.random() * 10000),
        packetsReceived: Math.floor(Math.random() * 10000)
      },
      uptime: Math.floor(Date.now() / 1000)
    };
  }

  public start(port: number = 3001): void {
    this.server.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
      console.log('📡 WebSocket server ready');
      console.log('📥 Available endpoints:');
      console.log('  - GET /health - Health check');
      console.log('  - GET /download/:filename - Download files');
      console.log('  - GET /stream/:streamId/playlist.m3u8 - HLS playlist');
      console.log('  - GET /stream/:streamId/:segment - HLS segments');
      console.log('  - POST /api/server/start - Start monitoring');
      console.log('  - POST /api/server/stop - Stop monitoring');
      
      // Start emitting metrics by default
      this.startMetricsEmission();
      this.startStatusEmission();
    });
  }

  public stop(): void {
    this.stopMetricsEmission();
    this.stopStatusEmission();
    if (this.server) {
      this.server.close();
    }
  }
}

// Auto-start the server
const app = new App();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.start(port);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  app.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  app.stop();
  process.exit(0);
});

export default App;
