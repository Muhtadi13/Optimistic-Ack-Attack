import { useState, useEffect, useRef } from 'react';
import { useNetworkMonitoring } from '../../hooks/useNetworkMonitoring';

interface NetworkMonitoringPanelProps {
  isServerRunning: boolean;
}

const NetworkMonitoringPanel = ({ isServerRunning }: NetworkMonitoringPanelProps) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentTransferType, setCurrentTransferType] = useState<'download' | 'streaming' | null>(null);
  const [hasStatsToShow, setHasStatsToShow] = useState(false);
  const interceptorActiveRef = useRef(false);

  const {
    downloadMetrics,
    startDownloadMonitoring,
    updateDownloadProgress,
    clearAllMetrics
  } = useNetworkMonitoring();

  // Helper functions
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

  // Clear stats
  const handleClearStats = () => {
    setIsMonitoring(false);
    setCurrentTransferType(null);
    setHasStatsToShow(false);
    if (clearAllMetrics) {
      clearAllMetrics();
    }
  };

  // Auto-detect downloads and streaming
  useEffect(() => {
    if (!isServerRunning || interceptorActiveRef.current) return;

    interceptorActiveRef.current = true;
    
    let totalFileSize = 0;
    let accumulatedDownloaded = 0;

    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      
      // Detect downloads
      if (url.includes('/download/')) {
        const filename = url.split('/download/')[1];
        const isRangeRequest = init?.headers && 
          ((init.headers as Record<string, string>)['Range'] || 
           (init.headers as Headers).get?.('Range'));
        
        // Setup monitoring for first request
        if (!isMonitoring && !hasStatsToShow) {
          setCurrentTransferType('download');
          setIsMonitoring(true);
          setHasStatsToShow(true);
          accumulatedDownloaded = 0;
          
          // Get total file size for chunked downloads
          if (isRangeRequest) {
            try {
              const headResponse = await fetch(url, { method: 'HEAD' });
              if (headResponse.ok) {
                totalFileSize = parseInt(headResponse.headers.get('content-length') || '0');
                startDownloadMonitoring(filename, totalFileSize);
              }
            } catch (error) {
              console.warn('Could not get file size:', error);
            }
          }
        }
        
        const response = await originalFetch(input, init);
        
        if (response.ok && response.body) {
          const contentLength = parseInt(response.headers.get('content-length') || '0');
          
          // For single downloads, use content length as total
          if (!isRangeRequest && totalFileSize === 0) {
            totalFileSize = contentLength;
            startDownloadMonitoring(filename, totalFileSize);
          }
          
          const reader = response.body.getReader();
          const stream = new ReadableStream({
            start(controller) {
              let receivedLength = 0;
              
              const pump = async (): Promise<void> => {
                const { done, value } = await reader.read();
                
                if (done) {
                  controller.close();
                  accumulatedDownloaded += receivedLength;
                  updateDownloadProgress(accumulatedDownloaded);
                  
                  // Check if complete
                  if (accumulatedDownloaded >= totalFileSize * 0.99 || 
                      (!isRangeRequest && receivedLength === contentLength)) {
                    setTimeout(() => setIsMonitoring(false), 500);
                  }
                  return;
                }
                
                receivedLength += value.length;
                updateDownloadProgress(accumulatedDownloaded + receivedLength);
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
      
      // Detect streaming
      if (url.includes('/stream/')) {
        if (!isMonitoring && !hasStatsToShow) {
          setCurrentTransferType('streaming');
          setIsMonitoring(true);
          setHasStatsToShow(true);
        }
      }
      
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
      interceptorActiveRef.current = false;
    };
  }, [isServerRunning, startDownloadMonitoring, updateDownloadProgress, isMonitoring, hasStatsToShow]);

  // Don't show anything if server is not running
  if (!isServerRunning) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Monitor</h3>
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">Start the server to monitor network performance</p>
        </div>
      </div>
    );
  }

  // Don't show anything if no stats
  if (!hasStatsToShow) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Monitor</h3>
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">Start a download or stream to see performance metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Network Monitor</h3>
        <div className="flex items-center space-x-2">
          {isMonitoring && (
            <div className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded flex items-center">
              <span className="animate-pulse mr-1">●</span>
              LIVE
            </div>
          )}
          <button
            onClick={handleClearStats}
            className="text-xs text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Download Progress Bar */}
        {downloadMetrics && currentTransferType === 'download' && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">📥 {downloadMetrics.filename}</span>
              <span className="text-gray-600">
                {formatBytes(downloadMetrics.downloaded)} / {formatBytes(downloadMetrics.size)}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, downloadMetrics.size > 0 ? (downloadMetrics.downloaded / downloadMetrics.size) * 100 : 0)}%` 
                }}
              ></div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {downloadMetrics.size > 0 
                  ? `${Math.min(100, ((downloadMetrics.downloaded / downloadMetrics.size) * 100)).toFixed(1)}%`
                  : '0%'
                } Complete
              </span>
              <span>Speed: {formatSpeed(downloadMetrics.speed)}</span>
            </div>
          </div>
        )}

        {/* Download Speed */}
        {currentTransferType === 'download' && downloadMetrics && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-blue-900">Download Speed</div>
                <div className="text-xs text-blue-700">
                  {isMonitoring ? 'Real-time' : 'Final'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-900">
                  {formatSpeed(downloadMetrics.speed)}
                </div>
                {downloadMetrics.eta > 0 && isMonitoring && (
                  <div className="text-xs text-blue-700">
                    ETA: {downloadMetrics.eta.toFixed(0)}s
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Streaming Speed */}
        {currentTransferType === 'streaming' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-purple-900">Streaming Speed</div>
                <div className="text-xs text-purple-700">
                  {isMonitoring ? 'Live streaming' : 'Stream ended'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-900">
                  {/* This would be calculated based on video segment downloads */}
                  {isMonitoring ? 'Measuring...' : 'Stream Complete'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="text-center">
          <span className={`text-xs px-3 py-1 rounded-full ${
            isMonitoring 
              ? 'bg-green-100 text-green-700' 
              : 'bg-blue-100 text-blue-700'
          }`}>
            {isMonitoring 
              ? `${currentTransferType === 'download' ? 'Downloading' : 'Streaming'}...` 
              : `${currentTransferType === 'download' ? 'Download' : 'Stream'} Complete`
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default NetworkMonitoringPanel;