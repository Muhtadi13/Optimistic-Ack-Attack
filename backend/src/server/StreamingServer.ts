import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SystemMonitor } from '../monitoring/SystemMonitor';
import { ConnectionAnalyzer } from '../monitoring/analyzers/ConnectionAnalyzer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StreamingServer {
  private httpServer: express.Application;
  private systemMonitor: SystemMonitor;
  private connectionAnalyzer: ConnectionAnalyzer;
  private isRunning: boolean = false;

  constructor() {
    this.httpServer = express();
    this.systemMonitor = new SystemMonitor();
    this.connectionAnalyzer = new ConnectionAnalyzer();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // File download endpoint
    this.httpServer.get('/download/:filename', (req, res) => {
      this.handleFileDownload(req, res);
    });

    // HLS streaming endpoint
    this.httpServer.get('/stream/:streamId/playlist.m3u8', (req, res) => {
      this.handleStreamPlaylist(req, res);
    });

    this.httpServer.get('/stream/:streamId/:segment', (req, res) => {
      this.handleStreamSegment(req, res);
    });
  }

  private handleFileDownload(req: express.Request, res: express.Response): void {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../data/files', filename);
    
    // Log connection details for monitoring
    this.connectionAnalyzer.logConnection(req.ip || 'unknown', 'file_download', filename);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      res.status(404).send('File not found');
      return;
    }

    // Support range requests for resume functionality
    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
      this.handleRangeRequest(res, filePath, stat, range);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      });
      fs.createReadStream(filePath).pipe(res);
    }
  }

  private handleRangeRequest(
    res: express.Response, 
    filePath: string, 
    stat: fs.Stats, 
    range: string
  ): void {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'application/octet-stream',
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  private handleStreamPlaylist(req: express.Request, res: express.Response): void {
    const streamId = req.params.streamId;
    
    // Log connection for monitoring
    this.connectionAnalyzer.logConnection(req.ip || 'unknown', 'stream_request', `playlist-${streamId}`);
    
    // Generate HLS playlist
    const playlist = this.generateHLSPlaylist(streamId);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(playlist);
  }

  private handleStreamSegment(req: express.Request, res: express.Response): void {
    const { streamId, segment } = req.params;
    const segmentPath = path.join(__dirname, '../../data/streams', streamId, segment);
    
    // Log connection for monitoring
    this.connectionAnalyzer.logConnection(req.ip || 'unknown', 'stream_request', `${streamId}/${segment}`);
    
    if (fs.existsSync(segmentPath)) {
      res.setHeader('Content-Type', 'video/MP2T');
      fs.createReadStream(segmentPath).pipe(res);
    } else {
      res.status(404).send('Segment not found');
    }
  }

  private generateHLSPlaylist(streamId: string): string {
    const streamDir = path.join(__dirname, '../../data/streams', streamId);
    
    // Check if stream directory exists
    if (!fs.existsSync(streamDir)) {
      return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-ENDLIST`;
    }

    // Read available segments
    const segments = fs.readdirSync(streamDir)
      .filter(file => file.endsWith('.ts'))
      .sort();

    let playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
`;

    segments.forEach(segment => {
      playlist += `#EXTINF:10.0,
${segment}
`;
    });

    playlist += '#EXT-X-ENDLIST';
    return playlist;
  }

  public start(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.systemMonitor.start();
      console.log('Streaming server started');
    }
  }

  public stop(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.systemMonitor.stop();
      console.log('Streaming server stopped');
    }
  }

  public getMetrics() {
    return {
      systemMetrics: this.systemMonitor.getMetrics(),
      connectionMetrics: this.connectionAnalyzer.getMetrics(),
      isRunning: this.isRunning
    };
  }
}
