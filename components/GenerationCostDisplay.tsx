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
  hideUI?: boolean; // when true, component only computes and reports cost without rendering UI
  hideMobile?: boolean; // when true, hides on mobile devices
}

export default function GenerationCostDisplay({ 
  mode, 
  batchSize = 1, 
  darkMode = false,
  onCostCalculated,
  hideUI = false,
  hideMobile = true, // Hide on mobile by default
}: GenerationCostDisplayProps) {
  const { userId } = useAuth();
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [userPlan, setUserPlan] = useState<string>('');
  const [planLimits, setPlanLimits] = useState<{ maxImages: number; maxVideos: number } | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState<{ images: number; videos: number }>({ images: 0, videos: 0 });
  const [oneMaxBalance, setOneMaxBalance] = useState<number>(0);
  const [isOneMaxUser, setIsOneMaxUser] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  const CREDIT_COSTS: CreditCost = {
    text: 1,
    image: 5,
    video: 10,
    imageModify: 3,
  };

  // ONE MAX pricing (pay-per-use in USD)
  const ONE_MAX_COSTS = {
    text: 0.01,
    image: 0.20,
    video: 0.50,
    imageModify: 0.15,
  };

  // Plan limits with exact specifications
  const PLAN_LIMITS = {
    'one_t': { maxImages: 200, maxVideos: 12, credits: 1120 },
    'one_z': { maxImages: 700, maxVideos: 55, credits: 4050 },
    'one_pro': { maxImages: 1500, maxVideos: 120, credits: 8700 }
  };

  useEffect(() => {
    if (userId) {
      fetchCredits();
    }
  }, [userId]);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const cost = isOneMaxUser 
      ? calculateOneMaxCost() 
      : calculateCost();
    const canAfford = isOneMaxUser 
      ? oneMaxBalance >= cost 
      : currentCredits >= cost;
    onCostCalculated?.(cost, canAfford);
  }, [mode, batchSize, currentCredits, oneMaxBalance, isOneMaxUser, onCostCalculated]);

  const fetchCredits = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users/credits');
      if (response.ok) {
        const data = await response.json();
        setCurrentCredits(data.credits || 0);
        setUserPlan(data.subscription_plan || '');
        
        // Check if user is on ONE MAX plan
        const isOneMax = data.subscription_plan?.toLowerCase() === 'one_max';
        setIsOneMaxUser(isOneMax);
        
        if (isOneMax) {
          // Fetch ONE MAX balance
          fetchOneMaxBalance();
        } else {
          // Set plan limits for monthly plans
          const plan = data.subscription_plan?.toLowerCase().replace(' ', '_');
          if (plan && PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]) {
            setPlanLimits(PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]);
          }
          
          // Fetch monthly usage
          fetchMonthlyUsage();
        }
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOneMaxBalance = async () => {
    try {
      const response = await fetch('/api/user/balance');
      if (response.ok) {
        const data = await response.json();
        setOneMaxBalance(data.balance_usd || 0);
      }
    } catch (err) {
      console.error('Failed to fetch ONE MAX balance:', err);
    }
  };

  const fetchMonthlyUsage = async () => {
    try {
      // This would be a new API endpoint to track monthly image/video usage
      const response = await fetch('/api/users/monthly-usage');
      if (response.ok) {
        const data = await response.json();
        setMonthlyUsage(data.usage || { images: 0, videos: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch monthly usage:', err);
    }
  };

  const calculateCost = () => {
    const baseCost = mode === 'image-modify' 
      ? CREDIT_COSTS.imageModify 
      : CREDIT_COSTS[mode as keyof typeof CREDIT_COSTS] || CREDIT_COSTS.text;
    
    return baseCost * (batchSize || 1);
  };

  const calculateOneMaxCost = () => {
    const baseCost = mode === 'image-modify' 
      ? ONE_MAX_COSTS.imageModify 
      : ONE_MAX_COSTS[mode as keyof typeof ONE_MAX_COSTS] || ONE_MAX_COSTS.text;
    
    return baseCost * (batchSize || 1);
  };

  const cost = isOneMaxUser ? calculateOneMaxCost() : calculateCost();
  const canAfford = isOneMaxUser ? oneMaxBalance >= cost : currentCredits >= cost;
  const remainingAfter = isOneMaxUser ? oneMaxBalance - cost : currentCredits - cost;

  if (hideUI) {
    // Silent mode: still runs effects and passes cost up, but renders nothing
    return null;
  }

  // Hide on mobile if hideMobile is true
  if (hideMobile && isMobile) {
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
              {isOneMaxUser ? ' • Pay-per-use' : ''}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm">
            <span className="opacity-70">
              {isOneMaxUser ? 'Balance: ' : 'Credits: '}
            </span>
            <span className="font-bold">
              {isOneMaxUser ? `$${oneMaxBalance.toFixed(2)}` : currentCredits}
            </span>
          </div>
          {canAfford ? (
            <div className="text-xs opacity-70">
              After: {isOneMaxUser ? `$${remainingAfter.toFixed(2)}` : `${remainingAfter} credits`}
            </div>
          ) : (
            <div className="text-xs font-medium">
              {isOneMaxUser 
                ? `Need $${(cost - oneMaxBalance).toFixed(2)} more`
                : `Need ${cost - currentCredits} more credits`
              }
            </div>
          )}
        </div>
      </div>

      {/* ONE MAX Pricing Display */}
      {isOneMaxUser && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
          <div className="text-xs">
            <p className="mb-1"><strong>🚀 ONE MAX - Pay Per Use:</strong></p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>Images:</span>
                <span className="text-amber-400 font-medium">$0.20 each</span>
              </div>
              <div className="flex justify-between">
                <span>Videos:</span>
                <span className="text-blue-400 font-medium">$0.50 each</span>
              </div>
              <div className="flex justify-between">
                <span>Text:</span>
                <span className="text-purple-400 font-medium">$0.01 each</span>
              </div>
              <div className="flex justify-between">
                <span>Image Edit:</span>
                <span className="text-orange-400 font-medium">$0.15 each</span>
              </div>
            </div>
            <div className="mt-1 text-xs text-amber-400">
              ✓ No monthly limits • Ultra-fast processing • Premium models
            </div>
          </div>
        </div>
      )}

      {/* Plan Limits Display for Monthly Plans */}
      {!isOneMaxUser && planLimits && (mode === 'image' || mode === 'video') && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
          <div className="text-xs">
            <p className="mb-1"><strong>📊 Monthly Limits ({userPlan}):</strong></p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {mode === 'image' && (
                <div className="flex justify-between">
                  <span>Images:</span>
                  <span className={monthlyUsage.images >= planLimits.maxImages ? 'text-red-400 font-bold' : 'text-amber-400'}>
                    {monthlyUsage.images}/{planLimits.maxImages}
                  </span>
                </div>
              )}
              {mode === 'video' && (
                <div className="flex justify-between">
                  <span>Videos:</span>
                  <span className={monthlyUsage.videos >= planLimits.maxVideos ? 'text-red-400 font-bold' : 'text-blue-400'}>
                    {monthlyUsage.videos}/{planLimits.maxVideos}
                  </span>
                </div>
              )}
            </div>
            {((mode === 'image' && monthlyUsage.images >= planLimits.maxImages) || 
              (mode === 'video' && monthlyUsage.videos >= planLimits.maxVideos)) && (
              <div className="mt-1 text-xs text-red-400 font-medium">
                ⚠️ Monthly limit reached for {mode}s. Upgrade your plan to continue.
              </div>
            )}
          </div>
        </div>
      )}

      {!canAfford && !isOneMaxUser && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
          <div className="text-xs">
            <p className="mb-1">💡 <strong>Get more credits:</strong></p>
            <ul className="space-y-0.5 ml-4">
              <li>• One T: 200 images + 12 videos monthly ($19)</li>
              <li>• One Z: 700 images + 55 videos monthly ($79)</li>
              <li>• One Pro: 1,500 images + 120 videos monthly ($149)</li>
              <li>• <strong>ONE MAX: Pay per use • No limits • $0.20 per image • $0.50 per video</strong></li>
            </ul>
          </div>
        </div>
      )}

      {!canAfford && isOneMaxUser && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
          <div className="text-xs">
            <p className="mb-1">💰 <strong>Top up your balance:</strong></p>
            <p className="text-amber-400">Visit the subscription page to add funds to your ONE MAX account.</p>
          </div>
        </div>
      )}

      {/* Cost Breakdown for Batch */}
      {batchSize > 1 && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
          <div className="text-xs opacity-80">
            Cost breakdown: {isOneMaxUser 
              ? `$${(cost / batchSize).toFixed(3)} × ${batchSize} = $${cost.toFixed(3)}`
              : `${(cost / batchSize)} × ${batchSize} = ${cost} credits`
            }
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
