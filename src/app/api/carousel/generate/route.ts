import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const FASTAPI_URL = process.env.CAROUSEL_SERVICE_URL || 'http://127.0.0.1:8002';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session_id = body.session_id || randomUUID();

    const res = await fetch(`${FASTAPI_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, session_id }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
