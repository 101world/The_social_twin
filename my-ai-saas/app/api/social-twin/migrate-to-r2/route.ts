import { NextRequest } from 'next/server';
import { uploadUrlToR2 } from '@/lib/r2-upload';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, force = false } = await req.json();

    console.log('🔄 Starting R2 migration for user:', userId);

    // Get all generations with non-R2 URLs
    const { data: generations, error } = await supabase
      .from('social_twin_generations')
      .select('*')
      .eq('user_id', userId)
      .not('result_url', 'ilike', '%r2.cloudflarestorage.com%')
      .not('result_url', 'is', null);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`📁 Found ${generations.length} generations to migrate`);

    let migrated = 0;
    let failed = 0;

    for (const gen of generations) {
      try {
        // Skip if already has R2 URL and not forcing
        if (!force && (gen.r2_url || gen.result_url?.includes('r2.cloudflarestorage.com'))) {
          continue;
        }

        console.log(`🔄 Migrating generation ${gen.id}...`);

        // Determine file type
        const isVideo = gen.generation_type?.includes('video') || gen.result_url?.includes('.mp4');
        const extension = isVideo ? 'mp4' : 'png';
        const prefix = isVideo ? 'videos' : 'images';

        // Upload to R2
        const r2Url = await uploadUrlToR2(
          gen.result_url,
          userId,
          prefix,
          extension
        );

        // Update database with R2 URL
        const { error: updateError } = await supabase
          .from('social_twin_generations')
          .update({ 
            r2_url: r2Url,
            migrated_to_r2: true,
            migrated_at: new Date().toISOString()
          })
          .eq('id', gen.id);

        if (updateError) {
          console.error(`❌ Failed to update database for ${gen.id}:`, updateError);
          failed++;
        } else {
          console.log(`✅ Successfully migrated ${gen.id} to ${r2Url}`);
          migrated++;
        }

        // Add delay to avoid overwhelming R2
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Failed to migrate generation ${gen.id}:`, error);
        failed++;
      }
    }

    return Response.json({
      success: true,
      migrated,
      failed,
      total: generations.length
    });

  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return Response.json({ 
      error: error.message || 'Migration failed' 
    }, { status: 500 });
  }
}
