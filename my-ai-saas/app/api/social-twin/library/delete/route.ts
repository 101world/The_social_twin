import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSafeSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest) {
  try {
    const authState = await auth();
    let userId = authState.userId as string | null;
    
    // Fallback: accept user id from trusted header for dev if auth() is null
    if (!userId) {
      const hdr = req.headers.get('x-user-id');
      if (hdr && typeof hdr === 'string') userId = hdr;
    }
    
    const getToken = (authState as any)?.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const generationId = searchParams.get('id');
    
    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID required' }, { status: 400 });
    }

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = createSafeSupabaseClient(jwt || undefined);

    // First, get the generation record to check ownership and get file paths
    const { data: generation, error: fetchError } = await supabase
      .from('media_generations')
      .select('id,user_id,result_url,thumbnail_url,type')
      .eq('id', generationId)
      .eq('user_id', userId) // Ensure user owns this generation
      .single();

    if (fetchError || !generation) {
      return NextResponse.json({ error: 'Generation not found or access denied' }, { status: 404 });
    }

    const filesToDelete: Array<{ bucket: string; path: string }> = [];

    // Check if result_url is a storage URL and add to deletion list
    if (generation.result_url && generation.result_url.startsWith('storage:')) {
      const parts = generation.result_url.replace('storage:', '').split('/');
      const bucket = parts.shift() as string;
      const path = parts.join('/');
      filesToDelete.push({ bucket, path });
    }

    // Check if thumbnail_url is a storage URL and add to deletion list
    if (generation.thumbnail_url && generation.thumbnail_url.startsWith('storage:')) {
      const parts = generation.thumbnail_url.replace('storage:', '').split('/');
      const bucket = parts.shift() as string;
      const path = parts.join('/');
      filesToDelete.push({ bucket, path });
    }

    // Delete files from storage (R2/Supabase storage)
    for (const file of filesToDelete) {
      try {
        const { error: deleteError } = await supabase.storage
          .from(file.bucket)
          .remove([file.path]);
        
        if (deleteError) {
          console.error(`Failed to delete file ${file.path} from bucket ${file.bucket}:`, deleteError);
          // Continue with database deletion even if file deletion fails
        } else {
          console.log(`Successfully deleted file: ${file.bucket}/${file.path}`);
        }
      } catch (storageError) {
        console.error(`Error deleting file ${file.path}:`, storageError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the generation record from database
    const { error: deleteError } = await supabase
      .from('media_generations')
      .delete()
      .eq('id', generationId)
      .eq('user_id', userId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete generation record' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Generation and associated files deleted successfully',
      filesDeleted: filesToDelete.length
    });

  } catch (error: any) {
    console.error('Error deleting generation:', error);
    return NextResponse.json({ error: error?.message ?? 'Internal error' }, { status: 500 });
  }
}
