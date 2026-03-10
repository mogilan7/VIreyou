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
    } catch (error: unknown) {
        const err = error as Error;
        const errMsg = `[${new Date().toISOString()}] API ERROR: ${err.message}\n${err.stack}\n`;
        fs.appendFileSync(logPath, errMsg);
        console.error('API Upload error:', error);
        return NextResponse.json({
            error: err.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
