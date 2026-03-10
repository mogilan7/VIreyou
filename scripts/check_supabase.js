const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const userId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await supabase
        .from('test_results')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching results:', error);
    } else {
        console.log('SUPABASE_RESULTS_COUNT:', data.length);
        console.log('LATEST_RESULTS:', JSON.stringify(data.slice(0, 3), null, 2));
    }
}

check();
