import React, { useState } from 'react';
import { PlayIcon, StopIcon, CogIcon } from '@heroicons/react/24/outline';

interface AttackPanelProps {
  isServerRunning: boolean;
}

function AttackPanel<AttackPanelProps>({ isServerRunning }){
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackConfig, setAttackConfig] = useState({
    duration: 60,
    ackAdvanceSize: 1048576, // 1MB
    packetInterval: 100,
    targetPort: 8080
  });

  const handleStartAttack = async () => {
    if (!isServerRunning) {
      alert('Please start the server first');
      return;
    }

    try {
      const response = await fetch('/api/attack/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attackConfig)
      });

      if (response.ok) {
        setIsAttacking(true);
      } else {
        const error = await response.text();
        alert(`Failed to start attack: ${error}`);
      }
    } catch (error) {
      console.error('Attack start failed:', error);
    }
  };

  const handleStopAttack = async () => {
    try {
      const response = await fetch('/api/attack/stop', { method: 'POST' });
      if (response.ok) {
        setIsAttacking(false);
      }
    } catch (error) {
      console.error('Attack stop failed:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <CogIcon className="h-5 w-5 mr-2 text-gray-400" />
          Attack Configuration
        </h2>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (seconds)
            </label>
            <input
              type="number"
              value={attackConfig.duration}
              onChange={(e) => setAttackConfig({
                ...attackConfig,
                duration: parseInt(e.target.value)
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isAttacking}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Port
            </label>
            <input
              type="number"
              value={attackConfig.targetPort}
              onChange={(e) => setAttackConfig({
                ...attackConfig,
                targetPort: parseInt(e.target.value)
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isAttacking}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ACK Advance Size (bytes)
          </label>
          <input
            type="number"
            value={attackConfig.ackAdvanceSize}
            onChange={(e) => setAttackConfig({
              ...attackConfig,
              ackAdvanceSize: parseInt(e.target.value)
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isAttacking}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Packet Interval (ms)
          </label>
          <input
            type="number"
            value={attackConfig.packetInterval}
            onChange={(e) => setAttackConfig({
              ...attackConfig,
              packetInterval: parseInt(e.target.value)
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isAttacking}
          />
        </div>

        <div className="pt-4 border-t border-gray-200">
          {!isAttacking ? (
            <button
              onClick={handleStartAttack}
              disabled={!isServerRunning}
              className={`w-full flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                isServerRunning
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <PlayIcon className="h-5 w-5 mr-2" />
              Start Optimistic ACK Attack
            </button>
          ) : (
            <button
              onClick={handleStopAttack}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors duration-200"
            >
              <StopIcon className="h-5 w-5 mr-2" />
              Stop Attack
            </button>
          )}
        </div>

        {!isServerRunning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              Server must be running to start an attack
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttackPanel;