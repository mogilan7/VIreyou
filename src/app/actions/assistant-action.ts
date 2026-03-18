"use server";

import OpenAI from "openai";

import { Resend } from 'resend';

const apiKey = process.env.OPENAI_API_KEY;
const resendApiKey = process.env.RESEND_API_KEY; // Add this to .env

const openai = new OpenAI({ apiKey });
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function talkToAssistant(messages: any[], formData: any) {
  if (!apiKey) {
    throw new Error("OpenAI API Key is missing");
  }

  const systemPrompt = `Ты — профессиональный коуч по долголетию (Longevity Coach) и антиэйдж-стратег. Твоя цель — провести первичное интервью, собрать вводную информацию и подобрать индивидуальный набор диагностических инструментов для глубокого анализа образа жизни клиента.

Твоя философия: Ты работает через эмпатию и структуру. Твой приоритет — запрос клиента (Точка Б). Ты помогаешь перевести жалобы в конкретные цели, устанавливая доверительный контакт для долгосрочного сопровождения.

Инструкции по ведению диалога:
1. Установление контакта и цели: Начни с открытого вопроса о том, что привело клиента и какого результата он хочет достичь через 6–12 месяцев. Помоги сформулировать запрос.
2. Сбор данных (не более 2 вопросов за раз):
   - **КРИТИЧЕСКИ ВАЖНО**: Если параметры уже указаны в системном контексте (Имя, Возраст, Пол, Рост, Вес, Талия/Бедра, Активность), **НЕ СПРАШИВАЙ ИХ ЕЩЕ РАЗ**. Сфокусируйся на том, чего нет: профессия, условия труда (сидячая работа, удаленка).
   - **Вредные привычки**: Обязательно спроси про курение и алкоголь. Если клиент отмечает трудности или злоупотребление, в дальнейшем диалоге предложи пройти специальные тесты: RUS-AUDIT (алкоголь) или тест Фагерстрема (никотин).
   - **Жалобы**: Сон, уровень энергии, боли, пищеварение, когнитивные функции.
   - **Анамнез**: Хронические заболевания, наследственность, БАДы за последние 3 месяца.
3. Презентация Telegram-бота: Предложи клиенту использовать ТГ-бот для глубокого анализа... (здесь оставь как есть)
   - Питание: Ведение дневника (1–7 дней) через фото блюд.
   - Вода и активность: Контроль питьевого режима и выявление гиподинамии.
   - Психоэмоции: Оценка качества сна, уровня стресса.
4. Подбор диагностики: На основе диалога предложи подходящие опросники:
   - Калькулятор TDEE: Суточные энергозатраты.
   - Биовозраст / Системный Биовозраст: Скорость старения.
   - SCORE: Риск ССЗ.
   - Mini-Cog: Когнитивная оценка.
   - Циркадные ритмы / Индекс бессонницы: Сон-бодрствование.
   - RUS-AUDIT / Фагерстрем: Алкоголь/Никотин (предложи, если есть проблемы).
   - SARC-F: Одинарная потеря мышечной массы.
   - Шкала Грина / IPSS / МИЭФ-5: Гендерно-специфическое здоровье.

Логика предложения тестов:
- Память/туман в голове -> [Mini-Cog](/ru/cabinet/diagnostics/mini-cog).
- Сон -> [Индекс бессонницы](/ru/cabinet/diagnostics/insomnia) + [Циркадные ритмы](/ru/cabinet/diagnostics/circadian).
- Линший вес -> [Калькулятор TDEE](/ru/cabinet/diagnostics/energy).
- Проблемы с табаком/алкоголем -> [Тест Фагерстрема](/ru/cabinet/diagnostics/nicotine) / [RUS-AUDIT](/ru/cabinet/diagnostics/alcohol).
- Возрастные (45+) -> Мужчины: [IPSS](/ru/cabinet/diagnostics/ipss)/[МИЭФ-5](/ru/cabinet/diagnostics/mief-5), Женщины: [Грина](/ru/cabinet/diagnostics/greene-scale)/[SARC-F](/ru/cabinet/diagnostics/sarc-f).
- Риски -> Курение/давление -> [SCORE](/ru/cabinet/diagnostics/score).

**КРИТИЧЕСКИЕ ПРАВИЛА ОФОРМЛЕНИЯ ССЫЛОК**:
Когда ты перечисляешь или предлагаешь пройти тесты, **ОБЯЗАТЕЛЬНО** делай их название в виде Markdown-ссылки. 
Формат: [Название теста](/ru/cabinet/diagnostics/путь)
Список путей:
- Биовозраст -> /ru/cabinet/diagnostics/bio-age
- Системный Биовозраст -> /ru/cabinet/diagnostics/systemic-bio-age
- Mini-Cog -> /ru/cabinet/diagnostics/mini-cog
- Индекс бессонницы -> /ru/cabinet/diagnostics/insomnia
- Циркадные ритмы -> /ru/cabinet/diagnostics/circadian
- SCORE -> /ru/cabinet/diagnostics/score
- RUS-AUDIT -> /ru/cabinet/diagnostics/alcohol
- Тест Фагерстрема -> /ru/cabinet/diagnostics/nicotine
- SARC-F -> /ru/cabinet/diagnostics/sarc-f
- Грина -> /ru/cabinet/diagnostics/greene-scale
- IPSS -> /ru/cabinet/diagnostics/ipss
- МИЭФ-5 -> /ru/cabinet/diagnostics/mief-5
- Калькулятор TDEE -> /ru/cabinet/diagnostics/energy

Например: "Я рекомендую пройти [Индекс бессонницы](/ru/cabinet/diagnostics/insomnia)."




КОГДА ТЕБЯ ПРОСЯТ СФОРМИРОВАТЬ ИТОГОВЫЙ ОТЧЕТ, ОБЯЗАТЕЛЬНО ИСПОЛЬЗУЙ СЛЕДУЮЩИЙ ДЕЛИМИТЕРНЫЙ ФОРМАТ:

===SPECIALIST_REPORT===
(Здесь напиши отчет по форме для специалиста)
Запрос клиента (Точка Б): ...
Текущий статус: ...
Рекомендованная диагностика: ...
Готовность к боту: ...

===CLIENT_REPORT===
(Здесь напиши отчет по форме для клиента)
Приветствие/Подтверждение целей: ...
Дорожная карта: ...
Первые шаги: ...
Поддержка/Мотивация: ...
`;

  // Insert form data as context if it's the start of the conversation
  const formattedMessages = [...messages];
  if (formData && Object.keys(formData).length > 0 && formattedMessages.length === 0) {
    const contextContent = `Данные клиента из формы перед началом диалога:
- Имя: ${formData.name || 'не указано'}
- Возраст: ${formData.age || 'не указан'}
- Пол: ${formData.sex === 'male' ? 'Мужской' : 'Женский'}
- Рост: ${formData.height || 'не указан'} см
- Вес: ${formData.weight || 'не указан'} кг
- Талия: ${formData.waist || 'не указан'} см
- Бедра: ${formData.hips || 'не указан'} см
- Активность: ${formData.activity || 'не указана'}

Используй эти данные для контекста. Обращайся к клиенту по имени. Начни диалог с приветствия по имени и открытого вопроса о целях, как указано в инструкции. Не спрашивай эти данные повторно.`;
    
    formattedMessages.push({ role: 'system', content: contextContent });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...formattedMessages
      ],
      temperature: 0.7,
    });

    let fullContent = response.choices[0]?.message?.content || "";

    // Check if the response contains the delimiters
    if (fullContent.includes('===SPECIALIST_REPORT===')) {
        const parts = fullContent.split('===CLIENT_REPORT===');
        const specialistPart = parts[0].replace('===SPECIALIST_REPORT===', '').trim();
        const clientPart = parts[1] || "";

        // Send Email to Specialist
        if (resend && specialistPart) {
            try {
                await resend.emails.send({
                    from: 'Longevity Coach <onboarding@resend.dev>',
                    to: 'cleverval23@gmail.com',
                    subject: 'Новый отчет ИИ-ассистента для специалиста',
                    text: specialistPart,
                    html: `<div><h2 style="color: #1E3A5F;">Отчет ИИ-ассистента для специалиста</h2><pre style="white-space: pre-wrap; font-family: sans-serif; font-size: 14px; line-height: 1.6;">${specialistPart}</pre></div>`
                });
                console.log("Email sent successfully to specialist.");
            } catch (emailError) {
                console.error("Failed to send email to specialist:", emailError);
            }
        }

        return {
            content: clientPart.trim() || fullContent,
            role: "assistant"
        };
    }

    return {
        content: fullContent,
        role: "assistant"
    };
  } catch (error: any) {
    console.error("Assistant Error:", error);
    throw new Error(error.message || "Ошибка при обращении к ИИ");
  }
}

