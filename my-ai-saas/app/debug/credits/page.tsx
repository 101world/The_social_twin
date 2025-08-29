'use client';

import { useState, useEffect } from 'react';

export default function CreditsDebugPage() {
  const [creditsData, setCreditsData] = useState<any>(null);
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/users/credits');
      const data = await response.json();
      
      if (response.ok) {
        setCreditsData(data);
      } else {
        setError(`Credits API error: ${data.error || response.statusText}`);
      }
    } catch (err) {
      setError(`Network error: ${err}`);
    }
    
    setLoading(false);
  };

  const fetchDebugInfo = async () => {
    try {
      const response = await fetch('/api/debug/credits');
      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      console.error('Debug fetch failed:', err);
    }
  };

  const setupTestUser = async () => {
    try {
      const response = await fetch('/api/debug/setup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user_123',
          credits: 1666,
          plan: 'one z'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Test user created successfully!');
        await fetchCredits();
      } else {
        alert(`Failed to create test user: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err}`);
    }
  };

  useEffect(() => {
    fetchCredits();
    fetchDebugInfo();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Credits System Debug</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Credits Data */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Credits API Response</h2>
          <button 
            onClick={fetchCredits}
            className="mb-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh Credits'}
          </button>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          {creditsData && (
            <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto">
              {JSON.stringify(creditsData, null, 2)}
            </pre>
          )}
        </div>

        {/* Debug Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Environment Debug</h2>
          <button 
            onClick={fetchDebugInfo}
            className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Refresh Debug Info
          </button>
          
          {debugData && (
            <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Test Actions */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
        <button 
          onClick={setupTestUser}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Setup Test User with 1666 Credits
        </button>
        <p className="text-sm text-gray-600 mt-2">
          This will create a test user in the database with credits and billing data.
        </p>
      </div>

      {/* Current Status */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Current Status Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Credits:</span>
            <span className={`font-medium ${creditsData?.credits > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {creditsData?.credits ?? 'Unknown'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Plan:</span>
            <span className="font-medium">{creditsData?.subscription_plan ?? 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={`font-medium ${creditsData?.subscription_active ? 'text-green-600' : 'text-red-600'}`}>
              {creditsData?.subscription_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Dev Mode:</span>
            <span className="font-medium">{creditsData?.dev ? 'Yes' : 'No'}</span>
          </div>
          {creditsData?.monthly_grant && (
            <div className="flex justify-between">
              <span>Monthly Grant:</span>
              <span className="font-medium">{creditsData.monthly_grant}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
