import type { LifestyleContext } from "./context";

const EMERGENCY_PATTERNS = [
  /бол(ь|и) в груди/i, /одышк/i, /суицид|не хочу жить|покончить/i,
  /кровотеч/i, /теря(ю|л) сознание/i,
];

export function safetyGate(ctx: LifestyleContext, userText?: string): { block: boolean; message?: string } {
  if (userText && EMERGENCY_PATTERNS.some(r => r.test(userText))) {
    return { 
      block: true, 
      message: "Судя по описанию, это может требовать срочной помощи. Пожалуйста, обратись к врачу, а при острых симптомах вызови скорую (103/112). Я не могу заменить врача." 
    };
  }
  return { block: false };
}

export function postValidate(text: string): string {
  // Базовая проверка на запрещенные слова или форматирование.
  // Например, если ИИ начал выписывать препараты с дозировками
  const forbidden = [/принимай \d+ ?(мг|г|мл|таблеток)/i, /диагноз/i];
  if (forbidden.some(r => r.test(text))) {
    return "Мои алгоритмы обнаружили, что рекомендация могла содержать медицинские советы. Пожалуйста, проконсультируйся с врачом для получения персонализированных назначений.\n\n_Это образовательный сервис, не медицинская консультация._";
  }
  
  const disclaimer = "\n\n_Образовательная рекомендация, не является медицинской консультацией._";
  if (!text.includes("образовательн") && !text.includes("медицинск")) {
    return text + disclaimer;
  }
  return text;
}
