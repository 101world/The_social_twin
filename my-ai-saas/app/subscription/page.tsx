"use client";
import { useEffect, useState } from "react";
import { useAuth, useUser } from '@clerk/nextjs';

// Plan interfaces
interface Plan {
  id: string;
  name: string;
  usd_price: number;
  inr_price: number;
  credits: number;
  description: string;
}

interface SubscriptionPlans {
  one_t: Plan;
  one_z: Plan;
  one_pro: Plan;
  one_max?: Plan;
}

interface UserBalance {
  balance_usd: number;
  balance_inr: number;
  minimum_balance_usd: number;
  needs_topup: boolean;
  total_spent_this_month_usd: number;
  generations_this_month: number;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function SubscriptionPage() {
  const { userId } = useAuth();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlans | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [lastAction, setLastAction] = useState<string>('');
  const [lastError, setLastError] = useState<string>('');
  const [topupAmount, setTopupAmount] = useState<number>(25);

  useEffect(() => setMounted(true), []);

  // Load available plans
  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await fetch('/api/razorpay/create-subscription');
        const data = await response.json();
        setPlans(data.plans);
      } catch (error) {
        console.error('Failed to load plans:', error);
      }
    }
    loadPlans();
  }, []);

  // Load user info
  useEffect(() => {
    async function loadUserInfo() {
      if (!userId) return;
      try {
        const response = await fetch('/api/user/credits');
        const data = await response.json();
        setUserInfo(data);

        // Load user balance for ONE MAX plan
        const balanceResponse = await fetch('/api/user/balance');
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setUserBalance(balanceData);
        }
      } catch (error) {
        console.error('Failed to load user info:', error);
      }
    }
    loadUserInfo();
  }, [userId]);

  // Load Razorpay script
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleTopUpBalance = async (amountParam?: number) => {
    setLastError('');
    setLastAction('topup:start');
    const amountValue = typeof amountParam === 'number' ? amountParam : topupAmount;
    if (!amountValue || isNaN(Number(amountValue)) || Number(amountValue) < 5) {
      alert('Please enter a valid amount (minimum $5)');
      return;
    }

    setLoading(true);
    setSelectedPlan('one_max');

    try {
  console.debug('[Razorpay] Loading checkout script…');
  setLastAction('topup:loadScript');
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load payment system');
      }

      const response = await fetch('/api/razorpay/create-balance-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amountValue) })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment');
      }

      console.debug('[Razorpay] Opening checkout modal…');
      setLastAction('topup:openCheckout');
      const options = {
        key: data.razorpay_key,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'ONE AI - Balance Top-up',
        description: `Add $${amountValue} to your ONE MAX balance`,
        order_id: data.order_id,
        prefill: {
          name: user?.fullName || '',
          email: user?.primaryEmailAddress?.emailAddress || '',
        },
        theme: {
          color: '#ff8a00'
        },
        handler: function (response: any) {
          alert(`Balance top-up successful! $${amountValue} added to your account.`);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            setSelectedPlan('');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error: any) {
  console.error('[Razorpay] Top-up flow failed:', error);
  setLastError(error?.message || 'Top-up failed');
      alert(`Top-up failed: ${error.message}`);
      console.error('Top-up error:', error);
    } finally {
      setLoading(false);
      setSelectedPlan('');
    }
  };

  const handleSubscribe = async (planId: string) => {
  setLastError('');
  setLastAction(`subscribe:${planId}:start`);
    if (!userId) {
      alert('Please sign in to subscribe');
      return;
    }

    // Handle ONE MAX plan differently (no subscription, just redirect to balance top-up)
    if (planId === 'one_max') {
      await handleTopUpBalance(topupAmount);
      return;
    }

    setLoading(true);
    setSelectedPlan(planId);

    try {
      // Load Razorpay script
  console.debug('[Razorpay] Loading checkout script…');
  setLastAction(`subscribe:${planId}:loadScript`);
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load payment system');
      }

      // Create subscription
      const response = await fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription');
      }

  console.debug('[Razorpay] Opening subscription checkout…');
  setLastAction(`subscribe:${planId}:openCheckout`);
      const plan = plans?.[planId as keyof SubscriptionPlans];
      if (!plan) throw new Error('Plan not found');

      // Open Razorpay subscription checkout
      const options = {
        key: data.subscription.razorpay_key,
        subscription_id: data.subscription.id,
        name: 'ONE AI',
        description: plan.description,
        prefill: {
          name: user?.fullName || '',
          email: user?.primaryEmailAddress?.emailAddress || '',
        },
        theme: {
          color: '#ff8a00'
        },
        handler: function (response: any) {
          alert(`Subscription successful! Welcome to ${plan.name}!`);
          // Refresh user info
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            setSelectedPlan('');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error: any) {
  console.error('[Razorpay] Subscribe flow failed:', error);
  setLastError(error?.message || 'Subscription failed');
      alert(`Subscription failed: ${error.message}`);
      console.error('Subscription error:', error);
    } finally {
      setLoading(false);
      setSelectedPlan('');
    }
  };
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white">

      <section className="mx-auto max-w-6xl p-6">
        <header className="mb-12 text-center">
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-400 bg-clip-text text-transparent mb-4">
              Choose Your AI Plan
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Unlock the full potential of AI with flexible plans designed for creators, businesses, and innovators
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Cancel anytime
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Instant activation
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-teal-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              24/7 support
            </span>
          </div>
        </header>

        {/* Current Status */}
        {userInfo && (
          <div className="mb-12">
            <div className="bg-gradient-to-r from-neutral-900/80 to-neutral-800/80 backdrop-blur-xl rounded-3xl border border-neutral-700/50 p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white">Current Status</h3>
              </div>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 rounded-2xl p-6 border border-cyan-500/20">
                  <p className="text-sm text-cyan-300 font-medium mb-2">Credits Balance</p>
                  <p className="text-3xl font-bold text-cyan-400">
                    {userInfo.credits?.toLocaleString() || 0}
                  </p>
                  <div className="mt-2 text-xs text-cyan-300/70">Available to use</div>
                </div>
                <div className="bg-gradient-to-r from-teal-500/10 to-blue-500/10 rounded-2xl p-6 border border-teal-500/20">
                  <p className="text-sm text-teal-300 font-medium mb-2">Current Plan</p>
                  <p className="text-xl font-bold text-teal-400">
                    {userInfo.subscription_plan || 'No active subscription'}
                  </p>
                  <div className="mt-2 text-xs text-teal-300/70">Subscription type</div>
                </div>
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 border border-blue-500/20">
                  <p className="text-sm text-blue-300 font-medium mb-2">Status</p>
                  <p className={`text-xl font-bold ${userInfo.subscription_active ? 'text-green-400' : 'text-red-400'}`}>
                    {userInfo.subscription_active ? 'Active' : 'Inactive'}
                  </p>
                  <div className="mt-2 text-xs text-blue-300/70">Account status</div>
                </div>
                {userBalance && (
                  <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
                    <p className="text-sm text-purple-300 font-medium mb-2">ONE MAX Balance</p>
                    <p className="text-xl font-bold text-purple-400">
                      ${userBalance.balance_usd?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-purple-300/70">
                      ₹{userBalance.balance_inr?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        {plans && (
          <div className="space-y-12">
            {/* Monthly Subscription Plans */}
            <div className="bg-gradient-to-r from-neutral-900/80 to-neutral-800/80 backdrop-blur-xl rounded-3xl border border-neutral-700/50 p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Monthly Subscription Plans</h2>
                <p className="text-gray-300 text-lg">Fixed monthly pricing with credit allocation</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
              {Object.entries(plans).filter(([planId]) => planId !== 'one_max').map(([planId, plan]) => {
                const isPopular = planId === 'one_z';
                const isLoading = loading && selectedPlan === planId;

                return (
                  <div
                    key={planId}
                    className={`relative rounded-2xl p-8 border-2 transition-all hover:scale-[1.02] hover:shadow-2xl ${
                      isPopular
                        ? 'border-cyan-500/50 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 shadow-lg shadow-cyan-500/20'
                        : 'border-neutral-700/50 bg-neutral-800/50 hover:border-neutral-600/50'
                    }`}
                  >
                    {/* Popular Badge */}
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                          MOST POPULAR
                        </span>
                      </div>
                    )}

                    {/* Plan Details */}
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold mb-4 text-white">{plan.name}</h3>
                      <div className="mb-6">
                        <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                          ₹{plan.inr_price.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          ${plan.usd_price}/month
                        </div>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed">{plan.description}</p>
                    </div>

                    {/* Features */}
                    <div className="space-y-4 mb-8">
                      <div className="flex items-center text-white">
                        <svg className="w-5 h-5 text-cyan-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">{plan.credits.toLocaleString()} AI credits monthly</span>
                      </div>
                      <div className="flex items-center text-white">
                        <svg className="w-5 h-5 text-cyan-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Text, Image & Video generation</span>
                      </div>
                      <div className="flex items-center text-white">
                        <svg className="w-5 h-5 text-cyan-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">PDF export & Video compilation</span>
                      </div>
                      <div className="flex items-center text-white">
                        <svg className="w-5 h-5 text-cyan-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Priority support</span>
                      </div>
                      {planId === 'one_pro' && (
                        <div className="flex items-center text-white">
                          <svg className="w-5 h-5 text-cyan-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm">API access & Advanced features</span>
                        </div>
                      )}
                    </div>

                    {/* Subscribe Button */}
                    <button
                      onClick={() => handleSubscribe(planId)}
                      disabled={loading}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all transform hover:scale-105 ${
                        isPopular
                          ? 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/30'
                          : 'bg-gradient-to-r from-neutral-700 to-neutral-600 hover:from-neutral-600 hover:to-neutral-500 text-white'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isLoading ? 'Processing...' : 'Subscribe Now'}
                    </button>
                    {lastError && selectedPlan === planId && (
                      <div className="mt-3 text-sm text-red-400 text-center">{lastError}</div>
                    )}

                    {/* Exact Limits Breakdown */}
                    <div className="mt-6 text-xs text-gray-400 text-center space-y-2">
                      {planId === 'one_t' && (
                        <>
                          <div className="font-semibold text-cyan-400">✓ 200 images per month</div>
                          <div className="font-semibold text-cyan-400">✓ 12 videos per month</div>
                          <div className="text-xs opacity-50">= 1,120 total credits</div>
                        </>
                      )}
                      {planId === 'one_z' && (
                        <>
                          <div className="font-semibold text-cyan-400">✓ 700 images per month</div>
                          <div className="font-semibold text-cyan-400">✓ 55 videos per month</div>
                          <div className="text-xs opacity-50">= 4,050 total credits</div>
                        </>
                      )}
                      {planId === 'one_pro' && (
                        <>
                          <div className="font-semibold text-cyan-400">✓ 1,500 images per month</div>
                          <div className="font-semibold text-cyan-400">✓ 120 videos per month</div>
                          <div className="text-xs opacity-50">= 8,700 total credits</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>

            {/* Pay-Per-Use Plan (ONE MAX) - Sleek glass design below the subscriptions */}
            <div className="bg-gradient-to-r from-neutral-900/80 to-neutral-800/80 backdrop-blur-xl rounded-3xl border border-neutral-700/50 p-8 shadow-2xl">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                {/* 1:1 visual tile */}
                <div className="flex md:justify-start justify-center">
                  <div className="aspect-square w-48 md:w-64 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-2xl border border-emerald-500/30 backdrop-blur-md flex items-center justify-center shadow-inner shadow-black/40 hover:scale-[1.02] transition-all">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-300 font-semibold">Pay per use</div>
                    </div>
                  </div>
                </div>

                {/* Copy + Balance + CTA */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">ONE MAX</h2>
                    {userBalance && (
                      <span className="text-xs px-3 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold">
                        Balance: <span className="text-emerald-300">${userBalance.balance_usd?.toFixed(2) || '0.00'}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300 mb-6 leading-relaxed">Top up anytime. No monthly fees. Designed for flexible, on-demand creativity.</p>

                  <div className="mb-6 flex flex-wrap gap-3 text-xs">
                    <span className="px-3 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">No lock‑in</span>
                    <span className="px-3 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">Instant top‑ups</span>
                    <span className="px-3 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">Usage analytics</span>
                    <span className="px-3 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">Priority routing</span>
                  </div>

                  {/* Amount presets */}
                  <div className="mb-6">
                    <div className="text-sm text-gray-400 mb-3 font-semibold">Quick Top-up Amounts</div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {[10, 25, 50, 100].map((v) => (
                        <button
                          key={v}
                          onClick={() => setTopupAmount(v)}
                          className={`px-4 py-2 text-sm rounded-xl border transition-all hover:scale-105 ${
                            topupAmount === v
                              ? 'border-emerald-400 text-emerald-300 bg-emerald-500/20 shadow-lg shadow-emerald-500/20'
                              : 'border-neutral-600 text-gray-300 hover:border-neutral-500 bg-neutral-800/50'
                          }`}
                          type="button"
                        >
                          ${v}
                        </button>
                      ))}
                      <div className="ml-2 flex items-center gap-3">
                        <span className="text-sm text-gray-400">Custom</span>
                        <input
                          type="number"
                          min={5}
                          value={topupAmount}
                          onChange={(e) => setTopupAmount(Number(e.target.value))}
                          className="w-24 rounded-xl bg-neutral-800/50 border border-neutral-600 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {userBalance?.needs_topup && (
                    <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                      ⚠️ Low balance • Add funds to continue generating
                    </div>
                  )}

                  <button
                    onClick={() => handleSubscribe('one_max')}
                    disabled={loading}
                    className="group inline-flex items-center gap-3 rounded-xl px-6 py-4 font-bold text-lg text-white bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-300/30 transition-all transform hover:scale-105 disabled:opacity-50"
                  >
                    {loading && selectedPlan === 'one_max' ? 'Processing…' : `Add $${Math.max(5, Number(topupAmount) || 0)}`}
                    <svg className="w-5 h-5 opacity-80 transition-transform group-hover:translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!plans && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md text-center">
            <div className="text-lg">Loading subscription plans...</div>
          </div>
        )}

        {/* Legal footnotes */}
        <section className="mt-12 space-y-4 text-xs opacity-70">
          <div className="text-sm font-semibold opacity-80">Terms & Privacy</div>
          <p>
            By using The Social Twin, you agree to our Terms of Service and Privacy Policy. All content generated using our
            AI tools is, to the fullest extent permitted by law, owned by and constitutes the intellectual property of The Social
            Twin in perpetuity. You receive a non-exclusive license to display such content within our platform and for personal
            portfolio and social sharing, subject to our policies. Commercial use may require an appropriate license or plan upgrade.
          </p>
          <p>
            Subscriptions are non-refundable once a billing period begins. Cancelling will stop renewal at the end of the current
            period. We may remove content that violates our guidelines. See detailed policies for prohibited content, takedown,
            and dispute procedures.
          </p>
          <p>
            Data: We store account data and generation metadata to operate the service. Media may be stored in Supabase Storage or
            referenced from external endpoints; we provide signed URLs where applicable. See our Privacy Policy for retention and
            access details.
          </p>
          <div className="flex flex-wrap gap-4">
            <a className="underline hover:opacity-80" href="#" onClick={(e)=> e.preventDefault()}>Full Terms of Service</a>
            <a className="underline hover:opacity-80" href="#" onClick={(e)=> e.preventDefault()}>Privacy Policy</a>
            <a className="underline hover:opacity-80" href="#" onClick={(e)=> e.preventDefault()}>Refund Policy</a>
          </div>
        </section>
      </section>
    </main>
  );
}
