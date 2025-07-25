import { useState } from 'react';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';

interface StreamingPanelProps {
  isServerRunning: boolean;
}

function StreamingPanel({ isServerRunning }: StreamingPanelProps) {
  const [selectedFile, setSelectedFile] = useState('medium_file.bin');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const testFiles = [
    { name: 'small-file.txt', size: '10 MB', description: 'Small test file' },
    { name: 'sample-document.txt', size: '100 MB', description: 'Medium test file' },
    { name: 'large-file.bin', size: '500 MB', description: 'Large test file' }
  ];

  const handleDownload = async () => {
    if (!isServerRunning) {
      alert('Server must be running to download files');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const response = await fetch(`http://localhost:3001/download/${selectedFile}`);
      if (!response.ok) throw new Error('Download failed');

      const reader = response.body?.getReader();
      const contentLength = parseInt(response.headers.get('Content-Length') || '0');
      let receivedLength = 0;

      if (reader) {
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          receivedLength += value.length;
          setDownloadProgress((receivedLength / contentLength) * 100);
        }

        // Create blob and download
        const blob = new Blob(chunks);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <DocumentArrowDownIcon className="h-5 w-5 mr-2 text-gray-400" />
          File Download Testing
        </h2>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Test File
          </label>
          <div className="space-y-2">
            {testFiles.map((file) => (
              <label key={file.name} className="flex items-center">
                <input
                  type="radio"
                  name="testFile"
                  value={file.name}
                  checked={selectedFile === file.name}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">{file.name}</div>
                  <div className="text-xs text-gray-500">{file.size} - {file.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {isDownloading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Downloading...</span>
              <span className="text-gray-900">{Math.round(downloadProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <button
          onClick={handleDownload}
          disabled={!isServerRunning || isDownloading}
          className={`w-full flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
            isServerRunning && !isDownloading
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
          {isDownloading ? 'Downloading...' : 'Start Download'}
        </button>

        {!isServerRunning && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              Start the server to enable file downloads
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamingPanel;
