import { EventEmitter } from 'events';

export class NetworkMonitor extends EventEmitter {
  private metrics = {
    downloadSpeed: 0,
    uploadSpeed: 0,
    latency: 0,
    bandwidth: 0,
    packetsPerSecond: 0
  };

  private intervalId: NodeJS.Timeout | null = null;
  private lastCheck = Date.now();
  private bytesTransferred = 0;
  private packetsTransferred = 0;

  constructor() {
    super();
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.intervalId = setInterval(() => {
      this.updateMetrics();
      this.emit('metrics', this.metrics);
    }, 1000);
  }

  private updateMetrics(): void {
    const now = Date.now();
    const elapsed = (now - this.lastCheck) / 1000;

    // Simulate network metrics based on attack activity
    this.metrics.downloadSpeed = this.bytesTransferred / elapsed;
    this.metrics.uploadSpeed = this.bytesTransferred * 0.1; // Assume 10% upload
    this.metrics.latency = Math.random() * 50 + 10; // 10-60ms
    this.metrics.bandwidth = this.metrics.downloadSpeed + this.metrics.uploadSpeed;
    this.metrics.packetsPerSecond = this.packetsTransferred / elapsed;

    // Reset counters
    this.bytesTransferred = 0;
    this.packetsTransferred = 0;
    this.lastCheck = now;
  }

  public recordTransfer(bytes: number, packets: number = 1): void {
    this.bytesTransferred += bytes;
    this.packetsTransferred += packets;
  }

  public getMetrics() {
    return { ...this.metrics };
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}