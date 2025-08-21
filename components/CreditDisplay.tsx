'use client';

import { useState, useEffect } from 'react';
import { CreditCardIcon, SparklesIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface CreditInfo {
  credits: number;
  subscription_active: boolean;
  subscription_plan: string;
  created_at: string;
}

interface CreditDisplayProps {
  className?: string;
  showDetails?: boolean;
}

export default function CreditDisplay({ className = '', showDetails = true }: CreditDisplayProps) {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/users/credits');
      if (response.ok) {
        const data = await response.json();
        setCreditInfo(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch credits');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching credits:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'free':
        return 'text-gray-600 bg-gray-100';
      case 'starter':
        return 'text-blue-600 bg-blue-100';
      case 'pro':
        return 'text-purple-600 bg-purple-100';
      case 'enterprise':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'free':
        return '🆓';
      case 'starter':
        return '🚀';
      case 'pro':
        return '⭐';
      case 'enterprise':
        return '🏢';
      default:
        return '💳';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 p-3 bg-gray-50 rounded-lg ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span className="text-sm text-gray-600">Loading credits...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
        <div className="flex-1">
          <p className="text-sm text-red-700">Failed to load credits</p>
          <button
            onClick={fetchCredits}
            className="text-xs text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!creditInfo) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Credits Display */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-yellow-500" />
          <span className="font-medium text-gray-900">Credits</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{creditInfo.credits}</div>
          <div className="text-xs text-gray-500">available</div>
        </div>
      </div>

      {/* Subscription Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Plan</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs">{getPlanIcon(creditInfo.subscription_plan)}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanColor(creditInfo.subscription_plan)}`}>
            {creditInfo.subscription_plan}
          </span>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Status</span>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            creditInfo.subscription_active ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span className={`text-xs font-medium ${
            creditInfo.subscription_active ? 'text-green-600' : 'text-gray-500'
          }`}>
            {creditInfo.subscription_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <span className="block font-medium text-gray-700">Member since</span>
              <span>{new Date(creditInfo.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="block font-medium text-gray-700">Next billing</span>
              <span>
                {creditInfo.subscription_active 
                  ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
                  : 'N/A'
                }
              </span>
            </div>
          </div>
          
          {/* Credit Usage Tips */}
          <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
            <p className="font-medium mb-1">💡 Credit Usage:</p>
            <ul className="space-y-1">
              <li>• Text generation: 1 credit</li>
              <li>• Image generation: 5 credits</li>
              <li>• Video generation: 10 credits</li>
              <li>• Image modification: 3 credits</li>
            </ul>
          </div>
        </div>
      )}

      {/* Low Credits Warning */}
      {creditInfo.credits <= 5 && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
          <div className="flex items-center gap-1 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span className="font-medium">Low Credits</span>
          </div>
          <p>You're running low on credits. Consider upgrading your plan or purchasing more credits.</p>
        </div>
      )}

      {/* Upgrade CTA */}
      {!creditInfo.subscription_active && (
        <div className="mt-3 p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700">
          <p className="font-medium mb-1">🚀 Upgrade Your Plan</p>
          <p>Get more credits and unlock advanced features with a subscription plan.</p>
        </div>
      )}
    </div>
  );
}
