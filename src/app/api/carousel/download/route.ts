import { NextRequest, NextResponse } from 'next/server';

const FASTAPI_URL = process.env.CAROUSEL_SERVICE_URL || 'http://127.0.0.1:8002';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session');
  if (!sessionId) return NextResponse.json({ error: 'Missing session' }, { status: 400 });
  const res = await fetch(`${FASTAPI_URL}/download/${sessionId}`);
  if (!res.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="vireyou_carousel.zip"',
    },
  });
}
