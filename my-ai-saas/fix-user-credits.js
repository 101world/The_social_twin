// Simple script to fix user credits directly
const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment check:');
console.log('SUPABASE_URL exists:', !!supabaseUrl);
console.log('SERVICE_KEY exists:', !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const userId = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';

async function fixUserCredits() {
    try {
        console.log(`\n=== Fixing Credits for User: ${userId} ===`);
        
        // First, check current state
        console.log('\n1. Checking current user_credits...');
        const { data: credits, error: creditsError } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (creditsError) {
            console.log('Credits error:', creditsError.message);
        } else {
            console.log('Current credits:', credits);
        }
        
        // Check billing
        console.log('\n2. Checking user_billing...');
        const { data: billing, error: billingError } = await supabase
            .from('user_billing')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (billingError) {
            console.log('Billing error:', billingError.message);
        } else {
            console.log('Current billing:', billing);
        }
        
        // Update credits to 1666 (one z plan)
        console.log('\n3. Setting credits to 1666...');
        const { data: updateCredits, error: updateError } = await supabase
            .from('user_credits')
            .upsert({ 
                user_id: userId, 
                credits: 1666,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select();
        
        if (updateError) {
            console.log('Update credits error:', updateError.message);
        } else {
            console.log('Credits updated successfully:', updateCredits);
        }
        
        // Update billing to active if needed
        console.log('\n4. Ensuring billing status is active...');
        const { data: updateBilling, error: updateBillingError } = await supabase
            .from('user_billing')
            .upsert({
                user_id: userId,
                plan: 'one z',
                status: 'active',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select();
        
        if (updateBillingError) {
            console.log('Update billing error:', updateBillingError.message);
        } else {
            console.log('Billing updated successfully:', updateBilling);
        }
        
        // Final verification
        console.log('\n5. Final verification...');
        const { data: finalCredits } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        const { data: finalBilling } = await supabase
            .from('user_billing')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        console.log('Final credits:', finalCredits);
        console.log('Final billing:', finalBilling);
        
        console.log('\n✅ Fix completed! User should now see 1666 credits.');
        
    } catch (error) {
        console.error('Error fixing user credits:', error);
    }
}

fixUserCredits();
