const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupAdminTables() {
  try {
    console.log('🔧 Setting up admin tables...');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'admin_tables_setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.trim().substring(0, 50) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql_statement: statement.trim() });
        
        if (error) {
          console.error('Error executing statement:', error);
          // Try direct query for simple statements
          const { error: directError } = await supabase.from('admin_config').select('*').limit(1);
          if (!directError) {
            console.log('✅ Tables already exist or statement completed');
          }
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }

    // Test the tables
    console.log('\n🧪 Testing admin_config table...');
    const { data, error } = await supabase
      .from('admin_config')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error testing admin_config:', error);
    } else {
      console.log('✅ admin_config table is working');
    }

    console.log('\n🧪 Testing explore_content table...');
    const { data: exploreData, error: exploreError } = await supabase
      .from('explore_content')
      .select('*')
      .limit(1);

    if (exploreError) {
      console.error('❌ Error testing explore_content:', exploreError);
    } else {
      console.log('✅ explore_content table is working');
    }

    console.log('\n🎉 Admin tables setup completed!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupAdminTables();
