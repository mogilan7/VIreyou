import { NextRequest, NextResponse } from 'next/server';

const FASTAPI_URL = process.env.CAROUSEL_SERVICE_URL || 'http://127.0.0.1:8002';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session');
  const filename = searchParams.get('file');
  if (!sessionId || !filename) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }
  const res = await fetch(`${FASTAPI_URL}/slide/${sessionId}/${filename}`);
  if (!res.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, { headers: { 'Content-Type': 'image/png' } });
}
