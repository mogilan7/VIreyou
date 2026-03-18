import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const result = await prisma.$queryRaw`
      SELECT pg_get_constraintdef(con.oid) 
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE con.conname = 'test_results_test_type_check';
    `;
    return NextResponse.json({ success: true, constraint: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
