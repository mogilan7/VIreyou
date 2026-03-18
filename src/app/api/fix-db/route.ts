import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Drop the check constraint that is blocking 'ai-recommendation'
    await prisma.$executeRaw`
      ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_test_type_check;
    `;
    
    return NextResponse.json({ 
      success: true, 
      message: "Ограничение test_results_test_type_check успешно снято! Теперь вы можете сохранять рекомендации." 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
