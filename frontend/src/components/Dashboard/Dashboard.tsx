import { useState, useEffect } from 'react';
import MetricsPanel from './MetricsPanel';
import StreamingPanel from './StreamingPanel';
import AttackPanel from './AttackPanel';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { ServerMetrics } from '../../types/monitoring';

const Dashboard = () => {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const { socket, isConnected } = useWebSocket('ws://localhost:3001');

  useEffect(() => {
    if (socket) {
      socket.on('metrics-update', (data: ServerMetrics) => {
        setMetrics(data);
      });

      socket.on('server-status', (status: boolean) => {
        setIsServerRunning(status);
      });
    }
  }, [socket]);

  const handleStartServer = async () => {
    try {
      const response = await fetch('/api/server/start', { method: 'POST' });
      if (response.ok) {
        setIsServerRunning(true);
      }
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  };

  const handleStopServer = async () => {
    try {
      const response = await fetch('/api/server/stop', { method: 'POST' });
      if (response.ok) {
        setIsServerRunning(false);
      }
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                TCP Attack Analysis Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitor and analyze Optimistic ACK attacks in real-time
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={isServerRunning ? handleStopServer : handleStartServer}
                className={`px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                  isServerRunning 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isServerRunning ? 'Stop Server' : 'Start Server'}
              </button>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
                <span className={`text-sm font-medium ${
                  isConnected ? 'text-green-700' : 'text-red-700'
                }`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <MetricsPanel metrics={metrics} />
          </div>
          <div className="space-y-8">
            <StreamingPanel isServerRunning={isServerRunning} />
            <AttackPanel isServerRunning={isServerRunning} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;