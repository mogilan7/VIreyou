import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { PrismaClient } from '@prisma/client';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.BOT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const prisma = new PrismaClient();

function getModel(modelName: string = "gemini-2.5-flash", temperature: number = 0.2) {
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
        generationConfig: {
            temperature: temperature,
            responseMimeType: "application/json",
        }
    });
}

function getTextModel(modelName: string = "gemini-2.5-flash", temperature: number = 0.2) {
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
        generationConfig: {
            temperature: temperature,
        }
    });
}

/**
 * Шаг 1: Распознает еду по фотографии или описанию и выделяет ингредиенты и их вес.
 */
export async function analyzeFoodWithAI(imageBase64?: string, description?: string, referenceDate?: string, lang: string = 'ru') {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const todayStr = referenceDate || new Date().toISOString().split('T')[0];

  const prompt = `You are a professional AI nutritionist and food analyst.
Analyze the provided data (photo and/or text) to identify what the user ate or drank.

**TWO MODES OF OPERATION:**

**MODE A — Packaged/Branded Products** (cans, bottles, packaged snacks, branded foods):
If you see a packaged product (can, bottle, box, wrapper with a label):
- Return it as a SINGLE ingredient in the "ingredients" array.
- The "name" must be a GENERIC, database-friendly description of the product category. Examples:
  - A can of "Snowy Weizen" beer → name: "пшеничное нефильтрованное пиво 4% (Weizen)"
  - A bottle of Coca-Cola → name: "Кока-Кола (газированный напиток)"

**MODE B — Homemade/Prepared/Restaurant Food** (plates, bowls, homemade dishes, complex meals):
If you see a prepared dish, meal, or raw ingredients:
- CRITICAL: Break complex dishes down into their fundamental, raw or cooked BASE INGREDIENTS.
- Do NOT output "Борщ" or "Пицца". Decompose it! Example for "Борщ":
  - "говядина отварная" (80g)
  - "капуста отварная" (50g)
  - "свекла отварная" (60g)
  - "картофель отварной" (50g)
  - "вода" (200g)
- Estimate the weight of each individual base ingredient.
- Use standard, database-friendly names in Russian (e.g., "вареная гречка", "жареная куриная грудка", "оливковое масло").

**GENERAL RULES (both modes):**
1. DO NOT calculate calories or nutrients — only identify base items and their weight in grams.
2. If the food is highly ambiguous and the user didn't specify, set status to "NEEDS_CLARIFICATION" and ask.
3. habit_key: set to "Alcohol" for any alcoholic drink, "Smoking" for tobacco, "Sugar" for candy/sweets, null otherwise.

**CONTEXT:**
Current date: ${todayStr}. Use it as a reference for date_offset_days.

Respond STRICTLY in JSON format:
{
  "status": "SUCCESS" | "NEEDS_CLARIFICATION",
  "clarification_question": "If status is NEEDS_CLARIFICATION, ask the user a short clarifying question in ${lang === 'en' ? 'English' : 'Russian'}. Otherwise null.",
  "description": "Short description of the food/drink in ${lang === 'en' ? 'English' : 'Russian'}.",
  "dish": "Overall name of the dish/product in ${lang === 'en' ? 'English' : 'Russian'}",
  "ingredients": [
    {
      "name": "Base ingredient name (e.g., 'куриная грудка отварная')",
      "grams": 150
    }
  ],
  "date_offset_days": 0,
  "habit_key": "Alcohol" | "Smoking" | "Sugar" | null
}`;

  const model = getModel("gemini-2.5-flash", 0.2);
  const parts: any[] = [{ text: prompt }];

  if (description) parts.push({ text: `Описание пользователя/контекст: "${description}"` });
  if (imageBase64) {
      parts.push({
          inlineData: {
              data: imageBase64,
              mimeType: "image/jpeg"
          }
      });
  }

  const result = await model.generateContent(parts);
  const responseText = result.response.text();
  return JSON.parse(responseText || "{}");
}

/**
 * Шаг 2: Действует как база данных. Получает точные данные на 100 грамм продукта.
 */
export async function getIngredientNutrientsWithAI(ingredientName: string) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  // FIRST: Try to find the exact ingredient in our USDA/Seed database
  try {
    const existingItem = await prisma.foodItem.findFirst({
      where: { name_ru: { contains: ingredientName.toLowerCase(), mode: 'insensitive' } }
    });

    if (existingItem) {
      console.log(`[DB HIT] Found "${ingredientName}" in local DB as "${existingItem.name_ru}"`);
      return {
        calories: Number(existingItem.calories), protein: Number(existingItem.protein),
        carbs: Number(existingItem.carbs), fat: Number(existingItem.fat), fiber: Number(existingItem.fiber || 0),
        sugar_fast: Number(existingItem.sugar_fast || 0), trans_fat: Number(existingItem.trans_fat || 0),
        cholesterol: Number(existingItem.cholesterol || 0), added_sugar: Number(existingItem.added_sugar || 0),
        omega_3: Number(existingItem.omega_3 || 0), omega_6: Number(existingItem.omega_6 || 0),
        water: Number(existingItem.water || 0),
        vitamin_A: Number(existingItem.vitamin_A || 0), vitamin_D: Number(existingItem.vitamin_D || 0),
        vitamin_E: Number(existingItem.vitamin_E || 0), vitamin_K: Number(existingItem.vitamin_K || 0),
        vitamin_B1: Number(existingItem.vitamin_B1 || 0), vitamin_B2: Number(existingItem.vitamin_B2 || 0),
        vitamin_B3: Number(existingItem.vitamin_B3 || 0), vitamin_B5: Number(existingItem.vitamin_B5 || 0),
        vitamin_B6: Number(existingItem.vitamin_B6 || 0), vitamin_B7: Number(existingItem.vitamin_B7 || 0),
        vitamin_B9: Number(existingItem.vitamin_B9 || 0), vitamin_B12: Number(existingItem.vitamin_B12 || 0),
        vitamin_C: Number(existingItem.vitamin_C || 0),
        calcium: Number(existingItem.calcium || 0), iron: Number(existingItem.iron || 0),
        magnesium: Number(existingItem.magnesium || 0), phosphorus: Number(existingItem.phosphorus || 0),
        potassium: Number(existingItem.potassium || 0), sodium: Number(existingItem.sodium || 0),
        zinc: Number(existingItem.zinc || 0), copper: Number(existingItem.copper || 0),
        manganese: Number(existingItem.manganese || 0), selenium: Number(existingItem.selenium || 0),
        iodine: Number(existingItem.iodine || 0),
      };
    }
  } catch (e) {
    console.error("[DB ERROR] Failed to query FoodItem table, falling back to AI", e);
  }

  // SECOND: AI Fallback (if not in DB)
  console.log(`[AI FALLBACK] Generating data for new ingredient: "${ingredientName}"`);
  const prompt = `You are a professional nutritional researcher and food composition database acting as a strict interface to the USDA FoodData Central and Skurikhin databases.
You will receive the name of a base ingredient (raw or cooked).
Your goal is to return accurate nutritional values for exactly 100 GRAMS (or 100 ML) of this food.

**CRITICAL INSTRUCTIONS:**
1. **USDA Base Data:** Use the closest matching item from the USDA Foundation Foods or SR Legacy database.
2. **Micronutrients are MANDATORY:** DO NOT return zeros for vitamins and minerals unless they are truly absent.
3. **Iodine for Seaweeds:** For ingredients like seaweed (вакаме, ламинария) or seafood, you MUST estimate iodine accurately in mcg.
4. **Accuracy:** Round to 1 decimal place.

Return STRICTLY in JSON format with exactly these keys. Do not output anything else:
{
  "name_en": "English USDA equivalent name",
  "calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0,
  "sugar_fast": 0.0, "trans_fat": 0.0, "cholesterol": 0.0, "added_sugar": 0.0,
  "omega_3": 0.0, "omega_6": 0.0, "water": 0.0,
  "vitamin_A": 0.0, "vitamin_D": 0.0, "vitamin_E": 0.0, "vitamin_K": 0.0,
  "vitamin_B1": 0.0, "vitamin_B2": 0.0, "vitamin_B3": 0.0, "vitamin_B5": 0.0, "vitamin_B6": 0.0, "vitamin_B7": 0.0, "vitamin_B9": 0.0, "vitamin_B12": 0.0, "vitamin_C": 0.0,
  "calcium": 0.0, "iron": 0.0, "magnesium": 0.0, "phosphorus": 0.0, "potassium": 0.0, "sodium": 0.0, "zinc": 0.0, "copper": 0.0, "manganese": 0.0, "selenium": 0.0, "iodine": 0.0
}`;

  const model = getModel("gemini-2.5-flash", 0.0);
  const result = await model.generateContent([
    { text: prompt },
    { text: `Ingredient: "${ingredientName}". Provide data for 100g.` }
  ]);

  const responseText = result.response.text();
  const _clean = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();
  const aiData = JSON.parse(_clean || "{}");

  // Save the new item to DB for future use and verification
  try {
    if (aiData.calories !== undefined) {
      await prisma.foodItem.create({
        data: {
          name_ru: ingredientName.toLowerCase(),
          name_en: aiData.name_en || null,
          is_usda_verified: false,
          calories: aiData.calories || 0,
          protein: aiData.protein || 0,
          carbs: aiData.carbs || 0,
          fat: aiData.fat || 0,
          fiber: aiData.fiber || 0,
          sugar_fast: aiData.sugar_fast || 0,
          added_sugar: aiData.added_sugar || 0,
          trans_fat: aiData.trans_fat || 0,
          cholesterol: aiData.cholesterol || 0,
          omega_3: aiData.omega_3 || 0,
          omega_6: aiData.omega_6 || 0,
          water: aiData.water || 0,
          vitamin_A: aiData.vitamin_A || 0,
          vitamin_D: aiData.vitamin_D || 0,
          vitamin_E: aiData.vitamin_E || 0,
          vitamin_K: aiData.vitamin_K || 0,
          vitamin_B1: aiData.vitamin_B1 || 0,
          vitamin_B2: aiData.vitamin_B2 || 0,
          vitamin_B3: aiData.vitamin_B3 || 0,
          vitamin_B5: aiData.vitamin_B5 || 0,
          vitamin_B6: aiData.vitamin_B6 || 0,
          vitamin_B7: aiData.vitamin_B7 || 0,
          vitamin_B9: aiData.vitamin_B9 || 0,
          vitamin_B12: aiData.vitamin_B12 || 0,
          vitamin_C: aiData.vitamin_C || 0,
          calcium: aiData.calcium || 0,
          iron: aiData.iron || 0,
          magnesium: aiData.magnesium || 0,
          phosphorus: aiData.phosphorus || 0,
          potassium: aiData.potassium || 0,
          sodium: aiData.sodium || 0,
          zinc: aiData.zinc || 0,
          copper: aiData.copper || 0,
          manganese: aiData.manganese || 0,
          selenium: aiData.selenium || 0,
          iodine: aiData.iodine || 0,
        }
      });
      console.log(`[DB SAVE] Saved new ingredient to DB: "${ingredientName}"`);
    }
  } catch (e) {
    console.error("[DB ERROR] Failed to save generated FoodItem", e);
  }

  return aiData;
}

/**
 * Шаг 3: Математический расчет финальных нутриентов.
 */
export function calculateTotalNutrients(ingredientsData: Array<{grams: number, nutrientsPer100g: any}>) {
  const totals: any = {
    grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
    sugar_fast: 0, trans_fat: 0, cholesterol: 0, added_sugar: 0, omega_3: 0, omega_6: 0, water: 0,
    vitamin_A: 0, vitamin_D: 0, vitamin_E: 0, vitamin_K: 0,
    vitamin_B1: 0, vitamin_B2: 0, vitamin_B3: 0, vitamin_B5: 0, vitamin_B6: 0, vitamin_B7: 0, vitamin_B9: 0, vitamin_B12: 0, vitamin_C: 0,
    calcium: 0, iron: 0, magnesium: 0, phosphorus: 0, potassium: 0, sodium: 0, zinc: 0, copper: 0, manganese: 0, selenium: 0, iodine: 0
  };

  for (const item of ingredientsData) {
    const ratio = item.grams / 100.0;
    totals.grams += item.grams;
    
    for (const key of Object.keys(totals)) {
      if (key === 'grams') continue;
      if (item.nutrientsPer100g[key] !== undefined) {
        totals[key] += item.nutrientsPer100g[key] * ratio;
      }
    }
  }

  for (const key of Object.keys(totals)) {
    totals[key] = parseFloat(totals[key].toFixed(2));
  }

  return totals;
}

/**
 * Читает скриншоты показателей здоровья.
 */
export async function analyzeScreenshotWithAI(imageBase64: string, referenceDate?: string, lang: string = 'ru') {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  const todayStr = referenceDate || new Date().toISOString().split('T')[0];
  const prompt = `You are a health and fitness screenshot recognition system. Your task is to extract health metrics and return them in a STRICT JSON format.
  
Respond STRICTLY in JSON:
{
  "status": "SUCCESS",
  "type": "SLEEP" | "ACTIVITY" | "UNKNOWN",
  "description": "Short description in ${lang === 'en' ? 'English' : 'Russian'} (e.g., 'Sleep 7h 20m' or 'Activity: 5000 steps').",
  "metrics": {},
  "date_offset_days": 0
}

**METRICS RULES (based on type):**

1. If type is "SLEEP":
   - "duration_hrs": number (hours),
   - "deep_hrs": number (hours),
   - "rem_hrs": number (hours),
   - "light_hrs": number (hours),
   - "hrv": number (ms),
   - "resting_heart_rate": number (bpm).

2. If type is "ACTIVITY":
   - "steps": integer,
   - "active_minutes": integer,
   - "calories_burned": number.

If no data found, return type "UNKNOWN".`;

  const model = getModel("gemini-2.5-flash", 0.1);
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
  ]);
  
  return JSON.parse(result.response.text() || "{}");
}

export async function transcribeVoiceWithAI(file_path: string): Promise<string> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  
  const model = getTextModel("gemini-2.5-flash", 0.0);
  // file_path is the local path to the .oga or .ogg audio file
  const mimeType = file_path.endsWith('.ogg') || file_path.endsWith('.oga') ? 'audio/ogg' : 'audio/mp3';
  
  const audioData = {
    inlineData: {
      data: Buffer.from(await fs.promises.readFile(file_path)).toString("base64"),
      mimeType: mimeType
    }
  };

  const result = await model.generateContent([
    audioData,
    { text: "Transcribe the audio exactly. Output only the transcription text." }
  ]);

  return result.response.text();
}

/**
 * Анализирует текст пользователя для определения категории здоровья.
 */
export async function analyzeTextWithAI(text: string, referenceDate?: string, lang: string = 'ru') {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  const todayStr = referenceDate || new Date().toISOString().split('T')[0];
  const prompt = `You are a professional AI health analyst. Your task is to classify the message and extract metrics into a structured JSON.
Current date: ${todayStr}. Use it as a reference for "today", "yesterday" (date_offset_days: -1), etc.

Return STRICT JSON:
{
  "status": "SUCCESS" | "ERROR",
  "type": "NUTRITION" | "SLEEP" | "ACTIVITY" | "HABIT",
  "description": "Short description in ${lang === 'en' ? 'English' : 'Russian'}.",
  "data": { ... },
  "date_offset_days": 0,
  "habit_key": "Alcohol" | "Smoking" | "Sugar" | null
}

**DATA RULES (DO NOT fill fields not mentioned in the message. Leave them out of the JSON object. Fill only fields explicitly mentioned 'data' object):**
- NUTRITION: { "dish": "name", "ingredients": [ { "name": "Base ingredient name (e.g., 'куриная грудка отварная')", "grams": 250 } ] }
  CRITICAL: Break complex dishes down into their fundamental, raw or cooked BASE INGREDIENTS. Do not output "Борщ", decompose it.
  Identify the base ingredients and their weights. DO NOT calculate calories or nutrients.
  If Alcohol is mentioned, set "habit_key": "Alcohol".
- SLEEP: { "duration_hrs": 8, "deep_hrs": 1.5, "rem_hrs": 2, "light_hrs": 4.5, "hrv": 60, "resting_heart_rate": 55 }
- ACTIVITY: { "steps": 5000, "active_minutes": 30, "calories_burned": 250 }
- HABIT: { "habit_key": "Alcohol" | "Smoking" | "Sugar" }

If message is unclear, return status "ERROR".`;

  const model = getModel("gemini-2.5-flash", 0.2);
  const result = await model.generateContent([
    { text: prompt },
    { text: `Текст: "${text}"` }
  ]);

  return JSON.parse(result.response.text() || "{}");
}

/**
 * Генерирует рекомендации по питанию на основе дневного рациона и базы знаний.
 */
export async function analyzeDailyNutritionWithAI(nutrients: any, userProfile: any, currentTimeStr: string, lang: string = 'ru') {
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    const isEn = lang === 'en';
    
    const promptEn = `Role: You are a highly qualified AI nutritionist and expert in preventive medicine. Your task is to analyze the user's daily diet, identify nutrient deficiencies, and provide recommendations for replenishment, based exclusively on your medical knowledge base.

Knowledge Base Instructions:
1. Standards: Use physiological standards for nutrients. Consider user's gender (${userProfile.gender}), age (${userProfile.age}), weight (${userProfile.weight}kg), and activity level (${userProfile.activity_level}).
2. Interaction: Consider nutrient synergies (e.g., Vitamin C + Iron).
3. Current Time: The local time is ${currentTimeStr}. Recommend a meal type (e.g., dinner, evening snack) suitable for this time. CRITICAL: If it is late at night (after 21:00), strictly advise against heavy meals to preserve sleep quality and circadian rhythms. Suggest only a very light snack (e.g. herbal tea, kefir) or advise fasting until morning, even if there is a large caloric deficit.
4. Selection: Suggest 2-3 specific superfoods from the documents to cover identified gaps.

Algorithm:
1. Compare user data with standards based on KBJU.
2. YOU MUST output a precise list of vitamin/mineral deficits showing the current amount vs the daily goal (e.g. "Iron: 10mg / 18mg").
3. Provide food recommendations suitable for the current time.
4. Add interaction notes.

Report Format:
1. Status: Summary of what is normal and what is critical.
2. Deficits Table/List: STRICT REQUIREMENT. Show precise missing numbers in mg/mcg/g for vitamins and minerals.
3. Food Recommendations: Specific products and the metrics they improve.
4. Important Note: Synergies and bioavailability advice.

Constraints:
- Respond STRICTLY in English.
- Tone: Academic precision with practical utility.`;

    const promptRu = `Role: Ты — высококвалифицированный ИИ-нутрициолог и эксперт по превентивной медицине. Твоя задача — анализировать рацион пользователя за день, выявлять дефициты нутриентов и давать рекомендации по их восполнению, опираясь на твои медицинские знания.

Алгоритм работы:
1. Анализ данных: Сравни полученные от пользователя значения с физиологическими нормами. Обязательно рассчитай норму КБЖУ с учетом пола (${userProfile.gender}), возраста (${userProfile.age}), веса (${userProfile.weight} кг) и активности (${userProfile.activity_level}).
2. Текущее время: У пользователя сейчас ${currentTimeStr}. Рекомендуй прием пищи, подходящий под это время. КРИТИЧЕСКИ ВАЖНО: Если время позднее (после 21:00), строго предостерегай от плотного приема пищи, чтобы не нарушать качество сна и циркадные ритмы. В этом случае предложи максимум легкий перекус (травяной чай, кефир) или посоветуй оставить дефицит КБЖУ на завтрашний день.
3. Выявление дефицитов: ТЫ ОБЯЗАН вывести четкий список/таблицу с микронутриентами (витаминами и минералами), показав сколько получено и сколько осталось до нормы (в мг/мкг). Не используй общие фразы — нужны цифры.
4. Подбор блюд: Предложи 2–3 продукта-суперфуда или блюдо, закрывающее эти дефициты.
5. Учет синергии: Сочетай нутриенты правильно (например, железо + витамин С).

Формат отчета:
1. Статус КБЖУ: Краткое резюме по калориям и БЖУ на данный момент.
2. Дефициты микронутриентов: ОБЯЗАТЕЛЬНО. Конкретные цифры, сколько миллиграмм/микрограмм витаминов и минералов не хватает до нормы.
3. Рекомендация на сейчас (${currentTimeStr}): Блюдо и какие дефициты оно закрывает.
4. Важное примечание: Совет по сочетаемости.

Важно: Отвечай СТРОГО на русском языке.
Tone of Voice: Академическая точность и практическая польза.`;

    const userContextEn = `User Context:
Gender: ${userProfile.gender}
Age: ${userProfile.age}
Weight: ${userProfile.weight} kg
Activity: ${userProfile.activity_level}
Time: ${currentTimeStr}

Daily Nutrient Totals (JSON):
${JSON.stringify(nutrients, null, 2)}`;

    const userContextRu = `Данные пользователя:
Пол: ${userProfile.gender}
Возраст: ${userProfile.age}
Вес: ${userProfile.weight} кг

Дневной рацион (КБЖУ и нутриенты):
${JSON.stringify(nutrients, null, 2)}`;

    const model = getTextModel("gemini-2.5-flash", 0.4); // Using pro for better reasoning
    const result = await model.generateContent([
        { text: isEn ? promptEn : promptRu },
        { text: isEn ? userContextEn : userContextRu }
    ]);

    return result.response.text();
}

/**
 * Оценивает продукт в супермаркете по фото этикетки, учитывая то, что пользователь уже съел сегодня.
 */
export async function analyzeProductLabelWithAI(imageBase64: string, currentNutrients: any, lang: string = 'ru') {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const prompt = `Ты — строгий ИИ-нутрициолог. Пользователь прислал фото продукта из магазина (этикетка состава или БЖУ).
Тебе также передан JSON с тем, что пользователь УЖЕ съел за сегодня.

Твоя задача:
1. Распознать состав продукта на фото (ищи скрытый сахар, Е-добавки, трансжиры).
2. Оценить БЖУ продукта.
3. Сопоставить это с тем, что пользователь уже съел сегодня.
4. Вынести вердикт: стоит ли это покупать?

Верни СТРОГО JSON-объект:
{
  "status": "SUCCESS" | "UNKNOWN",
  "verdict": "BUY" | "LIMIT" | "AVOID",
  "title": "Краткое название продукта",
  "reason": "Объяснение на ${lang === 'en' ? 'английском' : 'русском'} языке, почему стоит или не стоит брать продукт (максимум 3-4 предложения). Упомяни контекст текущего дня (например, 'у вас уже перебор по жирам').",
  "hidden_nasties": ["список вредных добавок, если есть"]
}
Если на фото не еда или текст не читается, верни status "UNKNOWN".

ТЕКУЩИЕ НУТРИЕНТЫ ЗА СЕГОДНЯ:
${JSON.stringify(currentNutrients, null, 2)}
`;

  const model = getModel("gemini-2.5-flash", 0.2);
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
  ]);

  return JSON.parse(result.response.text() || "{}");
}

/**
 * Проактивно предлагает варианты приемов пищи на остаток дня.
 */
export async function getProactiveNutritionAdvice(currentNutrients: any, userProfile: any, currentTimeStr: string, lang: string = 'ru') {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const prompt = `Роль: Ты — адаптивный ИИ-диетолог и эксперт по международной гастрономии. Твоя цель — составлять рацион по КБЖУ, используя только те продукты, которые легко купить в супермаркетах или найти в кафе в текущей локации пользователя.

ВХОДНЫЕ ДАННЫЕ:
Локация (Часовой пояс / Регион): ${userProfile.timezone || 'Не указан'}
Пол: ${userProfile.gender}, Возраст: ${userProfile.age}, Вес: ${userProfile.weight} кг, Активность: ${userProfile.activity_level}
Цель на день: ~${userProfile.target_calories || 2000} ккал (Белки: ~${userProfile.target_protein || 150}г / Жиры: ~${userProfile.target_fat || 70}г / Углеводы: ~${userProfile.target_carbs || 200}г)
Текущее время устройства: ${currentTimeStr}

🚨 ИНСТРУКЦИЯ ПО ВЫПОЛНЕНИЮ (Выполняй строго по шагам):

Шаг 1: Локальный анализ рынка (Скрытый аудит)
Прежде чем предлагать рецепты, проанализируй указанную локацию (ориентируйся на часовой пояс) и определи:
- Какие продукты в этом регионе являются базовыми, дешевыми и доступными в любом магазине/кафе (Локальная корзина).
- Какие продукты в этом регионе являются дефицитом, дорогим импортом или вообще отсутствуют (например: творог, гречка в Юго-Восточной Азии; или специфические виды тофу в Европе). Строго запрети себе использовать эти дефициты.

Шаг 2: Адаптация источников макронутриентов
Замени стандартные диетические клише на локальные аналоги:
- Вместо творога (если регион Азия): Используй яйца, локальный тофу, птицу, рыбу, соевое молоко.
- Вместо гречки (если Азия/США): Используй рис, рисовую/пшеничную лапшу, батат, нут.
- Вместо авокадо/лосося (в регионах с дорогим импортом): Используй локальные источники жиров (местные масла, орехи, семечки) и доступный белок.

Шаг 3: Генерация рекомендаций
Сформируй меню, ИДЕАЛЬНО соответствующее остатку КБЖУ.
- Предлагай популярные локальные блюда, которые легко приготовить или найти в общепите этой страны (контролируя метод приготовления).
- Не будь "Капитаном Очевидность" и не выводи «стену нулей» из 20+ микроэлементов. Покажи только 2-3 ключевых микротриггера, на которые богат предлагаемый прием пищи.

Шаг 4: Контроль математического баланса
Когда рассчитываешь приемы пищи, всегда проверяй, какой остаток макросов (БЖУ) останется на ужин. Не допускай ситуаций, когда на ужин остается 70 г углеводов и 0 г жиров, а ты рекомендуешь «просто съесть рыбу или творог». Предлагаемый рацион должен ФИЗИЧЕСКИ закрывать оставшийся баланс макросов.
Если текущее время позднее (после 21:00), строго предостерегай от плотного приема пищи ради циркадных ритмов и предложи очень легкий перекус (кефир, чай).

Форматирование: Структурируй текст красиво с помощью эмодзи и списков. НЕ используй Markdown (никаких звездочек **), они ломают бота.
Отвечай на ${lang === 'en' ? 'английском' : 'русском'} языке в формате теплого сообщения для Telegram.
`;

  const model = getTextModel("gemini-2.5-flash", 0.7);
  const result = await model.generateContent([
    { text: prompt },
    { text: `Мой рацион за сегодня:\n${JSON.stringify(currentNutrients, null, 2)}\nЧто мне съесть дальше?` }
  ]);

  return result.response.text();
}

export async function determineTimezoneFromCity(city: string): Promise<string> {
  if (!apiKey) return 'Europe/Moscow';
  try {
    const prompt = `Пользователь указал свой город или регион: "${city}". 
Определи его часовой пояс в формате IANA (например, "Europe/Moscow", "Asia/Almaty", "Asia/Yangon"). 
Выведи ТОЛЬКО название часового пояса без кавычек и лишнего текста. 
Если город неизвестен или не удалось определить, выведи "Europe/Moscow".`;
    
    const model = getTextModel("gemini-2.5-flash", 0.1);
    const result = await model.generateContent([{ text: prompt }]);
    const tz = result.response.text().trim();
    
    if (tz.includes('/')) return tz;
    return 'Europe/Moscow';
  } catch (e) {
    console.error("TZ detection error:", e);
    return 'Europe/Moscow';
  }
}
