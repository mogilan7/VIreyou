/**
 * Clinical interpretations for questionnaire scores used in Stage 2 Analysis.
 */
export const QUESTIONNAIRE_INTERPRETATIONS: Record<string, any> = {
  'sarc-f': {
    name: 'SARC-F (Саркопения)',
    thresholds: [
      { max: 3, label: 'Норма', risk: 'Низкий' },
      { min: 4, label: 'Риск саркопении', risk: 'Высокий', recommendation: 'Требуется оценка мышечной силы и функции.' }
    ]
  },
  'ipss': {
    name: 'IPSS (Простата)',
    thresholds: [
      { max: 7, label: 'Легкая симптоматика', risk: 'Низкий' },
      { min: 8, max: 19, label: 'Умеренная симптоматика', risk: 'Средний' },
      { min: 20, label: 'Тяжелая симптоматика', risk: 'Высокий' }
    ]
  },
  'mief-5': {
    name: 'МИЭФ-5 (Эректильная функция)',
    thresholds: [
      { min: 22, label: 'Эректильная функция в норме', risk: 'Низкий' },
      { min: 17, max: 21, label: 'Легкая степень ЭД', risk: 'Средний' },
      { min: 12, max: 16, label: 'Легкая/умеренная степень ЭД', risk: 'Средний' },
      { min: 8, max: 11, label: 'Умеренная степень ЭД', risk: 'Высокий' },
      { max: 7, label: 'Тяжелая степень ЭД', risk: 'Критический' }
    ]
  },
  'alcohol': {
    name: 'RUS-AUDIT (Алкоголь)',
    thresholds: [
      { max: 7, label: 'Низкий риск', risk: 'Низкий' },
      { min: 8, max: 15, label: 'Риск опасного потребления', risk: 'Средний' },
      { min: 16, max: 19, label: 'Высокий риск вредного потребления', risk: 'Высокий' },
      { min: 20, label: 'Вероятная зависимость', risk: 'Критический' }
    ]
  },
  'nicotine': {
    name: 'Тест Фагерстрема (Никотин)',
    thresholds: [
      { max: 2, label: 'Очень слабая зависимость', risk: 'Низкий' },
      { min: 3, max: 4, label: 'Слабая зависимость', risk: 'Низкий' },
      { min: 5, label: 'Средняя зависимость', risk: 'Средний' },
      { min: 6, max: 7, label: 'Высокая зависимость', risk: 'Высокий' },
      { min: 8, label: 'Очень высокая зависимость', risk: 'Критический' }
    ]
  },
  'insomnia': {
    name: 'Индекс бессонницы',
    thresholds: [
      { max: 7, label: 'Отсутствие клинически значимой бессонницы', risk: 'Низкий' },
      { min: 8, max: 14, label: 'Подпороговая бессонница', risk: 'Средний' },
      { min: 15, max: 21, label: 'Клиническая бессонница (средняя)', risk: 'Высокий' },
      { min: 22, label: 'Тяжелая клиническая бессонница', risk: 'Критический' }
    ]
  },
  'greene-scale': {
    name: 'Шкала Грина (Климакс)',
    thresholds: [
      { max: 10, label: 'Легкая степень', risk: 'Низкий' },
      { min: 11, max: 25, label: 'Средняя степень', risk: 'Средний' },
      { min: 26, label: 'Тяжелая степень', risk: 'Высокий' }
    ]
  },
  'mini-cog': {
    name: 'Тест Mini-Cog',
    thresholds: [
      { min: 3, label: 'Низкая вероятность когнитивных нарушений', risk: 'Низкий' },
      { max: 2, label: 'Вероятны когнитивные нарушения', risk: 'Высокий' }
    ]
  },
  'score': {
    name: 'SCORE (Риск ССЗ)',
    thresholds: [
      { max: 1, label: 'Низкий риск (10 лет)', risk: 'Низкий' },
      { min: 1, max: 4, label: 'Умеренный риск', risk: 'Средний' },
      { min: 5, max: 9, label: 'Высокий риск', risk: 'Высокий' },
      { min: 10, label: 'Очень высокий риск', risk: 'Критический' }
    ]
  }
};
