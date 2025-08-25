const fs = require('fs');
const path = require('path');

const filesToFix = [
  'app/api/social-twin/export-ppt/route.ts',
  'app/api/social-twin/feed/route.ts', 
  'app/api/social-twin/folders/route.ts',
  'app/api/social-twin/folders/[folderId]/items/route.ts',
  'app/api/social-twin/generate/route.ts',
  'app/api/social-twin/history/route.ts',
  'app/api/social-twin/projects/route.ts',
  'app/api/social-twin/projects/[id]/route.ts',
  'app/api/social-twin/save-to-library/route.ts',
  'app/api/social-twin/topics/route.ts',
  'app/api/social-twin/topics/[id]/feed/route.ts',
  'app/api/social-twin/topics/[id]/messages/route.ts'
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Update imports if needed
    if (content.includes('createSupabaseClient, createSupabaseAdminClient') && !content.includes('createSafeSupabaseClient')) {
      content = content.replace(
        'import { createSupabaseClient, createSupabaseAdminClient } from \'@/lib/supabase\';',
        'import { createSafeSupabaseClient } from \'@/lib/supabase\';'
      );
    } else if (content.includes('createSupabaseAdminClient, createSupabaseClient') && !content.includes('createSafeSupabaseClient')) {
      content = content.replace(
        'import { createSupabaseAdminClient, createSupabaseClient } from \'@/lib/supabase\';',
        'import { createSafeSupabaseClient } from \'@/lib/supabase\';'
      );
    }
    
    // Replace all the problematic patterns
    
    // Pattern 1: with jwt parameter
    content = content.replace(
      /process\.env\.SUPABASE_SERVICE_ROLE_KEY \? createSupabaseAdminClient\(\) : createSupabaseClient\(jwt \|\| undefined\)/g,
      'createSafeSupabaseClient(jwt || undefined)'
    );
    
    // Pattern 2: with jwt! parameter  
    content = content.replace(
      /process\.env\.SUPABASE_SERVICE_ROLE_KEY \? createSupabaseAdminClient\(\) : createSupabaseClient\(jwt!\)/g,
      'createSafeSupabaseClient(jwt!)'
    );
    
    // Pattern 3: with token parameter
    content = content.replace(
      /process\.env\.SUPABASE_SERVICE_ROLE_KEY \? createSupabaseAdminClient\(\) : createSupabaseClient\(token\)/g,
      'createSafeSupabaseClient(token)'
    );
    
    // Pattern 4: no parameters
    content = content.replace(
      /process\.env\.SUPABASE_SERVICE_ROLE_KEY \? createSupabaseAdminClient\(\) : createSupabaseClient\(\)/g,
      'createSafeSupabaseClient()'
    );
    
    // Handle assignment patterns (like "supabase = ...")
    content = content.replace(
      /supabase = process\.env\.SUPABASE_SERVICE_ROLE_KEY \? createSupabaseAdminClient\(\) : createSupabaseClient\(([^)]*)\);/g,
      'supabase = createSafeSupabaseClient($1);'
    );
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  } else {
    console.log(`Not found: ${filePath}`);
  }
});

console.log('All social-twin routes fixed!');
