import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const email = 'comfprorf@gmail.com';
    console.log(`Checking Supabase Auth for: ${email}...`);

    // Try to find user
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        console.log(`User already exists in Supabase Auth with ID: ${existingUser.id}`);
    } else {
        console.log(`User not found in Supabase Auth. Creating now...`);
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            email_confirm: true,
            user_metadata: { source: 'manual_fix' }
        });

        if (createError) {
            console.error('Failed to create user:', createError);
        } else {
            console.log('User successfully created in Supabase Auth!');
        }
    }
}

main();
