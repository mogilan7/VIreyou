import * as path from 'path';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

const envLocalPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envLocalPath });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

async function setupReporting() {
    if (!clientId || !clientSecret || !refreshToken) {
        console.error('Missing YouTube OAuth credentials in .env.local');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const reporting = google.youtubereporting({ version: 'v1', auth: oauth2Client });

    console.log('=== 1. reportTypes.list ===');
    const typesRes = await reporting.reportTypes.list();
    const types = typesRes.data.reportTypes || [];
    console.log(`Всего типов отчетов: ${types.length}`);
    for (const t of types) {
        console.log(`- ID: ${t.id} | Name: ${t.name}`);
    }

    const reachTypes = types.filter(t => t.id && t.id.startsWith('channel_reach_'));
    if (reachTypes.length === 0) {
        console.log('\n⚠️ Внимание: channel_reach_* в списке reportTypes отсутствует!');
        console.log('Никакие задания не создаются.');
        return;
    }

    console.log('\nНайденные типы channel_reach_*:');
    for (const rt of reachTypes) {
        console.log(`- ID: ${rt.id} | Name: ${rt.name}`);
    }

    console.log('\n=== 2. Создание заданий на channel_reach_basic_a1 и channel_reach_combined_a1 ===');
    const targetTypes = ['channel_reach_basic_a1', 'channel_reach_combined_a1'];
    
    // Проверяем существующие задания
    const initialJobsRes = await reporting.jobs.list();
    const existingJobs = initialJobsRes.data.jobs || [];

    for (const typeId of targetTypes) {
        const typeAvailable = types.some(t => t.id === typeId);
        if (!typeAvailable) {
            console.log(`Тип '${typeId}' недоступен в reportTypes.list! Пропуск.`);
            continue;
        }

        const exists = existingJobs.find(j => j.reportTypeId === typeId);
        if (exists) {
            console.log(`Задание для '${typeId}' уже существует: ID = ${exists.id} (Name: ${exists.name})`);
        } else {
            console.log(`Создание задания для '${typeId}'...`);
            const newJob = await reporting.jobs.create({
                requestBody: {
                    reportTypeId: typeId,
                    name: `VIReYou ${typeId}`
                }
            });
            console.log(`✅ Создано задание для '${typeId}': ID = ${newJob.data.id} (Name: ${newJob.data.name})`);
        }
    }

    console.log('\n=== 3. jobs.list после создания ===');
    const finalJobsRes = await reporting.jobs.list();
    const finalJobs = finalJobsRes.data.jobs || [];
    console.log(`Всего заданий (${finalJobs.length}):`);
    for (const j of finalJobs) {
        console.log(`- Job ID: ${j.id} | ReportType: ${j.reportTypeId} | Name: ${j.name} | Created: ${j.createTime}`);
    }
}

setupReporting().catch(err => {
    console.error('Error in setup-youtube-reporting:', err?.message || err);
    if (err?.response?.data) {
        console.error('Details:', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
});


