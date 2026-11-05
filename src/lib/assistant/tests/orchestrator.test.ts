import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAssistantOrchestrator } from '../orchestrator';
import prisma from '../../prisma';
import * as geminiModule from '../../gemini';

// Mock prisma
vi.mock('../../prisma', () => {
  return {
    default: {
      user: {
        findUnique: vi.fn(),
      },
      nutritionLog: {
        findMany: vi.fn(),
      },
      sleepLog: {
        findMany: vi.fn(),
      },
      activityLog: {
        findMany: vi.fn(),
      },
      hydrationLog: {
        findMany: vi.fn(),
      },
      knowledgeCard: {
        findMany: vi.fn(),
      },
      knowledgeGap: {
        create: vi.fn(),
      },
      assistantMessage: {
        create: vi.fn(),
      },
      $queryRawUnsafe: vi.fn(),
    }
  };
});

describe('Lifestyle Assistant Orchestrator (Stage 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'test-user-id',
      age: 35,
      gender: 'male',
      height: 180,
      weight: 75,
      special_groups: []
    });

    (prisma.nutritionLog.findMany as any).mockResolvedValue([
      { created_at: new Date('2026-11-01T12:00:00Z'), calories: 2000, protein: 90, carbs: 200, fat: 70, fiber: 25, plants: ['гречка'] },
      { created_at: new Date('2026-11-02T12:00:00Z'), calories: 2200, protein: 100, carbs: 210, fat: 75, fiber: 30, plants: ['овсянка', 'яблоко'] }
    ]);

    (prisma.sleepLog.findMany as any).mockResolvedValue([
      { created_at: new Date('2026-11-01T07:00:00Z'), duration_hrs: 7.5, hrv: 45 },
      { created_at: new Date('2026-11-02T07:00:00Z'), duration_hrs: 8.0, hrv: 50 }
    ]);

    (prisma.activityLog.findMany as any).mockResolvedValue([
      { created_at: new Date('2026-11-01T18:00:00Z'), steps: 8000, active_minutes: 45 }
    ]);

    (prisma.hydrationLog.findMany as any).mockResolvedValue([
      { created_at: new Date('2026-11-01T15:00:00Z'), volume_ml: 1500 }
    ]);

    (prisma.$queryRawUnsafe as any).mockResolvedValue([]);

    (prisma.knowledgeCard.findMany as any).mockResolvedValue([
      {
        id: 'sci_sleep_001',
        domain: 'sleep',
        layer: 'science',
        claim: 'Регулярное время отхода ко сну поддерживает ночную вариабельность пульса (ВСР).',
        contraindications: null,
        related_content: 'https://vireyou.com'
      }
    ]);

    (prisma.assistantMessage.create as any).mockImplementation(({ data }: any) => {
      return Promise.resolve({ id: 'msg-123', ...data });
    });

    (prisma.knowledgeGap.create as any).mockResolvedValue({ id: 'gap-123' });
  });

  it('blocks red flags before model and returns emergency contact', async () => {
    const result = await runAssistantOrchestrator({
      userId: 'test-user-id',
      mode: 'ask',
      userQuery: 'У меня острая боль в груди и тяжело дышать',
      lang: 'ru'
    });

    expect(result.isFallback).toBe(true);
    expect(result.message).toContain('112');
    expect(prisma.knowledgeCard.findMany).not.toHaveBeenCalled();
  });

  it('handles missing cards by recording gap and returning standard message', async () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({
      response: {
        text: () => '[NO_MATCHING_CARD]\nВ базе пока нет проверенных данных по этому вопросу.'
      }
    });

    vi.spyOn(geminiModule, 'getGeminiModel').mockReturnValue({
      generateContent: mockGenerateContent
    } as any);

    const result = await runAssistantOrchestrator({
      userId: 'test-user-id',
      mode: 'ask',
      userQuery: 'Как принимать креатин моногидрат?',
      lang: 'ru'
    });

    expect(result.isKnowledgeGap).toBe(true);
    expect(result.message).toBe('В базе пока нет проверенных данных по этому вопросу. Записал его — Валя посмотрит 💛');
    expect(prisma.knowledgeGap.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          question: 'Как принимать креатин моногидрат?',
          lang: 'ru'
        })
      })
    );
  });

  it('returns formatted answer when matching card is cited and passes safety', async () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({
      response: {
        text: () => 'Регулярное время отхода ко сну помогает организму восстанавливаться. Попробуйте сегодня лечь в привычный час.\n[USED_CARDS: sci_sleep_001]'
      }
    });

    vi.spyOn(geminiModule, 'getGeminiModel').mockReturnValue({
      generateContent: mockGenerateContent
    } as any);

    const result = await runAssistantOrchestrator({
      userId: 'test-user-id',
      mode: 'ask',
      userQuery: 'Почему важен регулярный сон?',
      lang: 'ru'
    });

    expect(result.isFallback).toBe(false);
    expect(result.usedCardIds).toEqual(['sci_sleep_001']);
    expect(result.message).toContain('Регулярное время отхода ко сну помогает организму восстанавливаться');
    expect(result.message).not.toContain('[USED_CARDS:');
  });
});
