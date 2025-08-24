'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

// Mobile-safe credits hook that fetches directly from API
export function useSafeCredits() {
  const { userId } = useAuth();
  const [creditInfo, setCreditInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/credits', {
        headers: {
          'X-User-Id': userId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCreditInfo(data);
        setError(null);
      } else {
        console.warn('Failed to fetch credits:', response.status);
        setError('Failed to fetch credits');
        // Set default values for failed credit fetch
        setCreditInfo({ 
          credits: 100, // Default credits for mobile
          subscription_active: false,
          subscription_plan: null 
        });
      }
    } catch (err) {
      console.warn('Credits fetch error:', err);
      setError('Network error');
      // Set default values for network errors
      setCreditInfo({ 
        credits: 100, // Default credits for mobile
        subscription_active: false,
        subscription_plan: null 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [userId]);

  const refresh = async () => {
    await fetchCredits();
  };

  const deductCredits = async (amount: number): Promise<boolean> => {
    if (!userId || !creditInfo?.credits) return false;
    
    try {
      const response = await fetch('/api/credits/deduct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ amount })
      });
      
      if (response.ok) {
        await refresh(); // Refresh credits after deduction
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    creditInfo,
    loading,
    error,
    refresh,
    deductCredits
  };
}
