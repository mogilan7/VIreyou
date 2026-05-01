
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testMagicLink() {
    console.log("Generating link for tg_12345@vireyou.com...");
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: 'tg_12345@vireyou.com'
    });
    
    if (error) console.error("Error:", error);
    else console.log("Success! Link:", data.properties?.action_link);
}

testMagicLink();
