module.exports = {
    server: {
      http: {
        port: 8080,
        host: '0.0.0.0',
        maxConnections: 1000,
        timeout: 30000
      },
      rtmp: {
        port: 1935,
        host: '0.0.0.0',
        maxStreams: 50
      },
      websocket: {
        port: 3001,
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      }
    },
    files: {
      uploadPath: './data/files',
      maxFileSize: 1024 * 1024 * 1024, // 1GB
      allowedTypes: ['video/*', 'application/*', 'text/*']
    },
    streaming: {
      segmentDuration: 10, // seconds
      playlistSize: 5, // number of segments in playlist
      videoBitrates: [500000, 1000000, 2000000], // bps
      audioCodec: 'aac',
      videoCodec: 'h264'
    },
    monitoring: {
      interval: 1000, // milliseconds
      retentionPeriod: 3600, // seconds (1 hour)
      alertThresholds: {
        cpuUsage: 80, // percentage
        memoryUsage: 85, // percentage
        connectionRate: 100, // connections per second
        errorRate: 10 // percentage
      }
    }
};