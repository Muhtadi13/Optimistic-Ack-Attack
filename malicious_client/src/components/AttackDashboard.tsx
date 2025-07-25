import React, { useState, useEffect, useRef } from 'react';
import { BrowserAttackSimulator } from '../BrowserAttackSimulator';
import { BrowserNetworkMonitor, NetworkMetrics } from '../BrowserNetworkMonitor';
import { AttackConfig, AttackMetrics } from '../types/AttackTypes';

const AttackDashboard: React.FC = () => {
  const [config, setConfig] = useState<AttackConfig>({
    targetHost: '127.0.0.1',
    targetPort: 3001,
    attackDuration: 30,
    packetInterval: 100,
    ackAdvanceSize: 1460,
    windowScale: 1.5
  });

  const [isAttackRunning, setIsAttackRunning] = useState(false);
  const [attackMetrics, setAttackMetrics] = useState<AttackMetrics | null>(null);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics>({
    downloadSpeed: 0,
    uploadSpeed: 0,
    latency: 0,
    bandwidth: 0,
    packetsPerSecond: 0
  });
  const [logs, setLogs] = useState<string[]>(['[SYSTEM] Attack tool initialized']);

  const attackerRef = useRef<BrowserAttackSimulator | null>(null);
  const networkMonitorRef = useRef<BrowserNetworkMonitor | null>(null);
  const metricsInterval = useRef<number | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize network monitor
    networkMonitorRef.current = new BrowserNetworkMonitor();
    
    // Add initial log
    addLog('[SYSTEM] Network monitor initialized');
    
    return () => {
      // Cleanup on unmount
      if (attackerRef.current) {
        attackerRef.current.stopAttack();
      }
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current);
      }
      if (networkMonitorRef.current) {
        networkMonitorRef.current.stop();
      }
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-20), logEntry]); // Keep last 20 logs
  };

  useEffect(() => {
    // Auto-scroll logs to bottom
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const startAttack = async () => {
    try {
      addLog(`[ATTACK] Initializing attack against ${config.targetHost}:${config.targetPort}`);
      
      attackerRef.current = new BrowserAttackSimulator(config);
      setIsAttackRunning(true);

      // Start metrics collection
      metricsInterval.current = window.setInterval(() => {
        if (attackerRef.current) {
          const newMetrics = attackerRef.current.getMetrics();
          setAttackMetrics(newMetrics);
          
          // Add periodic status logs
          if (newMetrics.packetsPressed > 0 && newMetrics.packetsPressed % 100 === 0) {
            addLog(`[STATUS] ${newMetrics.packetsPressed} packets sent, ${formatBytes(newMetrics.totalDataTransferred)} transferred`);
          }
        }
        if (networkMonitorRef.current) {
          setNetworkMetrics(networkMonitorRef.current.getMetrics());
        }
      }, 1000);

      addLog('[ATTACK] Starting optimistic ACK attack...');
      await attackerRef.current.executeAttack();
      
      setIsAttackRunning(false);
      addLog('[ATTACK] Attack completed successfully');
      
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current);
      }
    } catch (error) {
      console.error('Attack failed:', error);
      setIsAttackRunning(false);
      addLog(`[ERROR] Attack failed: ${error}`);
      alert(`Attack failed: ${error}`);
    }
  };

  const stopAttack = () => {
    if (attackerRef.current) {
      attackerRef.current.stopAttack();
      setIsAttackRunning(false);
      addLog('[ATTACK] Attack stopped by user');
    }
    if (metricsInterval.current) {
      clearInterval(metricsInterval.current);
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-red-400">
          🔥 Optimistic ACK Attack Tool (Browser Demo)
        </h1>

        {/* Attack Configuration */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-green-400">Attack Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Target Host</label>
              <input
                type="text"
                value={config.targetHost}
                onChange={(e) => setConfig({...config, targetHost: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-red-400 focus:outline-none"
                disabled={isAttackRunning}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Target Port</label>
              <input
                type="number"
                value={config.targetPort}
                onChange={(e) => setConfig({...config, targetPort: parseInt(e.target.value) || 0})}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-red-400 focus:outline-none"
                disabled={isAttackRunning}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Duration (seconds)</label>
              <input
                type="number"
                value={config.attackDuration}
                onChange={(e) => setConfig({...config, attackDuration: parseInt(e.target.value) || 0})}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-red-400 focus:outline-none"
                disabled={isAttackRunning}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Packet Interval (ms)</label>
              <input
                type="number"
                value={config.packetInterval}
                onChange={(e) => setConfig({...config, packetInterval: parseInt(e.target.value) || 0})}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-red-400 focus:outline-none"
                disabled={isAttackRunning}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">ACK Advance Size</label>
              <input
                type="number"
                value={config.ackAdvanceSize}
                onChange={(e) => setConfig({...config, ackAdvanceSize: parseInt(e.target.value) || 0})}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-red-400 focus:outline-none"
                disabled={isAttackRunning}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Window Scale</label>
              <input
                type="number"
                step="0.1"
                value={config.windowScale}
                onChange={(e) => setConfig({...config, windowScale: parseFloat(e.target.value) || 0})}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-red-400 focus:outline-none"
                disabled={isAttackRunning}
              />
            </div>
          </div>
        </div>

        {/* Attack Control */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-green-400">Attack Control</h2>
            <div className="flex space-x-4">
              {!isAttackRunning ? (
                <button
                  onClick={startAttack}
                  className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  🚀 Start Attack (Simulated)
                </button>
              ) : (
                <button
                  onClick={stopAttack}
                  className="bg-yellow-600 hover:bg-yellow-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  ⏹️ Stop Attack
                </button>
              )}
            </div>
          </div>
          
          <div className="mt-4 flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${isAttackRunning ? 'bg-red-400 animate-pulse' : 'bg-gray-600'}`}></div>
            <span className="text-sm">
              Status: {isAttackRunning ? 'ATTACK IN PROGRESS (SIMULATION)' : 'IDLE'}
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attack Metrics */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-yellow-400">Attack Metrics</h3>
            {attackMetrics ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Packets Sent:</span>
                  <span className="font-mono text-green-400">{attackMetrics.packetsPressed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Successful ACKs:</span>
                  <span className="font-mono text-green-400">{attackMetrics.successfulAcks.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-mono text-blue-400">
                    {attackMetrics.packetsPressed > 0 ? ((attackMetrics.successfulAcks / attackMetrics.packetsPressed) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Connection Status:</span>
                  <span className={`font-mono ${attackMetrics.connectionEstablished ? 'text-green-400' : 'text-red-400'}`}>
                    {attackMetrics.connectionEstablished ? 'ESTABLISHED' : 'DISCONNECTED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Current Speed:</span>
                  <span className="font-mono text-blue-400">{formatSpeed(attackMetrics.currentSpeed)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Data Transferred:</span>
                  <span className="font-mono text-purple-400">{formatBytes(attackMetrics.totalDataTransferred)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Elapsed Time:</span>
                  <span className="font-mono text-gray-300">
                    {((Date.now() - attackMetrics.attackStartTime) / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">No attack data available</div>
            )}
          </div>

          {/* Network Performance */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-blue-400">Network Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Download Speed:</span>
                <span className="font-mono text-green-400">{formatSpeed(networkMetrics.downloadSpeed)}</span>
              </div>
              <div className="flex justify-between">
                <span>Upload Speed:</span>
                <span className="font-mono text-yellow-400">{formatSpeed(networkMetrics.uploadSpeed)}</span>
              </div>
              <div className="flex justify-between">
                <span>Latency:</span>
                <span className="font-mono text-red-400">{networkMetrics.latency.toFixed(1)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Bandwidth Usage:</span>
                <span className="font-mono text-purple-400">{formatSpeed(networkMetrics.bandwidth)}</span>
              </div>
              <div className="flex justify-between">
                <span>Packets/sec:</span>
                <span className="font-mono text-cyan-400">{networkMetrics.packetsPerSecond.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attack Visualization */}
        <div className="bg-gray-800 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4 text-red-400">Attack Log</h3>
          <div className="bg-black rounded p-4 font-mono text-sm">
            <div className="text-green-400 mb-2">TCP Optimistic ACK Attack Log:</div>
            <div 
              ref={logsRef}
              className="h-32 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-600"
            >
              {logs.map((log, index) => (
                <div key={index} className="text-gray-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notice about simulation */}
        <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mt-6">
          <div className="flex items-center">
            <div className="text-blue-400 text-xl mr-3">ℹ️</div>
            <div>
              <h4 className="font-semibold text-blue-300">Browser Simulation Mode</h4>
              <p className="text-blue-200 text-sm mt-1">
                This UI runs a simulation of the attack. For real attacks, use the CLI version with "npm run dev:cli".
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mt-6">
          <div className="flex items-center">
            <div className="text-red-400 text-xl mr-3">⚠️</div>
            <div>
              <h4 className="font-semibold text-red-300">Educational Purpose Only</h4>
              <p className="text-red-200 text-sm mt-1">
                This tool is for educational and research purposes only. Do not use against systems you do not own or have explicit permission to test.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttackDashboard;