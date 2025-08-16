'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

interface CreditCost {
  text: number;
  image: number;
  video: number;
  imageModify: number;
}

interface GenerationCostDisplayProps {
  mode: 'text' | 'image' | 'image-modify' | 'video';
  batchSize?: number;
  darkMode?: boolean;
  onCostCalculated?: (cost: number, canAfford: boolean) => void;
}

export default function GenerationCostDisplay({ 
  mode, 
  batchSize = 1, 
  darkMode = false,
  onCostCalculated 
}: GenerationCostDisplayProps) {
  const { userId } = useAuth();
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const CREDIT_COSTS: CreditCost = {
    text: 1,
    image: 5,
    video: 10,
    imageModify: 3,
  };

  useEffect(() => {
    if (userId) {
      fetchCredits();
    }
  }, [userId]);

  useEffect(() => {
    const cost = calculateCost();
    const canAfford = currentCredits >= cost;
    onCostCalculated?.(cost, canAfford);
  }, [mode, batchSize, currentCredits, onCostCalculated]);

  const fetchCredits = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users/credits');
      if (response.ok) {
        const data = await response.json();
        setCurrentCredits(data.credits || 0);
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateCost = () => {
    const baseCost = mode === 'image-modify' 
      ? CREDIT_COSTS.imageModify 
      : CREDIT_COSTS[mode as keyof typeof CREDIT_COSTS] || CREDIT_COSTS.text;
    
    return baseCost * (batchSize || 1);
  };

  const cost = calculateCost();
  const canAfford = currentCredits >= cost;
  const remainingAfter = currentCredits - cost;

  if (loading) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded text-sm ${
        darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
      }`}>
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
        <span>Calculating cost...</span>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${
      canAfford 
        ? darkMode 
          ? 'border-green-600 bg-green-900/20 text-green-300' 
          : 'border-green-500 bg-green-50 text-green-700'
        : darkMode
          ? 'border-red-600 bg-red-900/20 text-red-300'
          : 'border-red-500 bg-red-50 text-red-700'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{canAfford ? '✅' : '⚠️'}</span>
          <div>
            <div className="font-medium">
              {cost} credit{cost !== 1 ? 's' : ''} required
            </div>
            <div className="text-xs opacity-80">
              {mode.charAt(0).toUpperCase() + mode.slice(1)} generation
              {batchSize > 1 ? ` × ${batchSize}` : ''}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm">
            <span className="opacity-70">Balance: </span>
            <span className="font-bold">{currentCredits}</span>
          </div>
          {canAfford ? (
            <div className="text-xs opacity-70">
              After: {remainingAfter} credits
            </div>
          ) : (
            <div className="text-xs font-medium">
              Need {cost - currentCredits} more credits
            </div>
          )}
        </div>
      </div>

      {!canAfford && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
          <div className="text-xs">
            <p className="mb-1">💡 <strong>Get more credits:</strong></p>
            <ul className="space-y-0.5 ml-4">
              <li>• Free daily top-up: 50 credits</li>
              <li>• Upgrade to Pro plan for unlimited credits</li>
              <li>• Purchase additional credit packs</li>
            </ul>
          </div>
        </div>
      )}

      {/* Cost Breakdown for Batch */}
      {batchSize > 1 && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
          <div className="text-xs opacity-80">
            Cost breakdown: {CREDIT_COSTS[mode as keyof typeof CREDIT_COSTS] || CREDIT_COSTS.text} × {batchSize} = {cost} credits
          </div>
        </div>
      )}
    </div>
  );
}

// Credit cost reference component
export function CreditCostReference({ darkMode = false }: { darkMode?: boolean }) {
  const CREDIT_COSTS: CreditCost = {
    text: 1,
    image: 5,
    video: 10,
    imageModify: 3,
  };

  return (
    <div className={`p-3 rounded-lg border ${
      darkMode ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-700'
    }`}>
      <div className="text-sm font-medium mb-2">💳 Credit Costs</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span>Text generation:</span>
          <span className="font-medium">{CREDIT_COSTS.text} credit</span>
        </div>
        <div className="flex justify-between">
          <span>Image generation:</span>
          <span className="font-medium">{CREDIT_COSTS.image} credits</span>
        </div>
        <div className="flex justify-between">
          <span>Video generation:</span>
          <span className="font-medium">{CREDIT_COSTS.video} credits</span>
        </div>
        <div className="flex justify-between">
          <span>Image modification:</span>
          <span className="font-medium">{CREDIT_COSTS.imageModify} credits</span>
        </div>
      </div>
    </div>
  );
}
