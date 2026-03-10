import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { extractHealthData } from '@/lib/ai-extraction';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    const logPath = '/tmp/api-debug.log';

    try {
        const body = await request.json();
        const { userId, fileName, fileUrl, fileType } = body;

        fs.appendFileSync(logPath, `[${new Date().toISOString()}] API HIT: userId=${userId}, file=${fileName}\n`);

        if (!userId || !fileUrl) {
            return NextResponse.json({ error: 'Missing userId or fileUrl' }, { status: 400 });
        }

        // Ensure user exists in Prisma DB (Upsert)
        // Using lowercase 'user' as confirmed by earlier test
        await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: {
                id: userId,
                email: body.email || `user_${userId}@example.com`,
                role: 'CLIENT',
                full_name: body.fullName || 'User'
            }
        });

        // @ts-expect-error - Prisma type sync issues
        const document = await prisma.medicalDocument.create({
            data: {
                user_id: userId,
                file_name: fileName,
                file_url: fileUrl,
                file_type: fileType,
                status: 'PROCESSING'
            }
        });

        fs.appendFileSync(logPath, `[${new Date().toISOString()}] SUCCESS: Document ${document.id} created\n`);

        // Trigger AI processing in background
        extractHealthData(document.id).catch(err => {
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] AI BACKGROUND ERROR: ${err.message}\n`);
        });

        return NextResponse.json(document);
    } catch (error: any) {
        console.error('API Upload error details:', {
            message: error.message,
            code: error.code,
            clientVersion: error.clientVersion
        });

        let detailedMessage = error.message || 'Unknown server error';

        // Handle common Prisma connection errors with helpful hints
        if (detailedMessage.includes("Can't reach database server")) {
            detailedMessage = `Database connection failed. Please check your DATABASE_URL in Vercel. Hint: Ensure you are using the Supabase Connection Pooler (port 6543) and pgbouncer=true. Error: ${detailedMessage}`;
        }

        return NextResponse.json({
            error: detailedMessage,
            code: error.code
        }, { status: 500 });
    }
}
