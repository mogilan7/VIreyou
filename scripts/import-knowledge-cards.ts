import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import { PrismaClient } from '@prisma/client';

interface CardRow {
  id: string;
  layer: string;
  domain: string;
  claim: string;
  evidence_level?: string | null;
  source_title?: string | null;
  source_url?: string | null;
  source_year?: number | null;
  contraindications?: string | null;
  related_content?: string | null;
  lang: string;
  reviewed_at?: Date | null;
  status: string;
}

/**
 * Standard CSV parser handling quotes, commas, escapes, and multi-line cells.
 */
function parseCSV(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  // Normalize line endings
  const cleanContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanContent.length; i++) {
    const char = cleanContent[i];
    const nextChar = cleanContent[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  // Parse header
  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const dataRows: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] !== undefined ? row[index] : '';
    });
    dataRows.push(record);
  }

  return dataRows;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const includeTest = args.includes('--include-test');
  const cleanupTest = args.includes('--cleanup-test');

  const filePath = args.find(a => !a.startsWith('--'));

  const directUrl = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').trim();
  const prisma = new PrismaClient({
    datasourceUrl: directUrl,
  });

  try {
    if (cleanupTest) {
      console.log('🧹 Cleaning up test cards (id LIKE test_%)...');
      const deleted = await prisma.knowledgeCard.deleteMany({
        where: { id: { startsWith: 'test_' } }
      });
      console.log(`Deleted ${deleted.count} test cards.`);
      return;
    }

    if (!filePath) {
      console.error('Usage: npx tsx scripts/import-knowledge-cards.ts <path-to-csv> [--dry-run] [--include-test] [--cleanup-test]');
      process.exit(1);
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`File not found: ${resolvedPath}`);
      process.exit(1);
    }

    console.log(`Reading knowledge cards from: ${resolvedPath}`);
    if (isDryRun) {
      console.log('🔍 [DRY-RUN MODE] No changes will be written to the database.');
    }

    const rawCSV = fs.readFileSync(resolvedPath, 'utf8');
    const records = parseCSV(rawCSV);
    console.log(`Parsed ${records.length} records from CSV.`);

    const approvedCards: CardRow[] = [];
    const inactiveCards: CardRow[] = [];
    const touchedLayers = new Set<string>();

    for (const r of records) {
      const id = r.id || r.card_id;
      if (!id) continue;

      // Filter test cards in prod unless explicitly asked
      const isTestCard = id.startsWith('test_');
      if (isTestCard && !includeTest) {
        console.log(`Skipping test card in standard run: ${id}`);
        continue;
      }

      const layer = (r.layer || 'science').trim().toLowerCase();
      touchedLayers.add(layer);

      const status = (r.status || 'draft').trim().toLowerCase();
      const year = r.source_year ? parseInt(r.source_year, 10) : null;
      let reviewedAt: Date | null = null;
      if (r.reviewed_at) {
        const parsed = new Date(r.reviewed_at);
        if (!isNaN(parsed.getTime())) {
          reviewedAt = parsed;
        }
      }

      const card: CardRow = {
        id,
        layer,
        domain: (r.domain || '').trim().toLowerCase(),
        claim: r.claim || '',
        evidence_level: r.evidence_level || null,
        source_title: r.source_title || null,
        source_url: r.source_url || null,
        source_year: isNaN(year as number) ? null : year,
        contraindications: r.contraindications || null,
        related_content: r.related_content || null,
        lang: (r.lang || 'ru').trim().toLowerCase(),
        reviewed_at: reviewedAt,
        status
      };

      if (status === 'approved') {
        approvedCards.push(card);
      } else {
        inactiveCards.push(card);
      }
    }

    console.log(`\nImport Summary:`);
    console.log(`- Layers present in file: ${Array.from(touchedLayers).join(', ')}`);
    console.log(`- Approved cards to upsert (is_active = true): ${approvedCards.length}`);
    console.log(`- Non-approved cards to deactivate (is_active = false): ${inactiveCards.length}`);

    if (isDryRun) {
      console.log('\n[DRY RUN] Finished without database modifications.');
      return;
    }

    // 1. Upsert approved cards as active
    for (const card of approvedCards) {
      await prisma.knowledgeCard.upsert({
        where: { id: card.id },
        create: {
          id: card.id,
          layer: card.layer,
          domain: card.domain,
          claim: card.claim,
          evidence_level: card.evidence_level,
          source_title: card.source_title,
          source_url: card.source_url,
          source_year: card.source_year,
          contraindications: card.contraindications,
          related_content: card.related_content,
          lang: card.lang,
          reviewed_at: card.reviewed_at,
          status: 'approved',
          is_active: true
        },
        update: {
          layer: card.layer,
          domain: card.domain,
          claim: card.claim,
          evidence_level: card.evidence_level,
          source_title: card.source_title,
          source_url: card.source_url,
          source_year: card.source_year,
          contraindications: card.contraindications,
          related_content: card.related_content,
          lang: card.lang,
          reviewed_at: card.reviewed_at,
          status: 'approved',
          is_active: true
        }
      });
    }

    // 2. Mark draft/rejected cards present in the file as inactive
    for (const card of inactiveCards) {
      await prisma.knowledgeCard.upsert({
        where: { id: card.id },
        create: {
          id: card.id,
          layer: card.layer,
          domain: card.domain,
          claim: card.claim,
          evidence_level: card.evidence_level,
          source_title: card.source_title,
          source_url: card.source_url,
          source_year: card.source_year,
          contraindications: card.contraindications,
          related_content: card.related_content,
          lang: card.lang,
          reviewed_at: card.reviewed_at,
          status: card.status,
          is_active: false
        },
        update: {
          layer: card.layer,
          domain: card.domain,
          claim: card.claim,
          evidence_level: card.evidence_level,
          source_title: card.source_title,
          source_url: card.source_url,
          source_year: card.source_year,
          contraindications: card.contraindications,
          related_content: card.related_content,
          lang: card.lang,
          reviewed_at: card.reviewed_at,
          status: card.status,
          is_active: false
        }
      });
    }

    // 3. Layer-scoped deactivation: deactivate cards in DB for these layers that are NOT in the approved list
    const approvedIds = approvedCards.map(c => c.id);
    const layersArray = Array.from(touchedLayers);

    const deactivationResult = await prisma.knowledgeCard.updateMany({
      where: {
        layer: { in: layersArray },
        id: { notIn: approvedIds },
        is_active: true
      },
      data: {
        is_active: false
      }
    });

    console.log(`- Missing cards deactivated within touched layers: ${deactivationResult.count}`);
    console.log('✅ Knowledge cards import completed successfully.');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});

