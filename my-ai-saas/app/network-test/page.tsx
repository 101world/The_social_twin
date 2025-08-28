'use client';

import { useState } from 'react';

export default function NetworkTestPage() {
  const [runpodUrl, setRunpodUrl] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runSimpleTest = async () => {
    if (!runpodUrl) {
      alert('Please enter a RunPod URL');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/simple-test?url=${encodeURIComponent(runpodUrl)}`);
      const data = await response.json();
      setResults({ type: 'simple', data });
    } catch (error) {
      setResults({ type: 'simple', error: error instanceof Error ? error.message : 'Unknown error' });
    }
    setLoading(false);
  };

  const runFullTest = async () => {
    if (!runpodUrl) {
      alert('Please enter a RunPod URL');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/network-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runpodUrl })
      });
      const data = await response.json();
      setResults({ type: 'full', data });
    } catch (error) {
      setResults({ type: 'full', error: error instanceof Error ? error.message : 'Unknown error' });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">RunPod Network Debug Tool</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          RunPod URL:
        </label>
        <input
          type="text"
          value={runpodUrl}
          onChange={(e) => setRunpodUrl(e.target.value)}
          placeholder="https://xxx-xxx.runpod.net"
          className="w-full p-3 border rounded-lg"
        />
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={runSimpleTest}
          disabled={loading}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Simple Test'}
        </button>
        
        <button
          onClick={runFullTest}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Full Network Test'}
        </button>
      </div>

      {results && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Test Results:</h2>
          
          {results.error ? (
            <div className="text-red-600">
              <p><strong>Error:</strong> {results.error}</p>
            </div>
          ) : (
            <div>
              {results.type === 'simple' && (
                <div className="space-y-2">
                  <p><strong>Success:</strong> {results.data.success ? '✅ Yes' : '❌ No'}</p>
                  {results.data.success ? (
                    <>
                      <p><strong>Status:</strong> {results.data.status}</p>
                      <p><strong>Response Time:</strong> {results.data.responseTime}</p>
                      <p><strong>Response Size:</strong> {results.data.responseSize} bytes</p>
                      <p><strong>Is HTML:</strong> {results.data.isHtml ? '⚠️ Yes (unexpected)' : '✅ No'}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer font-medium">Response Preview</summary>
                        <pre className="mt-2 text-xs bg-white p-2 rounded overflow-x-auto">
                          {results.data.bodyPreview}
                        </pre>
                      </details>
                    </>
                  ) : (
                    <div className="text-red-600">
                      <p><strong>Error:</strong> {results.data.error}</p>
                      <p><strong>Type:</strong> {results.data.errorType}</p>
                      {results.data.timeout && <p className="text-orange-600">⏰ Request timed out</p>}
                    </div>
                  )}
                </div>
              )}
              
              {results.type === 'full' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">Summary</h3>
                    <p>Successful tests: {results.data.summary?.successfulTests}/{results.data.summary?.totalTests} ({results.data.summary?.successRate})</p>
                  </div>
                  
                  {results.data.recommendations && (
                    <div>
                      <h3 className="font-medium text-orange-600">Recommendations</h3>
                      <ul className="list-disc list-inside">
                        {results.data.recommendations.map((rec: string, i: number) => (
                          <li key={i} className="text-sm">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <details>
                    <summary className="cursor-pointer font-medium">Detailed Results</summary>
                    <pre className="mt-2 text-xs bg-white p-2 rounded overflow-x-auto max-h-96">
                      {JSON.stringify(results.data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="mt-8 text-sm text-gray-600">
        <h3 className="font-medium mb-2">What to check:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Is your RunPod instance running? Check RunPod dashboard</li>
          <li>Is the URL correct? Should be https://xxx-xxx.runpod.net</li>
          <li>Is ComfyUI running on the pod? Check pod logs</li>
          <li>Are there firewall restrictions on your network?</li>
          <li>Is the pod in the right region/accessible from Vercel?</li>
        </ul>
      </div>
    </div>
  );
}
