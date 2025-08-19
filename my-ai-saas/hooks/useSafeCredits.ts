'use client';

import { useState, useEffect } from 'react';
import { useCredits as useCreditsOriginal } from '@/lib/credits-context';

// Safe wrapper for useCredits that handles provider issues
export function useSafeCredits() {
  const [creditInfo, setCreditInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<() => Promise<void>>(() => async () => {});
  const [deductCredits, setDeductCredits] = useState<(amount: number) => Promise<boolean>>(() => async () => false);

  useEffect(() => {
    try {
      const creditsContext = useCreditsOriginal();
      setCreditInfo(creditsContext.creditInfo);
      setLoading(creditsContext.loading);
      setError(creditsContext.error);
      setRefresh(() => creditsContext.refresh);
      setDeductCredits(() => creditsContext.deductCredits);
    } catch (err) {
      console.warn('Credits context not available, using fallback values');
      setCreditInfo(null);
      setLoading(false);
      setError('Credits context not available');
      setRefresh(() => async () => {});
      setDeductCredits(() => async () => false);
    }
  }, []);

  return {
    creditInfo,
    loading,
    error,
    refresh,
    deductCredits
  };
}
