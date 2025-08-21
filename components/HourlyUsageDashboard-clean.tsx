'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Play, 
  Pause, 
  Square, 
  DollarSign, 
  Zap, 
  Timer,
  CreditCard,
  Activity,
  AlertCircle
} from 'lucide-react';

interface HourlySession {
  id: string;
  status: 'active' | 'paused' | 'completed';
  start_time: string;
  duration_hours: string;
  hours_charged: number;
  cost_so_far: string;
  generations_count: number;
}

interface HourlyBalance {
  current_usd: number;
  current_inr: number;
  total_spent_usd: number;
  total_spent_inr: number;
}

interface TopupOption {
  amount_usd: number;
  amount_inr: number;
  hours: string;
}

// ============================================
// HOURLY USAGE DASHBOARD COMPONENT
// Advanced pay-per-hour billing for unlimited AI
// ============================================
export default function HourlyUsageDashboard() {
  const { user } = useUser();
  const [session, setSession] = useState<HourlySession | null>(null);
  const [balance, setBalance] = useState<HourlyBalance | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [topupOptions, setTopupOptions] = useState<TopupOption[]>([]);

  // Load session status and balance
  const loadSessionStatus = async () => {
    try {
      const response = await fetch('/api/hourly-usage/end');
      const data = await response.json();

      if (data.has_active_session) {
        setSession(data.session);
        setHasActiveSession(true);
      } else {
        setSession(null);
        setHasActiveSession(false);
      }

      setBalance(data.balance);
    } catch (error) {
      console.error('Error loading session status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load balance and top-up options
  const loadBalanceInfo = async () => {
    try {
      const response = await fetch('/api/hourly-usage/topup');
      const data = await response.json();

      setBalance(data.balance);
      setTopupOptions(data.topup_options || []);
    } catch (error) {
      console.error('Error loading balance info:', error);
    }
  };

  // Start hourly session
  const startSession = async () => {
    setActionLoading('start');
    try {
      const response = await fetch('/api/hourly-usage/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        await loadSessionStatus();
        alert('✅ Hourly session started! You now have unlimited AI generations.');
      } else {
        alert(`❌ ${data.error}\nCurrent balance: $${data.current_balance}\nRequired: $${data.required_balance}`);
      }
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start hourly session');
    } finally {
      setActionLoading('');
    }
  };

  // Toggle session (pause/resume)
  const toggleSession = async (action: 'pause' | 'resume') => {
    setActionLoading(action);
    try {
      const response = await fetch('/api/hourly-usage/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await response.json();

      if (data.success) {
        await loadSessionStatus();
        alert(`✅ Session ${action}d successfully!`);
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error(`Error ${action}ing session:`, error);
      alert(`Failed to ${action} session`);
    } finally {
      setActionLoading('');
    }
  };

  // End session
  const endSession = async () => {
    if (!confirm('Are you sure you want to end this hourly session?')) return;

    setActionLoading('end');
    try {
      const response = await fetch('/api/hourly-usage/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        await loadSessionStatus();
        alert(`✅ Session ended!\nDuration: ${data.session_summary.duration_hours} hours\nTotal cost: ${data.session_summary.total_cost}\nRemaining balance: ${data.session_summary.balance_remaining}`);
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Failed to end session');
    } finally {
      setActionLoading('');
    }
  };

  // Handle top-up purchase
  const handleTopup = async (amount: number) => {
    setActionLoading(`topup-${amount}`);
    try {
      const response = await fetch('/api/hourly-usage/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });

      const data = await response.json();

      if (data.success) {
        // Initialize Razorpay checkout
        const options = {
          key: data.razorpay_key,
          amount: data.amount_inr * 100, // Amount in paise
          currency: 'INR',
          name: '101World AI',
          description: `Hourly Usage Balance Top-up: $${amount}`,
          order_id: data.order_id,
          handler: async (response: any) => {
            // Payment successful, reload balance
            await loadBalanceInfo();
            await loadSessionStatus();
            alert(`✅ Balance topped up successfully!\nAdded: $${amount} (₹${data.amount_inr.toLocaleString('en-IN')})`);
          },
          prefill: {
            name: user?.fullName || '',
            email: user?.emailAddresses[0]?.emailAddress || '',
          },
          theme: {
            color: '#3399cc',
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating top-up order:', error);
      alert('Failed to create top-up order');
    } finally {
      setActionLoading('');
    }
  };

  useEffect(() => {
    loadSessionStatus();
    loadBalanceInfo();

    // Auto-refresh every 30 seconds if session is active
    const interval = setInterval(() => {
      if (hasActiveSession) {
        loadSessionStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasActiveSession]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">🚀 ONE MAX Dashboard</h1>
        <p className="text-gray-600 mt-2">Ultra-fast AI generations at $15/hour • 4x faster images • 3x faster videos</p>
      </div>

      {/* Current Balance Card */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Account Balance
          </h2>
        </div>
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${balance?.current_usd?.toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-green-700">
                ₹{balance?.current_inr?.toLocaleString('en-IN') || '0'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Available Balance</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                ${balance?.total_spent_usd?.toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-blue-700">
                ₹{balance?.total_spent_inr?.toLocaleString('en-IN') || '0'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Total Spent</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-3">
              ⏱️ Minimum balance required: <strong>$15.00 (₹1,245)</strong> to start hourly session
            </div>
            <div className="flex flex-wrap gap-2">
              {topupOptions.map((option) => (
                <Button
                  key={option.amount_usd}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTopup(option.amount_usd)}
                  disabled={actionLoading === `topup-${option.amount_usd}`}
                  className="flex-1 min-w-[120px]"
                >
                  {actionLoading === `topup-${option.amount_usd}` ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-1" />
                      ${option.amount_usd}
                    </>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Session or Start Session */}
      {hasActiveSession && session ? (
        <div className="bg-green-50 border border-green-200 rounded-lg shadow-md">
          <div className="p-6 border-b border-green-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Active Hourly Session
              </h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                session.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {session.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Session ID: {session.id.slice(0, 8)}...
            </p>
          </div>
          <div className="p-6">
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-white rounded-lg">
                <Timer className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <div className="font-semibold">{session.duration_hours}h</div>
                <div className="text-xs text-gray-500">Duration</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <div className="font-semibold">{session.cost_so_far}</div>
                <div className="text-xs text-gray-500">Cost So Far</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <Zap className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                <div className="font-semibold">{session.generations_count}</div>
                <div className="text-xs text-gray-500">Generations</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {session.status === 'active' ? (
                <Button
                  onClick={() => toggleSession('pause')}
                  disabled={actionLoading === 'pause'}
                  variant="outline"
                >
                  {actionLoading === 'pause' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Session
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => toggleSession('resume')}
                  disabled={actionLoading === 'resume'}
                  variant="outline"
                >
                  {actionLoading === 'resume' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume Session
                    </>
                  )}
                </Button>
              )}
              
              <Button
                onClick={endSession}
                disabled={actionLoading === 'end'}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {actionLoading === 'end' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    End Session
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>Unlimited AI generations active!</strong> Generate as much as you want while your session is running.
                  Rate: $15/hour with minimum 1-hour billing cycles.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Start ONE MAX Session
            </h2>
            <p className="text-gray-600 mt-1">
              Get unlimited AI generations for $15/hour (minimum 6 hours, ₹90)
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">🚀 ONE MAX Features:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>⚡ Unlimited AI generations</li>
                  <li>🚀 7 seconds per image (4x faster)</li>
                  <li>🎬 150 seconds per video (3x faster)</li>
                  <li>🔄 Pause/Resume anytime</li>
                  <li>⏱️ Minimum 1-hour billing (even for 5 mins usage)</li>
                  <li>💰 6-hour minimum purchase ($90)</li>
                </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="font-semibold text-orange-900 mb-2">💡 How it works:</h4>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• Start session → First hour charged immediately ($15)</li>
                  <li>• Generate unlimited content during active session</li>
                  <li>• Each additional hour auto-charged as you continue</li>
                  <li>• Pause anytime to stop billing</li>
                  <li>• Resume whenever you're ready</li>
                </ul>
              </div>

              {(balance?.current_usd || 0) >= 15 ? (
                <Button
                  onClick={startSession}
                  disabled={actionLoading === 'start'}
                  className="w-full"
                  size="lg"
                >
                  {actionLoading === 'start' ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      Start ONE MAX Session ($15/hour)
                    </>
                  )}
                </Button>
              ) : (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="text-sm text-red-800">
                      <strong>Insufficient balance!</strong> You need at least $15.00 to start an hourly session.
                      Current balance: ${balance?.current_usd?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Load Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    </div>
  );
}
