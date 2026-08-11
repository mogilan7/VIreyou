import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const whereClause: any = { userId };
  if (fromStr || toStr) {
    whereClause.date = {};
    if (fromStr) whereClause.date.gte = new Date(fromStr);
    if (toStr) whereClause.date.lte = new Date(toStr);
  }

  try {
    const logs = await prisma.consultantLog.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
    });

    if (logs.length === 0) {
      return new NextResponse('No data found for this user in the specified period.', { status: 404 });
    }

    const headers = [
      'ID', 'Date', 'Event Type', 'Requested Period', 'Valid Days', 'Coverage', 'Shown Values', 'Flags', 'Explicit Consent'
    ];

    const rows = logs.map(log => [
      log.id,
      log.date.toISOString(),
      log.event_type,
      log.requested_period || '',
      log.valid_days || '',
      log.coverage || '',
      log.shown_values ? JSON.stringify(log.shown_values).replace(/"/g, '""') : '',
      log.flags ? JSON.stringify(log.flags).replace(/"/g, '""') : '',
      log.explicit_consent ? 'true' : 'false'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="consultant_logs_${userId}.csv"`
      }
    });

  } catch (error) {
    console.error('Error exporting consultant logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
