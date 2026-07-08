import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    deployed_at: new Date().toISOString(),
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40) + '...',
    database_url_hint: process.env.DATABASE_URL?.substring(0, 60) + '...',
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    node_env: process.env.NODE_ENV,
  });
}
