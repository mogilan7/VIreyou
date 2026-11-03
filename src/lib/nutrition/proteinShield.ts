/**
 * «Белковый щит» — калькулятор суточной нормы белка от веса и возраста.
 *
 * Логика (ориентир, не диагноз):
 *  - База: 0,8–1,0 г/кг до 65 лет; 1,0–1,2 г/кг с 65 лет
 *    (RDA 0,8 г/кг — Национальные академии США; 1,0–1,2 г/кг после 65 — PROT-AGE 2013, ESPEN).
 *  - Регулярные силовые / высокая активность / цель «нарастить мышцы»: 1,2–1,6 г/кг
 *    (PROT-AGE: активным пожилым ≥1,2; позиция ACSM / AND / Dietitians of Canada 2016 для тренирующихся 1,2–2,0 —
 *    берём нижнюю часть для любителей).
 *  - Цель «снизить вес»: не ниже 1,2 г/кг, верх 1,6 — чтобы не терять мышцы на дефиците
 *    (обзоры и РКИ, единого гайдлайна нет — помечено в sources как «экспертная практика»).
 *  - Потолок 2,0 г/кг.
 *  - ИМТ > 30: расчёт от веса при ИМТ 25 для этого роста (скорректированный вес).
 *  - Болезнь почек: цифру не выдаём — норму подбирает врач (PROT-AGE: при тяжёлой ХБП, СКФ < 30, без диализа
 *    повышенный белок противопоказан).
 *  - На приём пищи: делим на число приёмов; ориентир PROT-AGE — 25–30 г за приём.
 *
 * Все коэффициенты вынесены в константы для согласования и оперативной корректировки.
 */

export type Sex = 'female' | 'male';
export type Activity = 'low' | 'moderate' | 'strength' | 'heavy';
// low — мало движения; moderate — прогулки/кардио; strength — силовые 2+ раза в неделю; heavy — тяжёлый труд / спорт
export type Goal = 'maintain' | 'lose' | 'gain_muscle';
export type Kidney = 'no' | 'yes' | 'unknown';

export interface ProteinInput {
  sex: Sex;
  age: number;          // лет (18–110)
  weightKg: number;     // кг (30–300)
  heightCm: number;     // см (120–230)
  activity: Activity;
  goal: Goal;
  kidneyDisease: Kidney;
  mealsPerDay?: number; // по умолчанию 3 (1–6)
}

export interface ProteinResult {
  status: 'ok' | 'see_doctor';
  gramsLow?: number;       // г в день, округлено до 5
  gramsHigh?: number;
  gPerKgLow?: number;
  gPerKgHigh?: number;
  perMealLow?: number;     // г за приём
  perMealHigh?: number;
  referenceWeightKg?: number;
  usedAdjustedWeight?: boolean;
  bmi?: number;
  notes: string[];         // пояснения для экрана результата
  sources: string[];       // ключи источников, см. SOURCES
}

export const SOURCES: Record<string, string> = {
  rda: 'Национальные академии США (IOM), Dietary Reference Intakes, 2005: RDA белка 0,8 г/кг в день для взрослых',
  protage: 'Bauer J. et al. Evidence-based recommendations for optimal dietary protein intake in older people: a position paper from the PROT-AGE Study Group. JAMDA, 2013',
  espen: 'Volkert D. et al. ESPEN guideline on clinical nutrition and hydration in geriatrics. Clinical Nutrition, 2019',
  acsm: 'Thomas D.T. et al. Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and the American College of Sports Medicine: Nutrition and Athletic Performance, 2016',
  deficit: 'Экспертная практика: повышенный белок (1,2–1,6 г/кг) при снижении веса для сохранения мышечной массы — по обзорам и РКИ, единого гайдлайна нет',
};

// Именованные константы коэффициентов (для согласования с экспертами)
export const PROTEIN_COEFFICIENTS = {
  AGE_THRESHOLD_SENIOR: 65,
  BASE_LOW_UNDER_65: 0.8,
  BASE_HIGH_UNDER_65: 1.0,
  BASE_LOW_SENIOR: 1.0,
  BASE_HIGH_SENIOR: 1.2,
  ACTIVE_OR_MUSCLE_LOW: 1.2,
  ACTIVE_OR_MUSCLE_HIGH: 1.6,
  WEIGHT_LOSS_LOW: 1.2,
  WEIGHT_LOSS_HIGH: 1.6,
  CAP_G_PER_KG: 2.0,
  BMI_CUTOFF_ADJUSTED: 30,
  BMI_TARGET_REF: 25,
  MIN_AGE: 18,
  MAX_AGE: 110,
  MIN_WEIGHT: 30,
  MAX_WEIGHT: 300,
  MIN_HEIGHT: 120,
  MAX_HEIGHT: 230,
  DEFAULT_MEALS: 3,
  MIN_MEALS: 1,
  MAX_MEALS: 6,
} as const;

export const round5 = (x: number) => Math.round(x / 5) * 5;
export const round1 = (x: number) => Math.round(x * 10) / 10;
const ruNum = (x: number) => round1(x).toLocaleString('ru-RU');

export function calcProteinShield(input: ProteinInput): ProteinResult {
  const { age, weightKg, heightCm, activity, goal, kidneyDisease } = input;
  const meals = Math.min(
    PROTEIN_COEFFICIENTS.MAX_MEALS,
    Math.max(PROTEIN_COEFFICIENTS.MIN_MEALS, Math.round(input.mealsPerDay ?? PROTEIN_COEFFICIENTS.DEFAULT_MEALS))
  );

  if (
    !(age >= PROTEIN_COEFFICIENTS.MIN_AGE && age <= PROTEIN_COEFFICIENTS.MAX_AGE) ||
    !(weightKg >= PROTEIN_COEFFICIENTS.MIN_WEIGHT && weightKg <= PROTEIN_COEFFICIENTS.MAX_WEIGHT) ||
    !(heightCm >= PROTEIN_COEFFICIENTS.MIN_HEIGHT && heightCm <= PROTEIN_COEFFICIENTS.MAX_HEIGHT)
  ) {
    throw new Error('Проверьте возраст (18–110), вес (30–300 кг) и рост (120–230 см)');
  }

  if (kidneyDisease === 'yes') {
    return {
      status: 'see_doctor',
      notes: [
        'При заболеваниях почек норму белка подбирает врач: в некоторых случаях её, наоборот, снижают.',
        'Калькулятор не выдаёт цифру, чтобы не дать неподходящий ориентир.',
      ],
      sources: ['protage'],
    };
  }

  const hM = heightCm / 100;
  const bmi = weightKg / (hM * hM);
  const usedAdjustedWeight = bmi > PROTEIN_COEFFICIENTS.BMI_CUTOFF_ADJUSTED;
  const refWeight = usedAdjustedWeight ? PROTEIN_COEFFICIENTS.BMI_TARGET_REF * hM * hM : weightKg;

  const sources = new Set<string>(['rda']);
  let low: number;
  let high: number;

  // 1. База по возрасту
  if (age >= PROTEIN_COEFFICIENTS.AGE_THRESHOLD_SENIOR) {
    low = PROTEIN_COEFFICIENTS.BASE_LOW_SENIOR;
    high = PROTEIN_COEFFICIENTS.BASE_HIGH_SENIOR;
    sources.add('protage');
    sources.add('espen');
  } else {
    low = PROTEIN_COEFFICIENTS.BASE_LOW_UNDER_65;
    high = PROTEIN_COEFFICIENTS.BASE_HIGH_UNDER_65;
  }

  // 2. Активность и цель «нарастить мышцы»
  if (activity === 'strength' || activity === 'heavy' || goal === 'gain_muscle') {
    low = Math.max(low, PROTEIN_COEFFICIENTS.ACTIVE_OR_MUSCLE_LOW);
    high = Math.max(high, PROTEIN_COEFFICIENTS.ACTIVE_OR_MUSCLE_HIGH);
    sources.add(age >= PROTEIN_COEFFICIENTS.AGE_THRESHOLD_SENIOR ? 'protage' : 'acsm');
  }

  // 3. Снижение веса — защищаем мышцы
  if (goal === 'lose') {
    low = Math.max(low, PROTEIN_COEFFICIENTS.WEIGHT_LOSS_LOW);
    high = Math.max(high, PROTEIN_COEFFICIENTS.WEIGHT_LOSS_HIGH);
    sources.add('deficit');
  }

  high = Math.min(high, PROTEIN_COEFFICIENTS.CAP_G_PER_KG);

  const gramsLow = round5(low * refWeight);
  const gramsHigh = round5(high * refWeight);

  const notes: string[] = [
    `Ориентир: ${gramsLow}–${gramsHigh} г белка в день (${ruNum(low)}–${ruNum(high)} г на кг веса).`,
    `На ${meals} приёма пищи — примерно ${round5(gramsLow / meals)}–${round5(gramsHigh / meals)} г за раз.`,
  ];
  if (age >= PROTEIN_COEFFICIENTS.AGE_THRESHOLD_SENIOR) {
    notes.push('С возрастом мышцам в среднем нужно больше белка на килограмм веса, чем в молодости. Ориентир PROT-AGE — 25–30 г белка за приём пищи.');
  }
  if (usedAdjustedWeight) {
    notes.push(`Расчёт сделан от веса ${Math.round(refWeight)} кг (ИМТ 25 при вашем росте): при высоком ИМТ так считают, чтобы норма не завышалась.`);
  }
  if (kidneyDisease === 'unknown') {
    notes.push('Если есть заболевания почек, норму белка лучше согласовать с врачом.');
  }
  notes.push('Это ориентир по исследованиям, не диагноз и не назначение.');
  notes.push('Сколько белка на самом деле в вашей тарелке, покажет бот VIReyou по фото.');

  return {
    status: 'ok',
    gramsLow,
    gramsHigh,
    gPerKgLow: round1(low),
    gPerKgHigh: round1(high),
    perMealLow: round5(gramsLow / meals),
    perMealHigh: round5(gramsHigh / meals),
    referenceWeightKg: Math.round(refWeight),
    usedAdjustedWeight,
    bmi: round1(bmi),
    notes,
    sources: Array.from(sources),
  };
}
