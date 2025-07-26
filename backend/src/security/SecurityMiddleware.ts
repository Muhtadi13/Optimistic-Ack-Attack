import express from 'express';
import { DefenseSystem, DefenseConfig } from './DefenseSystem.js';

export interface SecurityConfig {
  enableSecurityHeaders: boolean;
  enableConnectionThrottling: boolean;
  maxConnectionsPerIP: number;
  blocklistEnabled: boolean;
  customRules: SecurityRule[];
  // Defense system configs
  ackValidationEnabled?: boolean;
  rateLimitingEnabled?: boolean;
  sequenceTrackingEnabled?: boolean;
  adaptiveWindowEnabled?: boolean;
  anomalyDetectionEnabled?: boolean;
  quarantineEnabled?: boolean;
  maxACKsPerSecond?: number;
  maxWindowGrowthRate?: number;
  maxSequenceGap?: number;
  suspiciousPatternThreshold?: number;
  quarantineDuration?: number;
}

export interface SecurityRule {
  name: string;
  condition: (req: express.Request) => boolean;
  action: 'block' | 'rate_limit' | 'alert';
  priority: number;
}

export class SecurityMiddleware {
  private defenseSystem: DefenseSystem;
  private config: SecurityConfig;
  private connectionCounts: Map<string, number> = new Map();
  private blocklist: Set<string> = new Set();
  private lastCleanup: number = Date.now();

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableSecurityHeaders: true,
      enableConnectionThrottling: true,
      maxConnectionsPerIP: 50,
      blocklistEnabled: true,
      customRules: [],
      // Defense system defaults
      ackValidationEnabled: true,
      rateLimitingEnabled: true,
      sequenceTrackingEnabled: true,
      adaptiveWindowEnabled: true,
      anomalyDetectionEnabled: true,
      quarantineEnabled: true,
      maxACKsPerSecond: 100,
      maxWindowGrowthRate: 2.0,
      maxSequenceGap: 1048576,
      suspiciousPatternThreshold: 0.7,
      quarantineDuration: 300000,
      ...config
    };

    this.defenseSystem = new DefenseSystem(this.config);
    this.setupDefenseEventHandlers();
    
    console.log('🔐 Security Middleware initialized');
  }

  private setupDefenseEventHandlers(): void {
    this.defenseSystem.on('defenseAction', (action) => {
      if (action.type === 'quarantine' || action.severity === 'critical') {
        const ip = action.connectionId.split(':')[0];
        this.addToBlocklist(ip);
        console.log(`🚫 IP ${ip} added to blocklist due to: ${action.reason}`);
      }
    });
  }

  /**
   * Express middleware for basic request filtering
   */
  public createRequestFilter(): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const clientIP = this.getClientIP(req);
      
      // Periodic cleanup
      this.performPeriodicCleanup();

      // Apply security headers
      if (this.config.enableSecurityHeaders) {
        this.applySecurityHeaders(res);
      }

      // Check blocklist
      if (this.config.blocklistEnabled && this.isBlocked(clientIP)) {
        return this.sendSecurityResponse(res, 403, 'Access denied: IP blocked');
      }

      // Connection throttling
      if (this.config.enableConnectionThrottling) {
        const allowed = this.checkConnectionLimit(clientIP);
        if (!allowed) {
          return this.sendSecurityResponse(res, 429, 'Too many connections from this IP');
        }
      }

      // Apply custom security rules
      const ruleViolation = this.checkCustomRules(req);
      if (ruleViolation) {
        return this.sendSecurityResponse(res, 403, `Security rule violation: ${ruleViolation.name}`);
      }

      // Simulate TCP-level validation (in real implementation, this would be at network layer)
      const tcpValidation = this.simulateTCPValidation(req);
      if (!tcpValidation.allowed) {
        return this.sendSecurityResponse(res, 403, `TCP security violation: ${tcpValidation.reason}`);
      }

      next();
    };
  }

  /**
   * Middleware specifically for file download endpoints (main attack target)
   */
  public createDownloadProtection(): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.log(`🛡️ Security middleware called for ${req.path} from ${req.ip}`);
      const clientIP = this.getClientIP(req);
      const port = this.extractPort(req);

      // Periodic cleanup
      this.performPeriodicCleanup();

      // Apply security headers
      if (this.config.enableSecurityHeaders) {
        this.applySecurityHeaders(res);
      }

      // Check blocklist first
      if (this.config.blocklistEnabled && this.isBlocked(clientIP)) {
        return this.sendSecurityResponse(res, 403, 'Access denied: IP blocked');
      }

      // Connection throttling
      if (this.config.enableConnectionThrottling) {
        const allowed = this.checkConnectionLimit(clientIP);
        if (!allowed) {
          return this.sendSecurityResponse(res, 429, 'Too many connections from this IP');
        }
      }

      // Apply custom security rules (THIS IS THE CRITICAL FIX!)
      const ruleViolation = this.checkCustomRules(req);
      if (ruleViolation) {
        console.log(`🚫 Attack detected! Rule violated: ${ruleViolation.name}`);
        return this.sendSecurityResponse(res, 403, `Security rule violation: ${ruleViolation.name}`);
      }

      // Simulate TCP-level validation (in real implementation, this would be at network layer)
      const tcpValidation = this.simulateTCPValidation(req);
      if (!tcpValidation.allowed) {
        console.log(`🛡️ TCP validation failed for ${clientIP}: ${tcpValidation.reason}`);
        return this.sendSecurityResponse(res, 403, `TCP security violation: ${tcpValidation.reason}`);
      }

      // Enhanced validation for download requests
      const validation = this.defenseSystem.validateConnection(
        clientIP,
        port,
        0, // Sequence number (would be extracted from TCP header in real implementation)
        0, // ACK number (would be extracted from TCP header in real implementation)  
        65536, // Window size (would be extracted from TCP header in real implementation)
        ['ACK'] // TCP flags (would be extracted from TCP header in real implementation)
      );

      if (!validation.allowed && validation.action) {
        console.log(`🛡️ Download blocked for ${clientIP}: ${validation.action.reason}`);
        return this.sendSecurityResponse(res, 403, validation.action.reason);
      }

      // Add response tracking for additional monitoring
      this.trackResponse(res, clientIP);

      console.log(`🔒 Download request from ${clientIP} passed all security validations`);
      next();
    };
  }

  /**
   * Middleware for streaming endpoints
   */
  public createStreamProtection(): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const clientIP = this.getClientIP(req);
      
      // Streaming-specific validations
      const streamValidation = this.validateStreamingRequest(req);
      if (!streamValidation.valid) {
        return this.sendSecurityResponse(res, 400, streamValidation.reason);
      }

      // Rate limiting for stream segments
      const segmentRateLimit = this.checkStreamSegmentRateLimit(clientIP);
      if (!segmentRateLimit.allowed) {
        return this.sendSecurityResponse(res, 429, 'Stream segment rate limit exceeded');
      }

      next();
    };
  }

  private simulateTCPValidation(req: express.Request): { allowed: boolean; reason?: string } {
    const clientIP = this.getClientIP(req);
    const port = this.extractPort(req);
    
    // In a real implementation, these would be extracted from actual TCP headers
    // For simulation, we generate realistic values based on request characteristics
    const fakeSeq = Math.floor(Math.random() * 1000000);
    const fakeAck = Math.floor(Math.random() * 1000000);
    const fakeWindow = 65536;
    
    // Simulate optimistic ACK attack detection
    if (req.headers['x-simulate-attack'] === 'optimistic-ack') {
      // Simulate an optimistic ACK with large advancement
      const maliciousAck = fakeAck + 2000000; // 2MB advance
      
      const validation = this.defenseSystem.validateConnection(
        clientIP, port, fakeSeq, maliciousAck, fakeWindow, ['ACK']
      );
      
      return { 
        allowed: validation.allowed, 
        reason: validation.action?.reason 
      };
    }

    // Normal validation
    const validation = this.defenseSystem.validateConnection(
      clientIP, port, fakeSeq, fakeAck, fakeWindow, ['ACK']
    );

    return { 
      allowed: validation.allowed, 
      reason: validation.action?.reason 
    };
  }

  private validateStreamingRequest(req: express.Request): { valid: boolean; reason: string } {
    const { streamId, segment } = req.params;
    
    // Validate stream ID format
    if (streamId && !/^[a-zA-Z0-9\-_]+$/.test(streamId)) {
      return { valid: false, reason: 'Invalid stream ID format' };
    }

    // Validate segment format (for .ts files)
    if (segment && !/^segment\d+\.ts$|^playlist\.m3u8$/.test(segment)) {
      return { valid: false, reason: 'Invalid segment format' };
    }

    return { valid: true, reason: '' };
  }

  private checkStreamSegmentRateLimit(ip: string): { allowed: boolean } {
    // Implementation would track segment requests per IP
    // For now, return allowed
    return { allowed: true };
  }

  private trackResponse(res: express.Response, clientIP: string): void {
    const originalSend = res.send;
    let bytesTransferred = 0;

    res.send = function(data: any) {
      if (data) {
        bytesTransferred += Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
      }
      return originalSend.call(this, data);
    };

    const originalWrite = res.write;
    res.write = function(chunk: any, encoding?: any) {
      if (chunk) {
        bytesTransferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      }
      return originalWrite.call(this, chunk, encoding);
    };

    res.on('finish', () => {
      if (bytesTransferred > 0) {
        console.log(`📊 Transfer completed for ${clientIP}: ${bytesTransferred} bytes`);
        
        // Check for potential data exfiltration
        if (bytesTransferred > 100 * 1024 * 1024) { // 100MB
          console.log(`⚠️ Large download detected from ${clientIP}: ${bytesTransferred} bytes`);
        }
      }
    });
  }

  private checkConnectionLimit(ip: string): boolean {
    const currentConnections = this.connectionCounts.get(ip) || 0;
    
    if (currentConnections >= this.config.maxConnectionsPerIP) {
      return false;
    }

    this.connectionCounts.set(ip, currentConnections + 1);
    
    // Decrement after a short delay (simulating connection completion)
    setTimeout(() => {
      const count = this.connectionCounts.get(ip) || 0;
      if (count > 0) {
        this.connectionCounts.set(ip, count - 1);
      }
    }, 5000); // 5 second connection window

    return true;
  }

  private checkCustomRules(req: express.Request): SecurityRule | null {
    const sortedRules = this.config.customRules.sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (rule.condition(req)) {
        return rule;
      }
    }
    
    return null;
  }

  private applySecurityHeaders(res: express.Response): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('X-Defense-System', 'active');
  }

  private getClientIP(req: express.Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           '127.0.0.1';
  }

  private extractPort(req: express.Request): number {
    return parseInt(req.headers['x-client-port'] as string) || 
           Math.floor(Math.random() * 30000) + 20000; // Random high port for simulation
  }

  private isBlocked(ip: string): boolean {
    return this.blocklist.has(ip);
  }

  private addToBlocklist(ip: string): void {
    this.blocklist.add(ip);
    
    // Auto-remove from blocklist after 30 minutes
    setTimeout(() => {
      this.blocklist.delete(ip);
      console.log(`✅ IP ${ip} removed from blocklist`);
    }, 30 * 60 * 1000);
  }

  private sendSecurityResponse(res: express.Response, statusCode: number, message: string): void {
    res.status(statusCode).json({
      error: 'Security violation',
      message,
      timestamp: new Date().toISOString(),
      blocked: true
    });
  }

  private performPeriodicCleanup(): void {
    const now = Date.now();
    
    // Cleanup every 5 minutes
    if (now - this.lastCleanup > 300000) {
      this.cleanupConnectionCounts();
      this.lastCleanup = now;
    }
  }

  private cleanupConnectionCounts(): void {
    // Reset connection counts periodically to prevent memory leaks
    this.connectionCounts.clear();
    console.log('🧹 Connection counts cleaned up');
  }

  public addCustomRule(rule: SecurityRule): void {
    this.config.customRules.push(rule);
    console.log(`🔧 Added custom security rule: ${rule.name}`);
  }

  public getSecurityMetrics() {
    const defenseMetrics = this.defenseSystem.getDefenseMetrics();
    
    return {
      ...defenseMetrics,
      activeConnections: this.connectionCounts.size,
      blockedIPs: this.blocklist.size,
      customRules: this.config.customRules.length,
      lastCleanup: this.lastCleanup
    };
  }

  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.defenseSystem.updateConfig(newConfig);
    console.log('🔧 Security configuration updated');
  }

  public destroy(): void {
    this.defenseSystem.destroy();
    this.connectionCounts.clear();
    this.blocklist.clear();
    console.log('🔐 Security Middleware destroyed');
  }
}