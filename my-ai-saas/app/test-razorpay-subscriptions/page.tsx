"use client";

import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';

// Plan interfaces
interface Plan {
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
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function TestRazorpaySubscriptions() {
  const { userId } = useAuth();
  const { user } = useUser();
  const [plans, setPlans] = useState<SubscriptionPlans | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [testResult, setTestResult] = useState<string>('');

  // Load available plans
  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await fetch('/api/razorpay/create-subscription');
        const data = await response.json();
        setPlans(data.plans);
        setTestResult(`✅ Plans loaded successfully: ${Object.keys(data.plans).length} plans available`);
      } catch (error: any) {
        setTestResult(`❌ Failed to load plans: ${error.message}`);
        console.error('Failed to load plans:', error);
      }
    }
    loadPlans();
  }, []);

  // Load user info
  const loadUserInfo = async () => {
    if (!userId) return;
    try {
      const response = await fetch('/api/user/credits');
      const data = await response.json();
      setUserInfo(data);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  useEffect(() => {
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

  const testSubscription = async (planId: string) => {
    if (!userId) {
      setTestResult('❌ Please sign in to test subscriptions');
      return;
    }

    setLoading(true);
    setSelectedPlan(planId);
    setTestResult('🔄 Creating subscription...');

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay script');
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

      setTestResult(`✅ Subscription created successfully!\nID: ${data.subscription.id}\nAmount: ₹${data.plan.price_inr}`);

      const plan = plans?.[planId as keyof SubscriptionPlans];
      if (!plan) throw new Error('Plan not found');

      // Open Razorpay subscription checkout
      const options = {
        key: data.subscription.razorpay_key,
        subscription_id: data.subscription.id,
        name: 'ONE AI - Test Mode',
        description: `${plan.description} (Test)`,
        prefill: {
          name: user?.fullName || '',
          email: user?.primaryEmailAddress?.emailAddress || '',
        },
        theme: {
          color: '#ff8a00'
        },
        handler: function (response: any) {
          setTestResult(`🎉 Test Payment Successful!\nSubscription ID: ${response.razorpay_subscription_id}\nPayment ID: ${response.razorpay_payment_id}\nSignature: ${response.razorpay_signature?.substring(0, 20)}...`);
          // Refresh user info
          setTimeout(() => {
            loadUserInfo();
          }, 2000);
        },
        modal: {
          ondismiss: function() {
            setTestResult('⚠️ Payment modal closed by user');
            setLoading(false);
            setSelectedPlan('');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error: any) {
      setTestResult(`❌ Test failed: ${error.message}`);
      console.error('Subscription test error:', error);
    } finally {
      setLoading(false);
      setSelectedPlan('');
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Please sign in to test Razorpay subscriptions</h1>
          <a href="/sign-in" className="text-gray-500 hover:text-gray-400">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          🧪 Razorpay Monthly Subscriptions Test
        </h1>

        {/* Test Status */}
        <div className="bg-neutral-900 rounded-lg p-6 mb-8 border border-neutral-800">
          <h3 className="text-lg font-semibold mb-4">Test Status</h3>
          <div className="bg-neutral-800 rounded p-4 font-mono text-sm whitespace-pre-wrap">
            {testResult || 'Ready for testing...'}
          </div>
        </div>

        {/* User Info */}
        {userInfo && (
          <div className="bg-neutral-900 rounded-lg p-6 mb-8 border border-neutral-800">
            <h3 className="text-lg font-semibold mb-4">Current User Status</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-neutral-400">Credits Balance</p>
                <p className="text-2xl font-bold text-gray-500">
                  {userInfo.credits?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-neutral-400">Current Plan</p>
                <p className="text-lg font-semibold">
                  {userInfo.subscription_plan || 'No active subscription'}
                </p>
              </div>
              <div>
                <p className="text-neutral-400">Status</p>
                <p className={`text-lg font-semibold ${
                  userInfo.subscription_active ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {userInfo.subscription_active ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Test Environment Info */}
        <div className="bg-gray-900/20 border border-gray-500/50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-400">🔧 Test Environment</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-300">Razorpay Key ID:</p>
              <p className="font-mono">rzp_test_R7CcdMXFPJJh8H</p>
            </div>
            <div>
              <p className="text-gray-300">Webhook Secret:</p>
              <p className="font-mono">Patnibillions09!</p>
            </div>
            <div>
              <p className="text-gray-300">Test Cards:</p>
              <p className="font-mono">4111 1111 1111 1111 (Visa)</p>
            </div>
            <div>
              <p className="text-gray-300">CVV & Expiry:</p>
              <p className="font-mono">Any future date, CVV: 123</p>
            </div>
          </div>
        </div>

        {/* Test Plans */}
        {plans && (
          <div className="bg-neutral-900 rounded-lg p-6 mb-8 border border-neutral-800">
            <h3 className="text-lg font-semibold mb-6">Available Test Plans</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {Object.entries(plans).map(([planId, plan]) => {
                const isPopular = planId === 'one_z';
                const isLoading = loading && selectedPlan === planId;
                
                return (
                  <div
                    key={planId}
                    className={`relative rounded-lg p-6 border-2 transition-all ${
                      isPopular 
                        ? 'border-gray-500 bg-gray-500/10' 
                        : 'border-neutral-700 bg-neutral-800'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gray-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                          MOST POPULAR
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-4">
                      <h4 className="text-xl font-bold mb-2">{plan.name}</h4>
                      <div className="mb-2">
                        <div className="text-2xl font-bold text-gray-400">
                          ₹{plan.inr_price.toLocaleString()}
                        </div>
                        <div className="text-sm text-neutral-400">
                          ${plan.usd_price}/month
                        </div>
                      </div>
                      <p className="text-sm text-neutral-400">{plan.description}</p>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex items-center">
                        <span className="text-gray-400 mr-2">✓</span>
                        {plan.credits.toLocaleString()} credits monthly
                      </div>
                      <div className="flex items-center">
                        <span className="text-green-400 mr-2">✓</span>
                        ≈ {Math.floor(plan.credits / 5).toLocaleString()} images
                      </div>
                      <div className="flex items-center">
                        <span className="text-green-400 mr-2">✓</span>
                        ≈ {Math.floor(plan.credits / 10).toLocaleString()} videos
                      </div>
                    </div>

                    <button
                      onClick={() => testSubscription(planId)}
                      disabled={loading}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-all ${
                        isPopular
                          ? 'bg-gray-500 hover:bg-gray-600 text-white'
                          : 'bg-neutral-700 hover:bg-neutral-600 text-white'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isLoading ? 'Testing...' : 'Test Subscribe'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!plans && (
          <div className="bg-neutral-900 rounded-lg p-8 border border-neutral-800 text-center">
            <div className="text-lg">Loading test plans...</div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
          <h3 className="text-lg font-semibold mb-4">🧪 Test Instructions</h3>
          <div className="space-y-2 text-sm text-neutral-300">
            <p>1. <strong>Click "Test Subscribe"</strong> on any plan to open Razorpay checkout</p>
            <p>2. <strong>Use test card:</strong> 4111 1111 1111 1111 with any future expiry and CVV 123</p>
            <p>3. <strong>Complete payment</strong> to test the full subscription flow</p>
            <p>4. <strong>Check webhooks</strong> in your Razorpay dashboard to see events</p>
            <p>5. <strong>Verify credits</strong> are granted correctly after payment</p>
            <p className="text-gray-400 mt-4">⚠️ This is TEST MODE - no real money will be charged</p>
          </div>
        </div>
      </div>
    </div>
  );
}
