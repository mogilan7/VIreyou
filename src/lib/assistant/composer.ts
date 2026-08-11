import { validateLLMOutput } from './safety';

export interface ComposerContext {
  date: string;
  level_by_domain: Record<string, number>;
  baselines: Record<string, any>;
  today: Record<string, any>;
  deviations: Array<any>;
  yesterday_advice?: any;
  engagement: Record<string, any>;
  empty_streak: number;
  sync: any;
  subjective: any;
  safety_flags: string[];
}

export interface WeeklyComposerContext {
  week_start: string;
  week_end: string;
  baselines: Record<string, any>;
  insights: Array<any>;
  cross_domain_links: Array<any>;
  compliance: Record<string, number>;
}

export type LLMGenerator = (prompt: string, context: any) => Promise<string>;

export async function composeDailyCard(
  context: ComposerContext,
  llmGenerator: LLMGenerator
): Promise<string> {
  const prompt = `Generate a daily lifestyle review based on this data. Use exactly one problem area and one advice.`;
  return await generateWithSafetyRetry(prompt, context, llmGenerator);
}

export async function composeWeeklyReport(
  context: WeeklyComposerContext,
  llmGenerator: LLMGenerator
): Promise<string> {
  const prompt = `Generate a weekly report based on this data. Include base line, one main observation, an experiment to check, what works well, and a table of numbers. Max 5 points.`;
  return await generateWithSafetyRetry(prompt, context, llmGenerator);
}

async function generateWithSafetyRetry(
  prompt: string,
  context: any,
  llmGenerator: LLMGenerator,
  maxRetries = 2
): Promise<string> {
  let attempts = 0;
  while (attempts <= maxRetries) {
    const text = await llmGenerator(prompt, context);
    const safety = validateLLMOutput(text);

    if (safety.isSafe) {
      return text;
    }
    
    attempts++;
    console.warn(`Safety violation (attempt ${attempts}): ${safety.violations.join(', ')}`);
  }

  // Fallback
  return "Я вижу, что у вас есть новые данные, но мне требуется время для их безопасного анализа. Пожалуйста, продолжайте в том же духе, ваш организм скажет вам спасибо!";
}
