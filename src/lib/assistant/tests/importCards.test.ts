import { describe, it, expect } from 'vitest';
import { normalizeRelatedContent, validateRow } from '../../../../scripts/import-knowledge-cards';
import { ASSISTANT_DOMAINS } from '../config';

describe('import-knowledge-cards', () => {
  describe('normalizeRelatedContent', () => {
    it('normalizes single links and multiple links with comma or semicolon', () => {
      expect(normalizeRelatedContent(null)).toBeNull();
      expect(normalizeRelatedContent('')).toBeNull();
      expect(normalizeRelatedContent('   ')).toBeNull();
      expect(normalizeRelatedContent('https://example.com')).toBe('https://example.com');
      expect(normalizeRelatedContent('https://a.com ; https://b.com')).toBe('https://a.com, https://b.com');
      expect(normalizeRelatedContent('https://a.com, https://b.com ; https://c.com')).toBe('https://a.com, https://b.com, https://c.com');
      expect(normalizeRelatedContent('  https://a.com  ;   https://b.com  ')).toBe('https://a.com, https://b.com');
    });
  });

  describe('validateRow', () => {
    it('validates correct row with allowed domain nutrition and evidence_level', () => {
      const row = {
        id: 'sci_nutrition_protein_001',
        layer: 'science',
        domain: 'nutrition',
        claim: 'В рандомизированном исследовании...',
        evidence_level: 'studies',
        source_title: 'DO-HEALTH trial',
        source_url: 'https://doi.org/...',
        source_year: '2025',
        contraindications: 'Антикоагулянты',
        related_content: 'https://youtu.be/1 ; https://vireyou.com/2',
        lang: 'ru',
        reviewed_at: '2026-11-05',
        status: 'approved'
      };

      const result = validateRow(row, 2);
      expect(result.error).toBeUndefined();
      expect(result.card).toBeDefined();
      expect(result.card?.domain).toBe('nutrition');
      expect(result.card?.related_content).toBe('https://youtu.be/1, https://vireyou.com/2');
    });

    it('rejects invalid domain', () => {
      const row = {
        id: 'test_001',
        layer: 'science',
        domain: 'unsupported_domain',
        claim: 'Test claim',
        evidence_level: 'studies',
        status: 'approved',
        lang: 'ru'
      };

      const result = validateRow(row, 3);
      expect(result.error).toBeDefined();
      expect(result.error?.reason).toContain('Invalid domain "unsupported_domain"');
    });

    it('confirms all 10 expected domains are in ASSISTANT_DOMAINS', () => {
      const expected = [
        'sleep',
        'nutrition',
        'nutrition_protein',
        'movement_muscle',
        'stress_hrv',
        'glucose',
        'water',
        'circadian',
        'habits',
        'aging'
      ];
      expect([...ASSISTANT_DOMAINS]).toEqual(expected);
    });
  });
});
