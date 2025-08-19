// Fix billing data for the signed-in user
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixBillingData() {
    try {
        console.log('=== Fixing Billing Data ===');
        
        // You need to replace this with your actual Clerk userId
        // Check your browser dev tools or the logs to get your userId
        const userId = 'user_31COJVefTvqeXiOEb4SuFgwKHfD'; // Replace with your actual userId
        
        console.log(`Setting up billing for user: ${userId}`);
        
        // Update user_billing table with One Z plan
        const { data: billing, error: billingError } = await supabase
            .from('user_billing')
            .upsert({
                user_id: userId,
                plan: 'one z',
                status: 'active',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select();
        
        if (billingError) {
            console.error('Billing update error:', billingError);
            return;
        }
        
        console.log('✅ Billing updated:', billing);
        
        // Update user_credits with proper credits
        const { data: credits, error: creditsError } = await supabase
            .from('user_credits')
            .upsert({
                user_id: userId,
                credits: 1666, // One Z daily allowance
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select();
        
        if (creditsError) {
            console.error('Credits update error:', creditsError);
            return;
        }
        
        console.log('✅ Credits updated:', credits);
        
        console.log('\n🎉 Done! Refresh your app to see 1666 credits and "one z" plan.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixBillingData();
