'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

interface CreditInfo {
  credits: number;
  subscription_active: boolean;
  subscription_plan: string;
  created_at: string;
  next_billing_at?: string | null;
  monthly_grant?: number;
  dev?: boolean;
}

interface CreditContextValue {
  creditInfo: CreditInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deductCredits: (amount: number) => Promise<boolean>;
}

const CreditContext = createContext<CreditContextValue | undefined>(undefined);

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
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
  }, [userId]);

  const deductCredits = useCallback(async (amount: number): Promise<boolean> => {
    if (!userId) return false;

    try {
      const response = await fetch('/api/users/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', amount })
      });

      if (response.ok) {
        const data = await response.json();
        setCreditInfo(prev => prev ? { ...prev, credits: data.new_balance } : null);
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to deduct credits');
        return false;
      }
    } catch (err) {
      setError('Network error');
      console.error('Error deducting credits:', err);
      return false;
    }
  }, [userId]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const value: CreditContextValue = {
    creditInfo,
    loading,
    error,
    refresh: fetchCredits,
    deductCredits
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
}
