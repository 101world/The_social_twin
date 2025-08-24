import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    
    // Check if user has enough credits (1 credit for PDF export)
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (creditsError || !userCredits) {
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }

    if (userCredits.credits < 1) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        required: 1,
        available: userCredits.credits
      }, { status: 402 });
    }

    // Get the data to export from request
    const { data, filename = 'export' } = await req.json();
    
    if (!data) {
      return NextResponse.json({ error: 'No data provided for export' }, { status: 400 });
    }

    // Deduct 1 credit for PDF export
    const { data: newBalance, error: deductError } = await supabase.rpc('deduct_credits_simple', {
      p_user_id: userId,
      p_amount: 1
    });

    if (deductError || newBalance === null) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    // Simple PDF generation (you can enhance this with a proper PDF library)
    const pdfContent = generateSimplePDF(data, filename);

    // Log the export for analytics
    await supabase.from('user_exports').insert({
      user_id: userId,
      export_type: 'pdf',
      filename: `${filename}.pdf`,
      credits_used: 1,
      created_at: new Date().toISOString()
    }).catch(() => {}); // Non-critical, don't fail if logging fails

    return NextResponse.json({
      success: true,
      credits_remaining: newBalance,
      pdf_content: pdfContent,
      filename: `${filename}.pdf`
    });

  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Simple PDF content generator (replace with proper PDF library like jsPDF or puppeteer)
function generateSimplePDF(data: any, filename: string): string {
  // This is a simplified version - you'd use a real PDF library in production
  const pdfHeader = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length ${JSON.stringify(data).length + 100}
>>
stream
BT
/F1 12 Tf
72 720 Td
(Export: ${filename}) Tj
0 -20 Td
(Data: ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
0000000301 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${500 + JSON.stringify(data).length}
%%EOF`;

  return Buffer.from(pdfHeader).toString('base64');
}
