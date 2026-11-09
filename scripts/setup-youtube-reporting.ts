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

    console.log('--- 1. Checking reportTypes.list ---');
    try {
        const typesRes = await reporting.reportTypes.list();
        const types = typesRes.data.reportTypes || [];
        console.log(`Available report types (${types.length}):`);
        for (const t of types) {
            console.log(`- ID: ${t.id} | Name: ${t.name}`);
        }

        console.log('\n--- 2. Checking existing jobs ---');
        const jobsRes = await reporting.jobs.list();
        const existingJobs = jobsRes.data.jobs || [];
        console.log(`Existing jobs (${existingJobs.length}):`);
        for (const j of existingJobs) {
            console.log(`- Job ID: ${j.id} | ReportType: ${j.reportTypeId} | Name: ${j.name} | Created: ${j.createTime}`);
        }

        const targetTypes = ['channel_reach_basic_a1', 'channel_reach_combined_a1'];
        for (const typeId of targetTypes) {
            const exists = existingJobs.find(j => j.reportTypeId === typeId);
            if (exists) {
                console.log(`\nJob for '${typeId}' already exists: ${exists.id}`);
            } else {
                console.log(`\nCreating job for '${typeId}'...`);
                const newJob = await reporting.jobs.create({
                    requestBody: {
                        reportTypeId: typeId,
                        name: `VIReYou ${typeId}`
                    }
                });
                console.log(`✅ Created job for '${typeId}': ID = ${newJob.data.id}`);
            }
        }
    } catch (err: any) {
        console.error('Error querying YouTube Reporting API:', err.message);
        if (err?.response?.data) {
            console.error('Details:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

setupReporting();

