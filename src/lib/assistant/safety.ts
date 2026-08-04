import type { LifestyleContext } from "./context";

const EMERGENCY_PATTERNS = [
  /бол(ь|и) в груди/i, /одышк/i, /суицид|не хочу жить|покончить/i,
  /кровотеч/i, /теря(ю|л) сознание/i,
];

export function safetyGate(ctx: LifestyleContext, userText?: string): { block: boolean; message?: string } {
  if (userText && EMERGENCY_PATTERNS.some(r => r.test(userText))) {
    const isEn = ctx.user.lang === 'en';
    return { 
      block: true, 
      message: isEn 
        ? "Based on your description, this may require urgent help. Please consult a doctor or call emergency services for acute symptoms. I cannot replace a medical professional." 
        : "Судя по описанию, это может требовать срочной помощи. Пожалуйста, обратись к врачу, а при острых симптомах вызови скорую (103/112). Я не могу заменить врача." 
    };
  }
  return { block: false };
}

export function postValidate(text: string, lang: string = 'ru'): string {
  // Базовая проверка на запрещенные слова или форматирование.
  // Теперь жестче: режет даже попытки выписать витамины в мг/мкг/МЕ
  const forbidden = [
    /принимай \d+ ?(мг|г|мл|таблеток|мкг|ме|iu|mcg)/i, 
    /диагноз/i, 
    /take \d+ ?(mg|g|ml|pills|mcg|iu)/i, 
    /diagnosis/i,
    /дозировк/i,
    /dosage/i
  ];
  const isEn = lang === 'en';
  
  if (forbidden.some(r => r.test(text))) {
    return isEn 
      ? "My algorithms detected that the recommendation might contain medical advice or supplement dosages. Please consult a doctor for personalized prescriptions.\n\n_This is an educational service, not medical advice._" 
      : "Мои алгоритмы обнаружили, что рекомендация могла содержать медицинские советы или дозировки добавок. Пожалуйста, проконсультируйся с врачом для получения персонализированных назначений.\n\n_Это образовательный сервис, не медицинская консультация._";
  }
  
  const disclaimer = isEn 
    ? "\n\n_Educational recommendation, not medical advice._" 
    : "\n\n_Образовательная рекомендация, не является медицинской консультацией._";
    
  if (!text.toLowerCase().includes("образовательн") && !text.toLowerCase().includes("медицинск") && !text.toLowerCase().includes("educational") && !text.toLowerCase().includes("medical")) {
    return text + disclaimer;
  }
  return text;
}
