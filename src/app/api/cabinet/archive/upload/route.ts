import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
    // Disabled until private storage and strict user session binding are implemented
    return NextResponse.json(
        { error: 'Endpoint temporarily disabled pending security migration' },
        { status: 410 }
    );
}
