'use client';

import { useState, useEffect } from 'react';
import { useSafeCredits } from '@/hooks/useSafeCredits';

interface CreditCost {
  text: number;
  image: number;
  video: number;
  videoCompile: number;
  imageModify: number;
  pdfExport: number;
}

interface GenerationCostDisplayProps {
  mode: 'text' | 'image' | 'image-modify' | 'video' | 'pdf-export';
  batchSize?: number;
  darkMode?: boolean;
  onCostCalculated?: (cost: number, canAfford: boolean) => void;
  refreshToken?: any; // change to re-fetch credits
  hideUI?: boolean; // compute-only mode
}

export default function GenerationCostDisplay({
  mode,
  batchSize = 1,
  darkMode = false,
  onCostCalculated,
  refreshToken,
  hideUI = false,
}: GenerationCostDisplayProps) {
  const { creditInfo, loading } = useSafeCredits();
  const currentCredits = creditInfo?.credits || 0;

  const CREDIT_COSTS: CreditCost = {
    text: 1,
    image: 5,
    video: 10,
    videoCompile: 3,
    imageModify: 3,
    pdfExport: 1,
  };

  useEffect(() => {
    const cost = calculateCost();
    const canAfford = currentCredits >= cost;
    onCostCalculated?.(cost, canAfford);
  }, [mode, batchSize, currentCredits, onCostCalculated]);

  const calculateCost = () => {
    const baseCost = mode === 'image-modify' 
      ? CREDIT_COSTS.imageModify 
      : mode === 'pdf-export'
      ? CREDIT_COSTS.pdfExport
      : CREDIT_COSTS[mode as keyof typeof CREDIT_COSTS] || CREDIT_COSTS.text;
    
    return baseCost * (batchSize || 1);
  };

  const cost = calculateCost();
  const canAfford = currentCredits >= cost;
  const remainingAfter = currentCredits - cost;

  if (hideUI) {
    return null;
  }

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
        ? (darkMode ? 'border-gray-700 bg-gray-900/30 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-800')
        : (darkMode ? 'border-red-600 bg-red-900/20 text-red-300' : 'border-red-500 bg-red-50 text-red-700')
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
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
              <li>• Upgrade your plan for a larger monthly wallet</li>
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
    videoCompile: 3,
    imageModify: 3,
    pdfExport: 1,
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
          <span>Video compiling:</span>
          <span className="font-medium">{CREDIT_COSTS.videoCompile} credits</span>
        </div>
        <div className="flex justify-between">
          <span>Image modification:</span>
          <span className="font-medium">{CREDIT_COSTS.imageModify} credits</span>
        </div>
        <div className="flex justify-between">
          <span>PDF export:</span>
          <span className="font-medium">{CREDIT_COSTS.pdfExport} credit</span>
        </div>
      </div>
    </div>
  );
}
