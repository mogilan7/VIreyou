import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import { PrismaClient } from '@prisma/client';
import { ASSISTANT_DOMAINS } from '../src/lib/assistant/config';

export const ALLOWED_LAYERS = ['science', 'product', 'content'] as const;
export const ALLOWED_EVIDENCE_LEVELS = ['guideline', 'meta_analysis', 'studies', 'hypothesis'] as const;
export const ALLOWED_STATUSES = ['approved', 'draft', 'rejected'] as const;
export const ALLOWED_LANGS = ['ru', 'en'] as const;

export interface CardRow {
  id: string;
  layer: string;
  domain: string;
  claim: string;
  evidence_level: string;
  source_title?: string | null;
  source_url?: string | null;
  source_year?: number | null;
  contraindications?: string | null;
  related_content?: string | null;
  lang: string;
  reviewed_at?: Date | null;
  status: string;
}

export interface ValidationError {
  rowNumber: number;
  id: string;
  reason: string;
}

/**
 * Normalizes related_content string by accepting ',' or ';' delimiters,
 * trimming items, and joining them with ', '.
 */
export function normalizeRelatedContent(raw?: string | null): string | null {
  if (!raw) return null;
  const parts = raw
    .split(/[,;]+/)
    .map(p => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Standard CSV parser handling quotes, commas, escapes, and multi-line cells.
 */
export function parseCSV(content: string): Record<string, string>[] {
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

export function validateRow(record: Record<string, string>, rowNumber: number): { card?: CardRow; error?: ValidationError } {
  const id = (record.id || record.card_id || '').trim();
  if (!id) {
    return { error: { rowNumber, id: '(empty)', reason: 'Missing ID' } };
  }

  const layer = (record.layer || 'science').trim().toLowerCase();
  if (!ALLOWED_LAYERS.includes(layer as any)) {
    return { error: { rowNumber, id, reason: `Invalid layer "${layer}". Expected one of: ${ALLOWED_LAYERS.join(', ')}` } };
  }

  const domain = (record.domain || '').trim().toLowerCase();
  if (!ASSISTANT_DOMAINS.includes(domain as any)) {
    return { error: { rowNumber, id, reason: `Invalid domain "${domain}". Expected one of: ${ASSISTANT_DOMAINS.join(', ')}` } };
  }

  const claim = (record.claim || '').trim();
  if (!claim) {
    return { error: { rowNumber, id, reason: 'Missing or empty claim' } };
  }

  const evidenceLevel = (record.evidence_level || '').trim().toLowerCase();
  if (!ALLOWED_EVIDENCE_LEVELS.includes(evidenceLevel as any)) {
    return { error: { rowNumber, id, reason: `Invalid evidence_level "${evidenceLevel}". Expected one of: ${ALLOWED_EVIDENCE_LEVELS.join(', ')}` } };
  }

  const status = (record.status || 'draft').trim().toLowerCase();
  if (!ALLOWED_STATUSES.includes(status as any)) {
    return { error: { rowNumber, id, reason: `Invalid status "${status}". Expected one of: ${ALLOWED_STATUSES.join(', ')}` } };
  }

  const lang = (record.lang || 'ru').trim().toLowerCase();
  if (!ALLOWED_LANGS.includes(lang as any)) {
    return { error: { rowNumber, id, reason: `Invalid lang "${lang}". Expected one of: ${ALLOWED_LANGS.join(', ')}` } };
  }

  let sourceYear: number | null = null;
  if (record.source_year && record.source_year.trim()) {
    const yr = parseInt(record.source_year.trim(), 10);
    if (isNaN(yr) || yr < 1800 || yr > 2100) {
      return { error: { rowNumber, id, reason: `Invalid source_year "${record.source_year}"` } };
    }
    sourceYear = yr;
  }

  let reviewedAt: Date | null = null;
  if (record.reviewed_at && record.reviewed_at.trim()) {
    const d = new Date(record.reviewed_at.trim());
    if (isNaN(d.getTime())) {
      return { error: { rowNumber, id, reason: `Invalid reviewed_at date "${record.reviewed_at}"` } };
    }
    reviewedAt = d;
  }

  const normalizedRelated = normalizeRelatedContent(record.related_content);

  return {
    card: {
      id,
      layer,
      domain,
      claim,
      evidence_level: evidenceLevel,
      source_title: record.source_title ? record.source_title.trim() : null,
      source_url: record.source_url ? record.source_url.trim() : null,
      source_year: sourceYear,
      contraindications: record.contraindications ? record.contraindications.trim() : null,
      related_content: normalizedRelated,
      lang,
      reviewed_at: reviewedAt,
      status
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const includeTest = args.includes('--include-test');
  const cleanupTest = args.includes('--cleanup-test');

  const filePath = args.find(a => !a.startsWith('--'));

  const directUrl = (process.env.DIRECT_URL || '').trim();
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  const sessionUrl = dbUrl ? dbUrl.replace(':6543', ':5432').replace('?pgbouncer=true', '').replace('&pgbouncer=true', '') : '';

  const prisma = new PrismaClient({
    datasourceUrl: sessionUrl || directUrl || dbUrl,
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
    const skippedCards: { id: string; reason: string }[] = [];
    const validationErrors: ValidationError[] = [];
    const touchedLayers = new Set<string>();

    records.forEach((r, idx) => {
      const rowNumber = idx + 2; // header is row 1
      const validation = validateRow(r, rowNumber);

      if (validation.error) {
        validationErrors.push(validation.error);
        skippedCards.push({ id: validation.error.id, reason: validation.error.reason });
        return;
      }

      const card = validation.card!;

      // Filter test cards in prod unless explicitly asked
      const isTestCard = card.id.startsWith('test_');
      if (isTestCard && !includeTest) {
        skippedCards.push({ id: card.id, reason: 'Test card excluded (pass --include-test to import)' });
        return;
      }

      touchedLayers.add(card.layer);

      if (card.status === 'approved') {
        approvedCards.push(card);
      } else {
        inactiveCards.push(card);
      }
    });

    console.log(`\n========================================`);
    console.log(`Knowledge Cards Import Validation Summary`);
    console.log(`========================================`);
    console.log(`Total rows parsed:           ${records.length}`);
    console.log(`Cards to create / activate:   ${approvedCards.length} (status: approved, is_active: true)`);
    console.log(`Cards to keep / set inactive: ${inactiveCards.length} (status: draft/rejected, is_active: false)`);
    console.log(`Cards skipped / errored:     ${skippedCards.length}`);
    console.log(`Validation errors count:     ${validationErrors.length}`);

    if (validationErrors.length > 0) {
      console.log(`\n❌ Validation Errors (${validationErrors.length}):`);
      validationErrors.forEach(err => {
        console.log(`  - Row ${err.rowNumber} [ID: ${err.id}]: ${err.reason}`);
      });
    } else {
      console.log(`\n✅ Zero validation errors found.`);
    }

    if (isDryRun) {
      console.log('\n🔍 [DRY RUN COMPLETE] No database modifications were performed.');
      return;
    }

    if (validationErrors.length > 0) {
      console.error('\n🛑 Import aborted due to validation errors.');
      process.exit(1);
    }

    // 1. Upsert approved cards as active
    console.log(`\nApplying database upserts...`);
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

    // 4. Output statistics of active cards per domain (lang = ru)
    const activeCards = await prisma.knowledgeCard.groupBy({
      by: ['domain'],
      where: {
        is_active: true,
        lang: 'ru'
      },
      _count: {
        id: true
      },
      orderBy: {
        domain: 'asc'
      }
    });

    console.log(`\n========================================`);
    console.log(`Active Knowledge Cards by Domain (lang = ru):`);
    console.log(`========================================`);
    let totalActive = 0;
    activeCards.forEach(item => {
      console.log(`- ${item.domain}: ${item._count.id}`);
      totalActive += item._count.id;
    });
    console.log(`----------------------------------------`);
    console.log(`Total active cards: ${totalActive}`);
    console.log(`========================================\n`);

  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
}
