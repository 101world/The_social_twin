import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import HourlyUsageDashboard from '@/components/HourlyUsageDashboard-clean';

// ============================================
// HOURLY USAGE PAGE
// Pay-per-hour billing dashboard for advanced users
// Route: /hourly-usage
// ============================================
export default async function HourlyUsagePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <HourlyUsageDashboard />
      </div>
    </div>
  );
}
