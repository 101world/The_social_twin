import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    if (!file || !title) {
      return NextResponse.json({ error: 'File and title are required' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `explore/${timestamp}-${file.name}`;
    
    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    }));

    // Construct public URL
    const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${fileName}`;

    // Save to database
    const contentData = {
      title,
      description: description || '',
      file_url: publicUrl,
      file_name: fileName,
      file_type: file.type,
      file_size: file.size,
      upload_date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('explore_content')
      .insert(contentData)
      .select()
      .single();

    if (error) {
      console.error('Error saving to database:', error);
      return NextResponse.json({ error: 'Failed to save content data' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in explore content API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('explore_content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching explore content:', error);
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }

    return NextResponse.json({ content: data || [] });
  } catch (error) {
    console.error('Error in explore content API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    // Get the content data first to delete from R2
    const { data: content, error: fetchError } = await supabase
      .from('explore_content')
      .select('file_name')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching content for deletion:', fetchError);
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('explore_content')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting from database:', deleteError);
      return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in explore content DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
