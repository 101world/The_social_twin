"use client";

import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const plans = [
  {
    id: 'basic',
    name: 'Basic Plan',
    price: 99,
    credits: 100,
    description: '100 AI generations'
  },
  {
    id: 'pro', 
    name: 'Pro Plan',
    price: 499,
    credits: 500,
    description: '500 AI generations + Priority support'
  },
  {
    id: 'premium',
    name: 'Premium Plan', 
    price: 999,
    credits: 1200,
    description: '1200 AI generations + Priority support + Advanced features'
  }
];

export default function RazorpayTestPage() {
  const { userId } = useAuth();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserInfo = async () => {
    if (!userId) return;
    
    setRefreshing(true);
    try {
      const response = await fetch('/api/user/credits');
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, [userId]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async (plan: typeof plans[0]) => {
    if (!userId) {
      setResult('Please sign in to make a payment');
      return;
    }

    setLoading(true);
    setResult('');

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay script');
      }

      // Create order
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: plan.price,
          currency: 'INR',
          planId: plan.id,
        }),
      });

      if (!orderResponse.ok) {
        const error = await orderResponse.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const orderData = await orderResponse.json();

      // Open Razorpay checkout
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'ONE AI',
        description: plan.description,
        order_id: orderData.orderId,
        prefill: {
          name: user?.fullName || '',
          email: user?.primaryEmailAddress?.emailAddress || '',
        },
        theme: {
          color: '#ff8a00'
        },
        handler: async function (response: any) {
          try {
            // Verify payment
            const verifyResponse = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: plan.id,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              setResult(`✅ Payment successful! ${verifyData.creditsAdded} credits added. Total credits: ${verifyData.totalCredits || 'Unknown'}`);
              // Refresh user info
              setTimeout(fetchUserInfo, 1000);
            } else {
              setResult(`❌ Payment verification failed: ${verifyData.error}`);
            }
          } catch (error: any) {
            setResult(`❌ Payment verification error: ${error.message}`);
          }
        },
        modal: {
          ondismiss: function() {
            setResult('❌ Payment cancelled by user');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error: any) {
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Please sign in to test payments</h1>
          <a href="/sign-in" className="text-orange-500 hover:text-orange-400">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Razorpay Integration Test
        </h1>
        
        {/* Current User Info */}
        <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Your Account</h3>
            <button
              onClick={fetchUserInfo}
              disabled={refreshing}
              className="text-orange-500 hover:text-orange-400 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-neutral-400">Current Credits</p>
              <p className="text-2xl font-bold text-orange-500">
                {userInfo?.credits || 0}
              </p>
            </div>
            <div>
              <p className="text-neutral-400">Recent Payments</p>
              <p className="text-lg">
                {userInfo?.recentPayments?.length || 0} transactions
              </p>
            </div>
          </div>
          {userInfo?.recentPayments && userInfo.recentPayments.length > 0 && (
            <div className="mt-4">
              <p className="text-neutral-400 mb-2">Last Payment:</p>
              <p className="text-sm">
                ₹{userInfo.recentPayments[0].amount} - {userInfo.recentPayments[0].status} 
                ({new Date(userInfo.recentPayments[0].created_at).toLocaleDateString()})
              </p>
            </div>
          )}
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className="bg-neutral-900 rounded-lg p-6 border border-neutral-800"
            >
              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold text-orange-500 mb-2">
                ₹{plan.price}
              </div>
              <p className="text-neutral-400 mb-4">{plan.description}</p>
              <div className="text-sm text-neutral-300 mb-4">
                Credits: {plan.credits}
              </div>
              <button
                onClick={() => handlePayment(plan)}
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-white py-2 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Processing...' : `Buy ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {result && (
          <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800">
            <h3 className="text-lg font-semibold mb-2">Result:</h3>
            <p className="text-neutral-300">{result}</p>
          </div>
        )}

        <div className="mt-8 bg-neutral-900 rounded-lg p-6 border border-neutral-800">
          <h3 className="text-lg font-semibold mb-4">Test Instructions:</h3>
          <ul className="space-y-2 text-neutral-300">
            <li>• You need to set up your Razorpay test credentials in .env.local</li>
            <li>• Create a Razorpay account and get test API keys</li>
            <li>• Use Razorpay test card: 4111 1111 1111 1111</li>
            <li>• Any expiry date in the future and any CVV (e.g., 123)</li>
            <li>• Run the SQL schema file to create the user_payments table</li>
            <li>• Check the browser console for detailed logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
