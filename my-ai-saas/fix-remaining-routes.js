const fs = require('fs');
const path = require('path');

const messengerRoutes = [
  'app/api/messenger/send-friend-request/route.ts',
  'app/api/messenger/get-or-create-dm-room/route.ts', 
  'app/api/messenger/get-pending-requests/route.ts',
  'app/api/messenger/accept-friend-request/route.ts'
];

messengerRoutes.forEach(routePath => {
  const fullPath = path.join(__dirname, routePath);
  
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace the module-level supabase creation
    content = content.replace(
      /const supabase = createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!\s*\);/g,
      `function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(url, key);
}`
    );
    
    // Remove any duplicate supabase declarations
    content = content.replace(/const supabase = getSupabaseClient\(\);\s*const supabase = getSupabaseClient\(\);/g, 'const supabase = getSupabaseClient();');
    
    // Make sure there's a supabase client call in each function
    if (!content.includes('const supabase = getSupabaseClient();')) {
      content = content.replace(
        /export async function (POST|GET)\(request: NextRequest\) \{\s*try \{/g,
        (match) => {
          return match + '\n    const supabase = getSupabaseClient();';
        }
      );
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Fixed: ${routePath}`);
  } else {
    console.log(`Not found: ${routePath}`);
  }
});

console.log('Remaining messenger routes fixed!');
