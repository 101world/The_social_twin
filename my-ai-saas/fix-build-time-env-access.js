const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TypeScript files that have the problematic pattern
const result = execSync('grep -r "process.env.SUPABASE_SERVICE_ROLE_KEY.*createSupabaseAdminClient.*createSupabaseClient" app/api --include="*.ts"', { cwd: __dirname, encoding: 'utf8' }).trim();

if (result) {
  const matches = result.split('\n');
  const filesToFix = [...new Set(matches.map(match => match.split(':')[0]))];
  
  console.log('Files with problematic patterns:', filesToFix);
  
  filesToFix.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    if (fs.existsSync(fullPath)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Update imports to include createSafeSupabaseClient
      content = content.replace(
        /import \{ ([^}]*createSupabaseClient[^}]*) \} from '@\/lib\/supabase';/g,
        (match, imports) => {
          if (!imports.includes('createSafeSupabaseClient')) {
            const newImports = imports.trim() + ', createSafeSupabaseClient';
            return `import { ${newImports} } from '@/lib/supabase';`;
          }
          return match;
        }
      );
      
      // Replace all problematic patterns
      content = content.replace(
        /process\.env\.SUPABASE_SERVICE_ROLE_KEY \? createSupabaseAdminClient\(\) : createSupabaseClient\([^)]*\)/g,
        (match) => {
          // Extract the jwt parameter if it exists
          const jwtMatch = match.match(/createSupabaseClient\(([^)]*)\)/);
          const jwtParam = jwtMatch ? jwtMatch[1] : 'undefined';
          return `createSafeSupabaseClient(${jwtParam})`;
        }
      );
      
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
    }
  });
} else {
  console.log('No files found with the problematic pattern');
}

console.log('Build-time environment variable access patterns fixed!');
