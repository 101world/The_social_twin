'use client';

import { useState } from 'react';

interface CreditFunction {
  name: string;
  cost: number;
  description: string;
  category: 'Generation' | 'Export' | 'Processing';
  icon: string;
}

const CREDIT_FUNCTIONS: CreditFunction[] = [
  {
    name: 'Text Generation',
    cost: 1,
    description: 'AI-powered text generation via RunPod',
    category: 'Generation',
    icon: '📝'
  },
  {
    name: 'Image Generation',
    cost: 5,
    description: 'AI image creation using advanced models',
    category: 'Generation',
    icon: '🎨'
  },
  {
    name: 'Video Generation',
    cost: 10,
    description: 'AI video creation and synthesis',
    category: 'Generation',
    icon: '🎬'
  },
  {
    name: 'Video Compiling',
    cost: 3,
    description: 'Compile multiple videos into a single video',
    category: 'Processing',
    icon: '🎞️'
  },
  {
    name: 'Image Modification',
    cost: 3,
    description: 'AI-powered image editing and enhancement',
    category: 'Processing',
    icon: '🖼️'
  },
  {
    name: 'PDF Export',
    cost: 1,
    description: 'Export your content as PDF document',
    category: 'Export',
    icon: '📄'
  }
];

const SUBSCRIPTION_PLANS = [
  { name: 'One T', monthlyCredits: 1120, price: '$19', dailyCredits: 37, color: 'bg-blue-100 text-blue-800' },
  { name: 'One Z', monthlyCredits: 4050, price: '$79', dailyCredits: 135, color: 'bg-yellow-100 text-yellow-800' },
  { name: 'One Pro', monthlyCredits: 8700, price: '$149', dailyCredits: 290, color: 'bg-purple-100 text-purple-800' }
];

interface CreditTableProps {
  darkMode?: boolean;
  showCalculator?: boolean;
}

export default function CreditTable({ darkMode = false, showCalculator = false }: CreditTableProps) {
  const [selectedPlan, setSelectedPlan] = useState('One Z');
  const [usage, setUsage] = useState({
    text: 0,
    image: 0,
    video: 0,
    videoCompile: 0,
    imageModify: 0,
    pdfExport: 0
  });

  const selectedPlanData = SUBSCRIPTION_PLANS.find(p => p.name === selectedPlan);
  const dailyCredits = selectedPlanData?.monthlyCredits || 1120; // Use monthly credits for calculator

  const calculateUsage = () => {
    const costs = {
      text: 1,
      image: 5,
      video: 10,
      videoCompile: 3,
      imageModify: 3,
      pdfExport: 1
    };

    const totalCost = Object.entries(usage).reduce((total, [key, count]) => {
      return total + (costs[key as keyof typeof costs] * count);
    }, 0);

    return {
      totalCost,
      remaining: dailyCredits - totalCost,
      canAfford: totalCost <= dailyCredits
    };
  };

  const usageStats = calculateUsage();

  return (
    <div className={`p-6 rounded-lg border ${
      darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'
    }`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">💳 Credit System Overview</h2>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Updated pricing model: One T ($19), One Z ($79), One Pro ($149) with monthly credit allocation
        </p>
      </div>

      {/* Functions Table */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Available Functions</h3>
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse ${
            darkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <thead>
              <tr className={`${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <th className="text-left p-3 border-b font-medium">Function</th>
                <th className="text-left p-3 border-b font-medium">Cost</th>
                <th className="text-left p-3 border-b font-medium">Category</th>
                <th className="text-left p-3 border-b font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_FUNCTIONS.map((func, index) => (
                <tr key={index} className={`${
                  darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                } transition-colors`}>
                  <td className="p-3 border-b">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{func.icon}</span>
                      <span className="font-medium">{func.name}</span>
                    </div>
                  </td>
                  <td className="p-3 border-b">
                    <span className="font-bold text-blue-600">
                      {func.cost} credit{func.cost !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="p-3 border-b">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      func.category === 'Generation' ? 'bg-green-100 text-green-800' :
                      func.category === 'Processing' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {func.category}
                    </span>
                  </td>
                  <td className={`p-3 border-b text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {func.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Plans */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Subscription Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`p-4 rounded-lg border ${
                darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className={`px-2 py-1 rounded-full text-xs font-medium mb-2 inline-block ${plan.color}`}>
                {plan.name}
              </div>
              <div className="text-2xl font-bold">{plan.monthlyCredits.toLocaleString()}</div>
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                credits/month
              </div>
              <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {plan.price}/month
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Calculator */}
      {showCalculator && (
        <div className={`p-4 rounded-lg border ${
          darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
        }`}>
          <h3 className="text-lg font-semibold mb-4">💡 Usage Cost Calculator</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Plan:</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className={`px-3 py-2 rounded border ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            >
              {SUBSCRIPTION_PLANS.map(plan => (
                <option key={plan.name} value={plan.name}>
                  {plan.name} ({plan.price}/month - {plan.monthlyCredits.toLocaleString()} credits)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
            {CREDIT_FUNCTIONS.map((func, index) => {
              const usageKeys = ['text', 'image', 'video', 'videoCompile', 'imageModify', 'pdfExport'] as const;
              const mappedKey = usageKeys[index] || 'text';
              
              return (
                <div key={func.name} className="space-y-2">
                  <label className="block text-sm font-medium">
                    {func.icon} {func.name}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={usage[mappedKey]}
                    onChange={(e) => setUsage(prev => ({
                      ...prev,
                      [mappedKey]: parseInt(e.target.value) || 0
                    }))}
                    className={`w-full px-2 py-1 rounded border text-sm ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                  />
                  <div className="text-xs text-blue-600">
                    {func.cost} × {usage[mappedKey]} = {func.cost * usage[mappedKey]} credits
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`p-3 rounded-lg ${
            usageStats.canAfford ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className="flex justify-between items-center">
              <span className="font-medium">
                {usageStats.canAfford ? '✅ Within monthly allowance' : '⚠️ Exceeds monthly allowance'}
              </span>
              <span className="font-bold">
                {usageStats.totalCost} credits
              </span>
            </div>
            <div className="text-sm mt-1">
              {usageStats.canAfford 
                ? `You have ${usageStats.remaining} credits remaining this month`
                : `You need ${Math.abs(usageStats.remaining)} more credits`
              }
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-3 rounded-lg text-center ${
          darkMode ? 'bg-gray-800' : 'bg-gray-50'
        }`}>
          <div className="text-2xl font-bold text-blue-600">{CREDIT_FUNCTIONS.length}</div>
          <div className="text-xs">Total Functions</div>
        </div>
        <div className={`p-3 rounded-lg text-center ${
          darkMode ? 'bg-gray-800' : 'bg-gray-50'
        }`}>
          <div className="text-2xl font-bold text-green-600">
            {Math.min(...CREDIT_FUNCTIONS.map(f => f.cost))}
          </div>
          <div className="text-xs">Min Cost</div>
        </div>
        <div className={`p-3 rounded-lg text-center ${
          darkMode ? 'bg-gray-800' : 'bg-gray-50'
        }`}>
          <div className="text-2xl font-bold text-purple-600">
            {Math.max(...CREDIT_FUNCTIONS.map(f => f.cost))}
          </div>
          <div className="text-xs">Max Cost</div>
        </div>
        <div className={`p-3 rounded-lg text-center ${
          darkMode ? 'bg-gray-800' : 'bg-gray-50'
        }`}>
          <div className="text-2xl font-bold text-yellow-600">100,000</div>
          <div className="text-xs">Max Monthly (One Pro)</div>
        </div>
      </div>
    </div>
  );
}
