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
    <main className="relative min-h-screen overflow-hidden bg-black text-white">

      <section className="mx-auto max-w-5xl p-6">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Choose Your AI Plan</h1>
            <p className="opacity-70">Monthly subscriptions or pay-per-use flexibility</p>
            <div className="mt-2 text-sm opacity-70">
              💱 Prices converted from USD to INR (1 USD ≈ ₹83)
            </div>
          </div>
          <div className="text-sm opacity-70">{mounted ? new Date().toLocaleDateString() : ""}</div>
        </header>

        {/* Current Status */}
        {userInfo && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h3 className="text-lg font-semibold mb-4">Current Status</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm opacity-70">Credits Balance</p>
                <p className="text-2xl font-bold text-orange-400">
                  {userInfo.credits?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm opacity-70">Current Plan</p>
                <p className="text-lg font-semibold">
                  {userInfo.subscription_plan || 'No active subscription'}
                </p>
              </div>
              <div>
                <p className="text-sm opacity-70">Status</p>
                <p className={`text-lg font-semibold ${
                  userInfo.subscription_active ? 'text-orange-400' : 'opacity-70'
                }`}>
                  {userInfo.subscription_active ? 'Active' : 'Inactive'}
                </p>
              </div>
              {userBalance && (
                <div>
                  <p className="text-sm opacity-70">ONE MAX Balance</p>
                  <p className="text-lg font-bold text-orange-400">
                    ${userBalance.balance_usd?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs opacity-60">
                    ₹{userBalance.balance_inr?.toFixed(2) || '0.00'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        {plans && (
          <div className="space-y-8">
            {/* Monthly Subscription Plans */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2 text-orange-400">📅 Monthly Subscription Plans</h2>
                <p className="opacity-70">Fixed monthly pricing with credit allocation</p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
              {Object.entries(plans).filter(([planId]) => planId !== 'one_max').map(([planId, plan]) => {
                const isPopular = planId === 'one_z';
                const isLoading = loading && selectedPlan === planId;
                
                return (
                  <div
                    key={planId}
                    className={`relative rounded-xl p-6 border-2 transition-all hover:scale-[1.02] ${
                      isPopular 
                        ? 'border-orange-500/50 bg-white/5' 
                        : 'border-white/20 bg-white/5'
                    }`}
                  >
                    {/* Popular Badge */}
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-orange-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                          MOST POPULAR
                        </span>
                      </div>
                    )}

                    {/* Plan Details */}
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                      <div className="mb-4">
                        <div className="text-2xl font-bold text-orange-400">
                          ₹{plan.inr_price.toLocaleString()}
                        </div>
                        <div className="text-sm opacity-70">
                          ${plan.usd_price}/month
                        </div>
                      </div>
                      <p className="text-sm opacity-70">{plan.description}</p>
                    </div>

                    {/* Features */}
                    <div className="space-y-2 mb-6 text-sm">
                      <div className="flex items-center">
                        <span className="text-orange-400 mr-2">✓</span>
                        {plan.credits.toLocaleString()} AI credits monthly
                      </div>
                      <div className="flex items-center">
                        <span className="text-orange-400 mr-2">✓</span>
                        Text, Image & Video generation
                      </div>
                      <div className="flex items-center">
                        <span className="text-orange-400 mr-2">✓</span>
                        PDF export & Video compilation
                      </div>
                      <div className="flex items-center">
                        <span className="text-orange-400 mr-2">✓</span>
                        Priority support
                      </div>
                      {planId === 'one_pro' && (
                        <div className="flex items-center">
                          <span className="text-orange-400 mr-2">✓</span>
                          API access & Advanced features
                        </div>
                      )}
                    </div>

                    {/* Subscribe Button */}
                    <button
                      onClick={() => handleSubscribe(planId)}
                      disabled={loading}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-all ${
                        'bg-orange-500 hover:bg-orange-600 text-black'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isLoading ? 'Processing...' : 'Subscribe Now'}
                    </button>
                    {lastError && selectedPlan === planId && (
                      <div className="mt-2 text-xs text-red-400">{lastError}</div>
                    )}

                    {/* Exact Limits Breakdown */}
                    <div className="mt-3 text-xs opacity-70 text-center space-y-1">
                      {planId === 'one_t' && (
                        <>
                          <div className="font-semibold text-orange-400">✓ 200 images per month</div>
                          <div className="font-semibold text-orange-400">✓ 12 videos per month</div>
                          <div className="text-xs opacity-50">= 1,120 total credits</div>
                        </>
                      )}
                      {planId === 'one_z' && (
                        <>
                          <div className="font-semibold text-orange-400">✓ 700 images per month</div>
                          <div className="font-semibold text-orange-400">✓ 55 videos per month</div>
                          <div className="text-xs opacity-50">= 4,050 total credits</div>
                        </>
                      )}
                      {planId === 'one_pro' && (
                        <>
                          <div className="font-semibold text-orange-400">✓ 1,500 images per month</div>
                          <div className="font-semibold text-orange-400">✓ 120 videos per month</div>
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
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur-xl ring-1 ring-white/10 hover:ring-white/20 transition">
              <div className="grid md:grid-cols-2 gap-6 items-center">
                {/* 1:1 visual tile */}
                <div className="flex md:justify-start justify-center">
                  <div className="aspect-square w-48 md:w-64 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center shadow-inner shadow-black/40">
                    <div className="text-center">
                      <div className="text-4xl md:text-5xl mb-2">⚡</div>
                      <div className="text-sm opacity-70">Pay per use</div>
                    </div>
                  </div>
                </div>

                {/* Copy + Balance + CTA */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold text-orange-400">ONE MAX</h2>
                    {userBalance && (
                      <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/15 bg-white/5">
                        Balance: <span className="text-orange-400 font-semibold">${userBalance.balance_usd?.toFixed(2) || '0.00'}</span>
                      </span>
                    )}
                  </div>
                  <p className="opacity-80 mb-4">Top up anytime. No monthly fees. Designed for flexible, on-demand creativity.</p>

                  <div className="mb-4 flex flex-wrap gap-2 text-xs opacity-85">
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">No lock‑in</span>
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">Instant top‑ups</span>
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">Usage analytics</span>
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">Priority routing</span>
                  </div>

                  {/* Amount presets */}
                  <div className="mb-4 flex items-center gap-2">
                    {[10, 25, 50, 100].map((v) => (
                      <button
                        key={v}
                        onClick={() => setTopupAmount(v)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                          topupAmount === v ? 'border-orange-400 text-orange-400' : 'border-white/15 text-white/80 hover:border-white/30'
                        }`}
                        type="button"
                      >
                        ${v}
                      </button>
                    ))}
                    <div className="ml-2 flex items-center gap-2">
                      <span className="text-sm opacity-70">Custom</span>
                      <input
                        type="number"
                        min={5}
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(Number(e.target.value))}
                        className="w-24 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-sm outline-none focus:border-orange-400"
                      />
                    </div>
                  </div>

                  {userBalance?.needs_topup && (
                    <div className="mb-3 text-[12px] text-red-400">Low balance • Add funds to continue generating</div>
                  )}

                  <button
                    onClick={() => handleSubscribe('one_max')}
                    disabled={loading}
                    className="group inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-black bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 shadow-lg shadow-orange-500/20 ring-1 ring-orange-300/30 transition disabled:opacity-50"
                  >
                    {loading && selectedPlan === 'one_max' ? 'Processing…' : `Add $${Math.max(5, Number(topupAmount) || 0)}`}
                    <span className="opacity-80 transition-transform group-hover:translate-x-0.5">→</span>
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
