import { AttackConfig, AttackMetrics } from './types/AttackTypes';

export class BrowserAttackSimulator {
  private config: AttackConfig;
  private metrics: AttackMetrics;
  private isActive: boolean = false;
  private attackTimer: number | null = null;
  private startTime: number = 0;

  constructor(config: AttackConfig) {
    this.config = { ...config }; // Clone config to avoid mutations
    this.metrics = {
      packetsPressed: 0,
      successfulAcks: 0,
      connectionEstablished: false,
      attackStartTime: 0,
      currentSpeed: 0,
      totalDataTransferred: 0
    };
    
    console.log('🔧 Browser Attack Simulator initialized with config:', this.config);
  }

  public async executeAttack(): Promise<void> {
    console.log('🚀 Starting simulated Optimistic ACK attack...');
    
    this.startTime = Date.now();
    this.metrics.attackStartTime = this.startTime;
    this.isActive = true;
    
    // Simulate connection establishment delay
    console.log('🔗 Establishing connection...');
    await this.delay(1000);
    
    this.metrics.connectionEstablished = true;
    console.log('✅ Connection established (simulated)');

    // Start the attack loop
    return new Promise<void>((resolve) => {
      this.attackTimer = window.setInterval(() => {
        if (!this.isActive) {
          this.cleanup();
          resolve();
          return;
        }

        // Simulate sending optimistic ACK packets
        this.simulatePacketSending();
        
        // Check if attack duration exceeded
        const elapsed = (Date.now() - this.startTime) / 1000;
        if (elapsed >= this.config.attackDuration) {
          console.log(`⏰ Attack duration (${this.config.attackDuration}s) completed`);
          this.stopAttack();
          resolve();
        }
      }, this.config.packetInterval);
    });
  }

  private simulatePacketSending(): void {
    // Increment packet counters
    this.metrics.packetsPressed++;
    
    // Simulate success rate (90-95% success rate)
    if (Math.random() > 0.05) {
      this.metrics.successfulAcks++;
    }
    
    // Update data transferred
    this.metrics.totalDataTransferred += this.config.ackAdvanceSize;
    
    // Calculate current speed
    const elapsed = (Date.now() - this.metrics.attackStartTime) / 1000;
    if (elapsed > 0) {
      this.metrics.currentSpeed = this.metrics.totalDataTransferred / elapsed;
    }

    // Log occasional status updates
    if (this.metrics.packetsPressed % 50 === 0) {
      console.log(`📊 Packets sent: ${this.metrics.packetsPressed}, Success rate: ${((this.metrics.successfulAcks / this.metrics.packetsPressed) * 100).toFixed(1)}%`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    if (this.attackTimer) {
      clearInterval(this.attackTimer);
      this.attackTimer = null;
    }
  }

  public getMetrics(): AttackMetrics {
    return { ...this.metrics };
  }

  public stopAttack(): void {
    console.log('🛑 Stopping attack...');
    this.isActive = false;
    this.cleanup();
    console.log('✅ Attack stopped');
  }

  public isAttackActive(): boolean {
    return this.isActive;
  }
}