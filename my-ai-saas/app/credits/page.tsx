import CreditTable from '@/components/CreditTable';

export default function CreditSystemPage() {
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            💳 Credit System Overview
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Complete breakdown of all available functions, their credit costs, 
            subscription plans, and usage calculator to help you plan your AI generations.
          </p>
        </div>

        {/* Main Credit Table */}
        <div className="mb-8">
          <CreditTable showCalculator={true} />
        </div>

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🔄 How Credits Work
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-gray-500 rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Monthly Wallet:</strong> Your plan grants a monthly credits wallet. When it’s used up, upgrade to continue.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Real-time Deduction:</strong> Credits are deducted instantly when you use any AI function
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Transparent Pricing:</strong> Each function has a fixed credit cost with no hidden fees
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Usage Tracking:</strong> Monitor your credit consumption with detailed analytics
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              💡 Optimization Tips
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Plan Efficiently:</strong> Use the calculator above to estimate your monthly needs
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-gray-500 rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Start Small:</strong> Text generation (1 credit) is perfect for testing ideas
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Batch Operations:</strong> Group similar tasks to maximize efficiency
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></span>
                <div>
                  <strong>Export Wisely:</strong> PDF exports are just 1 credit - perfect for sharing
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Comparison */}
        <div className="mt-8 bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">📊 Usage Examples</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl mb-2">🎨</div>
              <div className="font-semibold text-gray-800">Creative Package</div>
              <div className="text-sm text-gray-600 mt-2">
                10 Images + 5 Modifications + 2 Videos + 10 PDFs
              </div>
              <div className="text-lg font-bold text-gray-800 mt-2">
                85 credits/day
              </div>
              <div className="text-xs text-gray-600">
                Needs: One S plan or higher
              </div>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl mb-2">📝</div>
              <div className="font-semibold text-gray-800">Content Creator</div>
              <div className="text-sm text-gray-600 mt-2">
                50 Texts + 20 Images + 1 Video + 20 PDFs
              </div>
              <div className="text-lg font-bold text-gray-800 mt-2">
                180 credits/day
              </div>
              <div className="text-xs text-gray-600">
                Needs: One XT plan or higher
              </div>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl mb-2">🎬</div>
              <div className="font-semibold text-gray-800">Video Producer</div>
              <div className="text-sm text-gray-600 mt-2">
                100 Videos + 50 Images + 100 Texts + 50 PDFs
              </div>
              <div className="text-lg font-bold text-gray-800 mt-2">
                1,400 credits/day
              </div>
              <div className="text-xs text-gray-600">
                Needs: One Z plan (premium)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
