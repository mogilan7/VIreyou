const { OpenAI } = require('openai');
const fs = require('fs');

async function testOpenAI() {
    console.log('Testing OpenAI API Key...');

    let apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && fs.existsSync('.env.local')) {
        const env = fs.readFileSync('.env.local', 'utf8');
        apiKey = env.match(/OPENAI_API_KEY=(.*)/)?.[1]?.trim()?.replace(/"/g, '') || '';
    }

    if (!apiKey) {
        console.error('Error: OPENAI_API_KEY not found in env or .env.local');
        return;
    }

    const openai = new OpenAI({ apiKey });

    try {
        console.log('Attempting to list models...');
        const models = await openai.models.list();
        console.log('Successfully connected! Found', models.data.length, 'models.');

        const gpt4 = models.data.find(m => m.id === 'gpt-4o');
        if (gpt4) {
            console.log('Verified: gpt-4o is available.');
        } else {
            console.log('Warning: gpt-4o not found in the list, but it might still be available via direct call.');
        }

        console.log('Test completed successfully.');
    } catch (e) {
        console.error('OpenAI Test Failed:', e.message);
    }
}

testOpenAI();
