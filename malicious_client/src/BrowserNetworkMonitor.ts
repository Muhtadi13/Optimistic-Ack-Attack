export interface NetworkMetrics {
  downloadSpeed: number;
  uploadSpeed: number;
  latency: number;
  bandwidth: number;
  packetsPerSecond: number;
}

export class BrowserNetworkMonitor {
  private metrics: NetworkMetrics = {
    downloadSpeed: 0,
    uploadSpeed: 0,
    latency: 0,
    bandwidth: 0,
    packetsPerSecond: 0
  };

  private updateInterval: number | null = null;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.updateInterval = window.setInterval(() => {
      // Simulate realistic network metrics
      this.metrics.downloadSpeed = Math.random() * 1000000 + 500000; // 0.5-1.5MB/s
      this.metrics.uploadSpeed = this.metrics.downloadSpeed * (0.1 + Math.random() * 0.2); // 10-30% of download
      this.metrics.latency = 20 + Math.random() * 50; // 20-70ms
      this.metrics.bandwidth = this.metrics.downloadSpeed + this.metrics.uploadSpeed;
      this.metrics.packetsPerSecond = 100 + Math.random() * 500; // 100-600 pps
    }, 1000);
  }

  public getMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }

  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}