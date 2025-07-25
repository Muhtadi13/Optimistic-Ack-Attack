import { useState, useEffect, useRef } from 'react';
import { useNetworkMonitoring } from '../../hooks/useNetworkMonitoring';

interface NetworkMonitoringPanelProps {
  isServerRunning: boolean;
}

const NetworkMonitoringPanel = ({ isServerRunning }: NetworkMonitoringPanelProps) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [optimisticAckEnabled, setOptimisticAckEnabled] = useState(false);
  const [testInProgress, setTestInProgress] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    networkMetrics,
    streamingMetrics,
    downloadMetrics,
    optimisticAckMetrics,
    measureLatency,
    monitoredFetch,
    updateStreamingMetrics,
    simulateOptimisticAck,
    startDownloadMonitoring,
    updateDownloadProgress
  } = useNetworkMonitoring();

  useEffect(() => {
    let interval: number;
    
    if (isMonitoring) {
      interval = setInterval(() => {
        measureLatency();
        if (videoRef.current) {
          updateStreamingMetrics(videoRef.current);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring, measureLatency, updateStreamingMetrics]);

  useEffect(() => {
    simulateOptimisticAck(optimisticAckEnabled);
  }, [optimisticAckEnabled, simulateOptimisticAck]);

  const startMonitoring = () => {
    setIsMonitoring(true);
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
  };

  const testDownloadSpeed = async () => {
    if (!isServerRunning) {
      alert('Server must be running to test download speed');
      return;
    }

    setTestInProgress('download');
    try {
      const testFile = 'large-file.bin'; // 5MB test file
      const startTime = performance.now();
      
      const response = await monitoredFetch(`http://localhost:3001/download/${testFile}`);
      
      if (response.ok) {
        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000;
        const size = parseInt(response.headers.get('content-length') || '0');
        const speed = size / duration;
        
        console.log(`Download test completed: ${(speed / 1024 / 1024).toFixed(2)} MB/s`);
      }
    } catch (error) {
      console.error('Download speed test failed:', error);
    } finally {
      setTestInProgress(null);
    }
  };

  const testStreamingPerformance = async () => {
    if (!isServerRunning) {
      alert('Server must be running to test streaming');
      return;
    }

    setTestInProgress('streaming');
    try {
      const startTime = performance.now();
      const response = await fetch('http://localhost:3001/stream/sample-stream/playlist.m3u8');
      
      if (response.ok) {
        const endTime = performance.now();
        const latency = endTime - startTime;
        console.log(`Playlist fetch latency: ${latency.toFixed(2)}ms`);
        
        // Test segment download
        const segmentResponse = await monitoredFetch('http://localhost:3001/stream/sample-stream/segment000.ts');
        if (segmentResponse.ok) {
          console.log('Segment download completed');
        }
      }
    } catch (error) {
      console.error('Streaming test failed:', error);
    } finally {
      setTestInProgress(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'fair': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Network Performance Monitor</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className={`px-3 py-1 rounded text-xs font-medium ${
              isMonitoring 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {isMonitoring ? 'Stop' : 'Start'} Monitoring
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Network Metrics */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Network Metrics</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500">Download Speed</div>
              <div className="font-semibold">
                {networkMetrics ? formatSpeed(networkMetrics.downloadSpeed) : 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500">Upload Speed</div>
              <div className="font-semibold">
                {networkMetrics ? formatSpeed(networkMetrics.uploadSpeed) : 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500">Latency</div>
              <div className="font-semibold">
                {networkMetrics ? `${networkMetrics.latency.toFixed(1)}ms` : 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500">Quality</div>
              <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                networkMetrics ? getQualityColor(networkMetrics.connectionQuality) : 'text-gray-600 bg-gray-100'
              }`}>
                {networkMetrics?.connectionQuality.toUpperCase() || 'UNKNOWN'}
              </div>
            </div>
          </div>
        </div>

        {/* Download Metrics */}
        {downloadMetrics && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Current Download</h4>
            <div className="bg-blue-50 p-3 rounded">
              <div className="flex justify-between text-xs mb-2">
                <span>{downloadMetrics.filename}</span>
                <span>{formatBytes(downloadMetrics.downloaded)} / {formatBytes(downloadMetrics.size)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(downloadMetrics.downloaded / downloadMetrics.size) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Speed: {formatSpeed(downloadMetrics.speed)}</span>
                <span>ETA: {downloadMetrics.eta > 0 ? `${downloadMetrics.eta.toFixed(0)}s` : 'Complete'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Optimistic ACK Metrics */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Optimistic ACK Analysis</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Optimistic ACK</span>
              <button
                onClick={() => setOptimisticAckEnabled(!optimisticAckEnabled)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  optimisticAckEnabled 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {optimisticAckEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            
            {optimisticAckMetrics && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-500">Normal Speed</div>
                  <div className="font-semibold">
                    {formatSpeed(optimisticAckMetrics.normalDownloadSpeed)}
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-500">Optimistic Speed</div>
                  <div className="font-semibold">
                    {formatSpeed(optimisticAckMetrics.optimisticDownloadSpeed)}
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-500">Improvement</div>
                  <div className={`font-semibold ${
                    optimisticAckMetrics.speedImprovement > 0 ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    +{optimisticAckMetrics.speedImprovement}%
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-500">Window Size</div>
                  <div className="font-semibold">
                    {formatBytes(optimisticAckMetrics.tcpWindowSize)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Performance Tests */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Performance Tests</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={testDownloadSpeed}
              disabled={!isServerRunning || testInProgress === 'download'}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded text-xs transition-colors duration-200"
            >
              {testInProgress === 'download' ? 'Testing...' : 'Test Download'}
            </button>
            <button
              onClick={testStreamingPerformance}
              disabled={!isServerRunning || testInProgress === 'streaming'}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-3 py-2 rounded text-xs transition-colors duration-200"
            >
              {testInProgress === 'streaming' ? 'Testing...' : 'Test Streaming'}
            </button>
          </div>
        </div>

        {/* Real-time Graph Placeholder */}
        {isMonitoring && networkMetrics && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Real-time Performance</h4>
            <div className="bg-gray-100 h-24 rounded flex items-center justify-center text-xs text-gray-500">
              <div className="text-center">
                <div>Current: {formatSpeed(networkMetrics.downloadSpeed)}</div>
                <div>Peak: {formatSpeed(networkMetrics.bandwidth.peak)}</div>
                <div>Avg: {formatSpeed(networkMetrics.bandwidth.average)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="text-xs text-gray-500 border-t pt-3">
          <p><strong>Monitoring:</strong> {isMonitoring ? 'Active' : 'Inactive'}</p>
          <p><strong>Server:</strong> {isServerRunning ? 'Running' : 'Stopped'}</p>
          <p><strong>Last Update:</strong> {networkMetrics ? new Date(networkMetrics.timestamp).toLocaleTimeString() : 'Never'}</p>
        </div>
      </div>
    </div>
  );
};

export default NetworkMonitoringPanel;