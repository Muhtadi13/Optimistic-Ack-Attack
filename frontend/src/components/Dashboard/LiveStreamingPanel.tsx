import { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';

interface LiveStreamingPanelProps {
  isServerRunning: boolean;
}

const LiveStreamingPanel = ({ isServerRunning }: LiveStreamingPanelProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamId, setStreamId] = useState('sample-stream');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const handleStartStream = async () => {
    if (!isServerRunning) {
      alert('Server must be running to start streaming');
      return;
    }

    try {
      setConnectionStatus('connecting');
      const playlistUrl = `http://localhost:3001/stream/${streamId}/playlist.m3u8`;
      setStreamUrl(playlistUrl);

      // Test if the playlist is available
      const response = await fetch(playlistUrl);
      if (response.ok) {
        setIsStreaming(true);
        setConnectionStatus('connected');
        
        if (videoRef.current) {
          const video = videoRef.current;
          
          // Check if the browser supports HLS natively (mainly Safari)
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = playlistUrl;
            await video.play();
          } else if (Hls.isSupported()) {
            // Use hls.js for browsers that don't support HLS natively
            const hls = new Hls({
              enableWorker: false, // Disable for debugging
              debug: true,
            });
            
            hlsRef.current = hls;
            
            hls.loadSource(playlistUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              console.log('HLS manifest parsed, starting playback');
              video.play().catch(console.error);
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error('HLS error:', data);
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('Network error - attempting to recover');
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('Media error - attempting to recover');
                    hls.recoverMediaError();
                    break;
                  default:
                    console.log('Fatal error - destroying HLS instance');
                    setConnectionStatus('error');
                    hls.destroy();
                    break;
                }
              }
            });
          } else {
            console.error('HLS is not supported in this browser');
            setConnectionStatus('error');
            alert('HLS streaming is not supported in this browser. Please try Safari or install a browser with HLS support.');
          }
        }
      } else {
        throw new Error('Playlist not available');
      }
    } catch (error) {
      console.error('Failed to start stream:', error);
      setConnectionStatus('error');
      setIsStreaming(false);
    }
  };

  const handleStopStream = () => {
    setIsStreaming(false);
    setConnectionStatus('idle');
    setStreamUrl('');
    
    // Clean up HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
  };

  const testStreamEndpoint = async () => {
    try {
      const response = await fetch(`http://localhost:3001/stream/${streamId}/playlist.m3u8`);
      const text = await response.text();
      console.log('Playlist response:', text);
      alert(`Playlist response:\n${text}`);
    } catch (error) {
      console.error('Failed to test endpoint:', error);
      alert('Failed to connect to streaming endpoint');
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'connecting': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Idle';
    }
  };

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Live Streaming Test</h3>
        <div className={`status-indicator ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      <div className="space-y-4">
        {/* HLS Support Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${
                Hls.isSupported() || (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) 
                  ? 'bg-green-400' 
                  : 'bg-red-400'
              }`}></div>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                HLS Support: {
                  Hls.isSupported() 
                    ? 'Available (hls.js)' 
                    : videoRef.current?.canPlayType('application/vnd.apple.mpegurl')
                      ? 'Native Support'
                      : 'Not Supported'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Stream Configuration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stream ID
          </label>
          <input
            type="text"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter stream ID"
            disabled={isStreaming}
          />
        </div>

        {/* Stream URL Display */}
        {streamUrl && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stream URL
            </label>
            <div className="p-2 bg-gray-50 rounded border text-sm font-mono break-all">
              {streamUrl}
            </div>
          </div>
        )}

        {/* Video Player */}
        <div className="bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-48 object-contain"
            controls
            muted
            playsInline
          >
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Control Buttons */}
        <div className="flex space-x-2">
          {!isStreaming ? (
            <button
              onClick={handleStartStream}
              disabled={!isServerRunning || (!Hls.isSupported() && !videoRef.current?.canPlayType('application/vnd.apple.mpegurl'))}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200"
            >
              Start Stream
            </button>
          ) : (
            <button
              onClick={handleStopStream}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
            >
              Stop Stream
            </button>
          )}
          
          <button
            onClick={testStreamEndpoint}
            disabled={!isServerRunning}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md transition-colors duration-200"
          >
            Test Endpoint
          </button>
        </div>

        {/* Stream Info */}
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Protocol:</strong> HLS (HTTP Live Streaming)</p>
          <p><strong>Format:</strong> .m3u8 playlist with .ts segments</p>
          <p><strong>Library:</strong> hls.js v{Hls.version || 'Unknown'}</p>
          <p><strong>Server Status:</strong> 
            <span className={isServerRunning ? 'text-green-600' : 'text-red-600'}>
              {isServerRunning ? ' Running' : ' Stopped'}
            </span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Test URLs:</h4>
          <div className="space-y-1 text-xs">
            <a 
              href={`http://localhost:3001/stream/sample-stream/playlist.m3u8`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:text-blue-800 hover:underline"
            >
              Sample Stream Playlist
            </a>
            <a 
              href={`http://localhost:3001/stream/sample-stream/segment000.ts`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:text-blue-800 hover:underline"
            >
              Sample Stream Segment
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStreamingPanel;