import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role');
    
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log(`Total profiles found: ${profiles.length}`);
  profiles.forEach(p => {
    console.log(`- ID: ${p.id} | Name: ${p.full_name} | Role: ${p.role}`);
  });
}

check();
