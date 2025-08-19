#!/usr/bin/env node

// Direct Supabase debugging script to check user credits
const { createClient } = require('@supabase/supabase-js');

// Environment variables from .env.local
const supabaseUrl = 'https://tnlftxudmiryrgkajfun.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk5NDE4MSwiZXhwIjoyMDcwNTcwMTgxfQ.80sKPr0NTPuGCwKhm3VZisadRdU1aQLkHFgfokyQcIk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const userId = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';  // Active user from logs

async function debugCreditsSystem() {
    console.log('🔍 COMPREHENSIVE CREDIT SYSTEM ANALYSIS');
    console.log('==========================================');
    console.log(`Analyzing user: ${userId}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('');

    try {
        // 1. Check user_credits table
        console.log('1️⃣ USER CREDITS TABLE:');
        console.log('------------------------');
        const { data: userCredits, error: creditsError } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', userId);
        
        if (creditsError) {
            console.log('❌ Error fetching user_credits:', creditsError.message);
        } else {
            console.log('✅ User credits data:', JSON.stringify(userCredits, null, 2));
        }
        console.log('');

        // 2. Check user_billing table
        console.log('2️⃣ USER BILLING TABLE:');
        console.log('------------------------');
        const { data: userBilling, error: billingError } = await supabase
            .from('user_billing')
            .select('*')
            .eq('user_id', userId);
        
        if (billingError) {
            console.log('❌ Error fetching user_billing:', billingError.message);
        } else {
            console.log('✅ User billing data:', JSON.stringify(userBilling, null, 2));
        }
        console.log('');

        // 3. Check plan_credits table
        console.log('3️⃣ PLAN CREDITS TABLE:');
        console.log('------------------------');
        const { data: planCredits, error: planError } = await supabase
            .from('plan_credits')
            .select('*');
        
        if (planError) {
            console.log('❌ Error fetching plan_credits:', planError.message);
        } else {
            console.log('✅ Plan credits data:', JSON.stringify(planCredits, null, 2));
        }
        console.log('');

        // 4. Test RPC functions
        console.log('4️⃣ TESTING RPC FUNCTIONS:');
        console.log('---------------------------');
        
        // Test daily grant function
        try {
            const { data: grantResult, error: grantError } = await supabase.rpc('grant_daily_credits_if_needed', {
                p_user_id: userId,
                p_amount: 1666  // one z plan amount
            });
            
            if (grantError) {
                console.log('❌ grant_daily_credits_if_needed error:', grantError.message);
            } else {
                console.log('✅ grant_daily_credits_if_needed result:', JSON.stringify(grantResult, null, 2));
            }
        } catch (e) {
            console.log('❌ grant_daily_credits_if_needed exception:', e.message);
        }
        
        // Test add credits function
        try {
            const { data: addResult, error: addError } = await supabase.rpc('add_credits_simple', {
                p_user_id: userId,
                p_amount: 100  // Add 100 credits as test
            });
            
            if (addError) {
                console.log('❌ add_credits_simple error:', addError.message);
            } else {
                console.log('✅ add_credits_simple result (new balance):', addResult);
            }
        } catch (e) {
            console.log('❌ add_credits_simple exception:', e.message);
        }
        console.log('');

        // 5. Fix the user - set correct credits for one z plan
        console.log('5️⃣ APPLYING FIX:');
        console.log('------------------');
        
        // Update user_credits to 1666
        const { data: updateCreditsResult, error: updateCreditsError } = await supabase
            .from('user_credits')
            .upsert({ 
                user_id: userId, 
                credits: 1666,
                updated_at: new Date().toISOString(),
                last_daily_topup_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select();
        
        if (updateCreditsError) {
            console.log('❌ Error updating user_credits:', updateCreditsError.message);
        } else {
            console.log('✅ Updated user_credits:', JSON.stringify(updateCreditsResult, null, 2));
        }
        
        // Update user_billing to ensure active status and one z plan
        const { data: updateBillingResult, error: updateBillingError } = await supabase
            .from('user_billing')
            .upsert({
                user_id: userId,
                plan: 'one z',
                status: 'active',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select();
        
        if (updateBillingError) {
            console.log('❌ Error updating user_billing:', updateBillingError.message);
        } else {
            console.log('✅ Updated user_billing:', JSON.stringify(updateBillingResult, null, 2));
        }
        console.log('');

        // 6. Final verification
        console.log('6️⃣ FINAL VERIFICATION:');
        console.log('------------------------');
        
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
        
        console.log('✅ Final user_credits:', JSON.stringify(finalCredits, null, 2));
        console.log('✅ Final user_billing:', JSON.stringify(finalBilling, null, 2));
        console.log('');
        
        console.log('🎉 ANALYSIS COMPLETE!');
        console.log('=======================');
        console.log('The user should now see 1666 credits with "one z" plan active status.');
        console.log('Visit the app to verify the fix worked.');
        
    } catch (error) {
        console.error('💥 Fatal error during analysis:', error);
    }
}

// Run the analysis
debugCreditsSystem().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('💥 Script failed:', err);
    process.exit(1);
});
