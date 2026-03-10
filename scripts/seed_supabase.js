const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.resolve(__dirname, '..', '.env.local');
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

async function seed() {
    const userId = '00000000-0000-0000-0000-000000000000';

    const results = [
        { user_id: userId, test_type: 'mini-cog', score: 5, interpretation: 'Когнитивные функции в норме' },
        { user_id: userId, test_type: 'score', score: 2, interpretation: 'Умеренный риск ССЗ' },
        { user_id: userId, test_type: 'nicotine', score: 0, interpretation: 'Зависимость отсутствует' },
        { user_id: userId, test_type: 'RU-AUDIT', score: 4, interpretation: 'Низкий риск потребления алкоголя' },
        { user_id: userId, test_type: 'insomnia', score: 5, interpretation: 'Отсутствие клинически значимой бессонницы' },
        { user_id: userId, test_type: 'circadian', score: 1, interpretation: 'Тип: Жаворонок' }
    ];

    console.log('Seeding Supabase test_results...');

    const { error } = await supabase
        .from('test_results')
        .insert(results);

    if (error) {
        console.error('Error seeding test_results:', error);
    } else {
        console.log('Successfully seeded 6 test results!');
    }
}

seed();
