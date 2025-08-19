import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    
    // First, let's find the user by email in Clerk's user data
    // Since we don't have direct access to Clerk user table, we'll search by user_id patterns
    // But let's check what we can find in our tables
    
    const results: any = {
      email: email,
      searchResults: {},
      timestamp: new Date().toISOString()
    };

    // Check user_credits table for any users
    try {
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*');
      
      results.searchResults.user_credits = {
        success: !creditsError,
        error: creditsError?.message,
        data: creditsData,
        count: creditsData?.length || 0
      };
    } catch (e) {
      results.searchResults.user_credits = { error: (e as Error).message };
    }

    // Check user_billing table
    try {
      const { data: billingData, error: billingError } = await supabase
        .from('user_billing')
        .select('*');
      
      results.searchResults.user_billing = {
        success: !billingError,
        error: billingError?.message,
        data: billingData,
        count: billingData?.length || 0
      };
    } catch (e) {
      results.searchResults.user_billing = { error: (e as Error).message };
    }

    // Check generations table
    try {
      const { data: generationsData, error: generationsError } = await supabase
        .from('generations')
        .select('user_id, type, created_at')
        .limit(20);
      
      results.searchResults.generations = {
        success: !generationsError,
        error: generationsError?.message,
        data: generationsData,
        count: generationsData?.length || 0
      };
    } catch (e) {
      results.searchResults.generations = { error: (e as Error).message };
    }

    // Check chat_topics to see user IDs
    try {
      const { data: topicsData, error: topicsError } = await supabase
        .from('chat_topics')
        .select('user_id, title, created_at')
        .limit(20);
      
      results.searchResults.chat_topics = {
        success: !topicsError,
        error: topicsError?.message,
        data: topicsData,
        count: topicsData?.length || 0
      };
    } catch (e) {
      results.searchResults.chat_topics = { error: (e as Error).message };
    }

    // Check if we can find any reference to the email in user_id fields
    // Clerk user IDs are usually like "user_2ABC123XYZ" format
    const possibleUserIds = [
      email,
      email.split('@')[0], // username part
      `user_${email.split('@')[0]}`, // with user_ prefix
    ];

    for (const userId of possibleUserIds) {
      try {
        const { data: specificUser, error } = await supabase
          .from('user_credits')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (specificUser && !error) {
          results.foundUser = {
            userId: userId,
            credits: specificUser
          };
          break;
        }
      } catch (e) {
        // Continue searching
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    return NextResponse.json({ 
      error: 'Database query failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}
