import { useState, useEffect, useRef } from 'react';
import { useNetworkMonitoring } from '../../hooks/useNetworkMonitoring';

interface NetworkMonitoringPanelProps {
  isServerRunning: boolean;
}

const NetworkMonitoringPanel = ({ isServerRunning }: NetworkMonitoringPanelProps) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [optimisticAckEnabled, setOptimisticAckEnabled] = useState(false);
  const [currentTransferType, setCurrentTransferType] = useState<'download' | 'streaming' | null>(null);
  const [transferStartTime, setTransferStartTime] = useState<number>(0);
  const [transferEndTime, setTransferEndTime] = useState<number>(0);
  const [isTransferComplete, setIsTransferComplete] = useState(false);
  const [hasStatsToShow, setHasStatsToShow] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const interceptorActiveRef = useRef(false);

  const {
    networkMetrics,
    streamingMetrics,
    downloadMetrics,
    optimisticAckMetrics,
    measureLatency,
    updateStreamingMetrics,
    simulateOptimisticAck,
    startDownloadMonitoring,
    updateDownloadProgress,
    clearAllMetrics
  } = useNetworkMonitoring();

  // Auto-detect and intercept network requests
  useEffect(() => {
    if (!isServerRunning || interceptorActiveRef.current) return;

    interceptorActiveRef.current = true;

    // Intercept fetch requests to detect downloads/streaming
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      
      // Check if it's a download request
      if (url.includes('/download/')) {
        const filename = url.split('/download/')[1];
        console.log('🔍 Download detected:', filename);
        setCurrentTransferType('download');
        setTransferStartTime(Date.now());
        setIsMonitoring(true);
        setIsTransferComplete(false);
        setHasStatsToShow(true);
        
        // Start monitoring this download
        const response = await originalFetch(input, init);
        
        if (response.ok && response.body) {
          const contentLength = parseInt(response.headers.get('content-length') || '0');
          startDownloadMonitoring(filename, contentLength);
          
          // Create a new response with progress tracking
          const reader = response.body.getReader();
          const stream = new ReadableStream({
            start(controller) {
              let receivedLength = 0;
              
              const pump = async (): Promise<void> => {
                const { done, value } = await reader.read();
                
                if (done) {
                  controller.close();
                  // Download completed - but keep showing stats
                  setTransferEndTime(Date.now());
                  setIsTransferComplete(true);
                  setIsMonitoring(false); // Stop live monitoring but keep stats visible
                  return;
                }
                
                receivedLength += value.length;
                updateDownloadProgress(receivedLength);
                controller.enqueue(value);
                
                return pump();
              };
              
              return pump();
            }
          });
          
          return new Response(stream, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }
        
        return response;
      }
      
      // Check if it's a streaming request (playlist or segments)
      if (url.includes('/stream/')) {
        if (url.includes('playlist.m3u8')) {
          console.log('🔍 HLS playlist request detected');
          setCurrentTransferType('streaming');
          setTransferStartTime(Date.now());
          setIsMonitoring(true);
          setIsTransferComplete(false);
          setHasStatsToShow(true);
        } else if (url.includes('.ts')) {
          console.log('🔍 HLS segment request detected:', url.split('/').pop());
          // Update streaming metrics for segment downloads
        }
      }
      
      return originalFetch(input, init);
    };

    // Monitor video elements for streaming
    const monitorVideoElements = () => {
      const videos = document.querySelectorAll('video');
      videos.forEach((video) => {
        if (!video.dataset.monitored) {
          video.dataset.monitored = 'true';
          
          video.addEventListener('loadstart', () => {
            console.log('📺 Video loading started');
            if (video.src.includes('localhost:3001/stream/')) {
              setCurrentTransferType('streaming');
              setTransferStartTime(Date.now());
              setIsMonitoring(true);
              setIsTransferComplete(false);
              setHasStatsToShow(true);
            }
          });
          
          video.addEventListener('ended', () => {
            console.log('📺 Video playback ended');
            setTransferEndTime(Date.now());
            setIsTransferComplete(true);
            setIsMonitoring(false); // Stop live monitoring but keep stats visible
          });
          
          video.addEventListener('error', () => {
            console.log('📺 Video error occurred');
            setTransferEndTime(Date.now());
            setIsTransferComplete(true);
            setIsMonitoring(false);
          });
        }
      });
    };

    // Monitor for new video elements
    const observer = new MutationObserver(() => {
      monitorVideoElements();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Initial scan
    monitorVideoElements();

    // Cleanup
    return () => {
      window.fetch = originalFetch;
      observer.disconnect();
      interceptorActiveRef.current = false;
    };
  }, [isServerRunning, startDownloadMonitoring, updateDownloadProgress]);

  // Monitor streaming metrics when video is playing
  useEffect(() => {
    let interval: number;
    
    if (isMonitoring && currentTransferType === 'streaming') {
      interval = setInterval(() => {
        const video = document.querySelector('video[src*="localhost:3001"]') as HTMLVideoElement;
        if (video) {
          updateStreamingMetrics(video);
        }
        measureLatency();
      }, 1000);
    } else if (isMonitoring && currentTransferType === 'download') {
      interval = setInterval(() => {
        measureLatency();
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring, currentTransferType, measureLatency, updateStreamingMetrics]);

  // Update optimistic ACK simulation
  useEffect(() => {
    simulateOptimisticAck(optimisticAckEnabled && isMonitoring);
  }, [optimisticAckEnabled, isMonitoring, simulateOptimisticAck]);

  // Clear all stats function
  const handleClearStats = () => {
    setIsMonitoring(false);
    setCurrentTransferType(null);
    setTransferStartTime(0);
    setTransferEndTime(0);
    setIsTransferComplete(false);
    setHasStatsToShow(false);
    setOptimisticAckEnabled(false);
    
    // Clear metrics from the hook
    if (clearAllMetrics) {
      clearAllMetrics();
    }
    
    console.log('📊 Stats cleared manually');
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

  const getTransferIcon = () => {
    switch (currentTransferType) {
      case 'download': return '📥';
      case 'streaming': return '📺';
      default: return '📊';
    }
  };

  const getTransferLabel = () => {
    switch (currentTransferType) {
      case 'download': return 'FILE DOWNLOAD';
      case 'streaming': return 'VIDEO STREAMING';
      default: return 'MONITORING';
    }
  };

  const formatDuration = (startTime: number, endTime?: number): string => {
    const duration = (endTime || Date.now()) - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusInfo = () => {
    if (isMonitoring) {
      return {
        text: `${getTransferLabel()} Active`,
        color: 'text-green-700 bg-green-100',
        icon: '●',
        animate: true
      };
    } else if (isTransferComplete) {
      return {
        text: `${getTransferLabel()} Complete`,
        color: 'text-blue-700 bg-blue-100',
        icon: '✓',
        animate: false
      };
    }
    return {
      text: 'Waiting for Transfer',
      color: 'text-gray-500 bg-gray-100',
      icon: '⏳',
      animate: false
    };
  };

  // Don't render if server is not running
  if (!isServerRunning) {
    return (
      <div className="metric-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Network Performance Monitor</h3>
          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Server Offline
          </div>
        </div>
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">Start the server to enable network monitoring</p>
          <p className="text-xs mt-2">Monitoring will begin automatically when you download files or stream content</p>
        </div>
      </div>
    );
  }

  // Show minimal state when no stats to show
  if (!hasStatsToShow) {
    return (
      <div className="metric-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Network Performance Monitor</h3>
          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Waiting for Transfer
          </div>
        </div>
        <div className="text-center py-6 text-gray-500">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-sm">Start a download or stream to see live network metrics</p>
          <div className="mt-4 flex items-center justify-center space-x-2">
            <span className="text-xs">Optimistic ACK:</span>
            <button
              onClick={() => setOptimisticAckEnabled(!optimisticAckEnabled)}
              className={`px-2 py-1 rounded text-xs font-medium ${
                optimisticAckEnabled 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {optimisticAckEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo();

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Network Performance Monitor</h3>
        <div className="flex items-center space-x-2">
          <div className={`text-xs font-medium px-2 py-1 rounded flex items-center ${statusInfo.color}`}>
            <span className={`mr-1 ${statusInfo.animate ? 'animate-pulse' : ''}`}>{statusInfo.icon}</span>
            {isMonitoring ? 'LIVE' : statusInfo.text}
          </div>
          {hasStatsToShow && (
            <button
              onClick={handleClearStats}
              className="text-xs text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors"
              title="Clear all statistics"
            >
              Clear Stats
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Current Transfer Status */}
        <div className={`border rounded-lg p-3 ${
          isTransferComplete ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{getTransferIcon()}</span>
              <div>
                <div className={`text-sm font-medium ${
                  isTransferComplete ? 'text-blue-900' : 'text-green-900'
                }`}>
                  {getTransferLabel()} {isTransferComplete ? '- COMPLETED' : '- ACTIVE'}
                </div>
                <div className={`text-xs ${
                  isTransferComplete ? 'text-blue-700' : 'text-green-700'
                }`}>
                  {isTransferComplete 
                    ? `Completed in: ${formatDuration(transferStartTime, transferEndTime)}`
                    : `Duration: ${formatDuration(transferStartTime)}`
                  }
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setOptimisticAckEnabled(!optimisticAckEnabled)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  optimisticAckEnabled 
                    ? 'bg-green-100 text-green-700 border border-green-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300'
                }`}
                disabled={isTransferComplete} // Disable after completion
              >
                ACK: {optimisticAckEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Network Metrics */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            {isMonitoring ? 'Real-time Network Metrics' : 'Final Network Metrics'}
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500">Download Speed</div>
              <div className="font-semibold">
                {networkMetrics ? formatSpeed(networkMetrics.downloadSpeed) : 'No data'}
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500">Latency</div>
              <div className="font-semibold">
                {networkMetrics ? `${networkMetrics.latency.toFixed(1)}ms` : 'No data'}
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500">Connection Quality</div>
              <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                networkMetrics ? getQualityColor(networkMetrics.connectionQuality) : 'text-gray-600 bg-gray-100'
              }`}>
                {networkMetrics?.connectionQuality.toUpperCase() || 'NO DATA'}
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500">Peak Speed</div>
              <div className="font-semibold">
                {networkMetrics ? formatSpeed(networkMetrics.bandwidth.peak) : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Download Progress (for file downloads) */}
        {downloadMetrics && currentTransferType === 'download' && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Download {isTransferComplete ? 'Summary' : 'Progress'}
            </h4>
            <div className={`p-3 rounded ${
              isTransferComplete ? 'bg-blue-50' : 'bg-green-50'
            }`}>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium">{downloadMetrics.filename}</span>
                <span>{formatBytes(downloadMetrics.downloaded)} / {formatBytes(downloadMetrics.size)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isTransferComplete ? 'bg-blue-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${(downloadMetrics.downloaded / downloadMetrics.size) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Speed: {formatSpeed(downloadMetrics.speed)}</span>
                <span>
                  {isTransferComplete 
                    ? '✓ Complete' 
                    : downloadMetrics.eta > 0 
                      ? `ETA: ${downloadMetrics.eta.toFixed(0)}s` 
                      : 'Calculating...'
                  }
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Streaming Metrics (for video streaming) */}
        {streamingMetrics && currentTransferType === 'streaming' && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Streaming {isTransferComplete ? 'Summary' : 'Performance'}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Buffer Health</div>
                <div className="font-semibold">
                  {streamingMetrics.bufferHealth.toFixed(1)}s
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Dropped Frames</div>
                <div className="font-semibold">
                  {streamingMetrics.droppedFrames}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Resolution</div>
                <div className="font-semibold">
                  {streamingMetrics.resolution}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Rebuffering</div>
                <div className="font-semibold">
                  {streamingMetrics.rebufferingEvents}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Optimistic ACK Analysis */}
        {optimisticAckMetrics && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Optimistic ACK Impact
              {optimisticAckEnabled && !isTransferComplete && <span className="text-green-600 ml-2">🔥 ACTIVE</span>}
              {isTransferComplete && <span className="text-blue-600 ml-2">📊 FINAL</span>}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Normal Speed</div>
                <div className="font-semibold">
                  {formatSpeed(optimisticAckMetrics.normalDownloadSpeed)}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Optimized Speed</div>
                <div className="font-semibold text-green-600">
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
                <div className="text-gray-500">TCP Window</div>
                <div className="font-semibold">
                  {formatBytes(optimisticAckMetrics.tcpWindowSize)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Performance Graph */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            {isMonitoring ? 'Real-time Performance' : 'Final Performance'}
          </h4>
          <div className={`h-20 rounded flex items-center justify-center text-xs text-gray-600 ${
            isTransferComplete 
              ? 'bg-gradient-to-r from-blue-100 to-blue-200' 
              : 'bg-gradient-to-r from-blue-100 to-green-100'
          }`}>
            <div className="text-center">
              <div className="font-semibold text-lg">
                {networkMetrics ? formatSpeed(networkMetrics.downloadSpeed) : '---'}
              </div>
              <div>{isTransferComplete ? 'Final Transfer Rate' : 'Current Transfer Rate'}</div>
              {optimisticAckEnabled && !isTransferComplete && (
                <div className="text-green-600 font-medium">⚡ Optimistic ACK Active</div>
              )}
              {isTransferComplete && (
                <div className="text-blue-600 font-medium">✓ Transfer Complete</div>
              )}
            </div>
          </div>
        </div>

        {/* Status Footer */}
        <div className="text-xs text-gray-500 border-t pt-3 space-y-1">
          <div className="flex justify-between">
            <span><strong>Status:</strong> {statusInfo.text}</span>
            <span><strong>Duration:</strong> {
              isTransferComplete 
                ? formatDuration(transferStartTime, transferEndTime)
                : formatDuration(transferStartTime)
            }</span>
          </div>
          <div className="flex justify-between">
            <span><strong>Server:</strong> {isServerRunning ? 'Running' : 'Stopped'}</span>
            <span><strong>Last Update:</strong> {
              networkMetrics 
                ? new Date(networkMetrics.timestamp).toLocaleTimeString() 
                : 'Never'
            }</span>
          </div>
          {isTransferComplete && (
            <div className="text-center pt-2">
              <span className="text-blue-600 font-medium">
                📊 Statistics preserved - Click "Clear Stats" to reset
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkMonitoringPanel;