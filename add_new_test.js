const fs = require('fs');
const path = require('path');

const ruPath = './messages/ru.json';
const enPath = './messages/en.json';

const ruData = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// 1. Add translations for the new test (FunctionalBioAge)
ruData.FunctionalBioAge = {
  "title": "4 проверки функционального возраста",
  "subtitle": "Без анализов и приборов — только стул, рулетка и 10 минут.",
  "introText1": "Биологический возраст — это не одна цифра. Учёные смотрят, как работает организм: насколько уверенно мы ходим, встаём, держим равновесие.",
  "introText2": "В исследовании Данидин 45-летних ровесников проверяли такими же простыми тестами. И у тех, чей организм старел быстрее, походка была медленнее, ноги слабее, а равновесие хуже.",
  "introText3": "Эти проверки взяты из научных исследований. У каждой есть данные о том, как результат связан со здоровьем в будущем. Это не про оценку. Это ориентир — где у организма есть запас, а где ему не хватает внимания.",
  "forWhomTitle": "Для кого:",
  "forWhomText": "Взрослые от 45 лет. Шкалы рассчитаны на возраст 50+; в более молодом возрасте большинство результатов будет в зелёной зоне — и это нормально.",
  "beforeStartTitle": "Перед началом",
  "beforeStartText": "Безопасность важнее результата: любую проверку можно пропустить, и итог посчитается по остальным.",
  "youNeedTitle": "Что понадобится:",
  "youNeedList": [
    "устойчивый стул без колёсиков и подлокотников, высота сиденья около 43–45 см",
    "рулетка и малярный скотч или два предмета-отметки для 4 метров",
    "секундомер (в телефоне)",
    "стена или спинка стула рядом — чтобы было за что взяться",
    "идеально — второй человек, который засечёт время и подстрахует"
  ],
  "doNotDoTitle": "Лучше не делать проверки сейчас, если:",
  "doNotDoList": [
    "кружится голова, есть боль в груди или одышка в покое",
    "недавно были операция, травма или падение",
    "врач ограничил физическую нагрузку",
    "есть эндопротез тазобедренного или коленного сустава — тогда пропустите проверку со вставанием"
  ],
  "warningText": "Во время проверок: появилась боль, головокружение или неуверенность — остановитесь. Результат не стоит риска. Идут по порядку: от самой простой к самой сложной. Между ними — минута отдыха.",
  "introBtn": "Начать проверки",
  "stepText": "Проверка",
  "stepOf": "из",
  "back": "Назад к диагностике",
  "restart": "Пройти заново",
  "resultTitle": "Ваши результаты",
  "backStep": "Назад",
  "saveBtn": "Сохранить",
  "saving": "Сохранение...",
  "saved": "Сохранено",
  "skip": "Пропустить",
  "next": "Далее",
  "zoneGreen": "Запас",
  "zoneYellow": "Середина",
  "zoneRed": "Зона внимания",
  "tests": {
    "walking": {
      "title": "Скорость ходьбы",
      "shows": "Что показывает: скорость обычной ходьбы врачи называют «шестым жизненным показателем». В ней сразу видна работа мышц, сердца, нервной системы и равновесия.",
      "howToTitle": "Как делать:",
      "howToSteps": [
        "Отмерьте на полу старт и финиш через 4 метра. Перед стартом оставьте ещё 1 метр на разгон, после финиша — 1 метр на торможение.",
        "Идите своим обычным шагом, как по улице. Не спешите.",
        "Засеките время от линии старта до линии финиша.",
        "Сделайте 2 попытки и впишите лучшую. Можно с тростью, если вы ей пользуетесь."
      ],
      "inputLabel": "Время на 4 метра, секунд",
      "placeholder": "Например: 4.2",
      "basedOn": "На чём основано: в объединённом анализе 9 исследований (около 35 000 человек 65+) скорость 1,0 м/с и выше была связана с лучшей ожидаемой выживаемостью (Studenski et al., JAMA, 2011). Порог 0,8 м/с европейский консенсус по саркопении использует как признак сниженной физической функции (EWGSOP2, 2019)."
    },
    "chair": {
      "title": "Вставание со стула за 30 секунд",
      "shows": "Что показывает: силу и выносливость ног. Именно мышцы ног держат нас в движении и защищают от падений.",
      "howToTitle": "Как делать:",
      "howToSteps": [
        "Поставьте стул спинкой к стене, чтобы он не сдвинулся.",
        "Сядьте на середину сиденья, стопы на полу на ширине плеч, руки скрестите на груди.",
        "По команде «старт» встаньте в полный рост и снова сядьте. Повторяйте 30 секунд в спокойном темпе.",
        "Посчитайте, сколько раз вы полностью встали. Если к 30-й секунде вы поднялись больше чем наполовину — это считается. Если без помощи рук встать не получается, результат = 0. Это тоже важная информация, а не провал."
      ],
      "genderLabel": "Пол",
      "genderMale": "Мужской",
      "genderFemale": "Женский",
      "ageLabel": "Возраст",
      "ageSelect": "Выберите возраст",
      "inputLabel": "Число вставаний",
      "placeholder": "Например: 12",
      "basedOn": "Для возраста 45–59 официальных нормативов нет. Временно используем строку 60–64 и подписываем результат «в сравнении с людьми 60+». На чём основано: тест 30-секундного вставания со стула (Jones, Rikli & Beam, 1999) и нормативы Rikli & Jones (1999). Те же границы использует программа CDC STEADI по профилактике падений."
    },
    "balance": {
      "title": "Стойка на одной ноге",
      "shows": "Что показывает: равновесие. Для него мозг одновременно сводит сигналы глаз, вестибулярного аппарата и рецепторов в стопах.",
      "howToTitle": "Как делать:",
      "howToSteps": [
        "Встаньте рядом со стеной или спинкой стула — на расстоянии вытянутой руки, без обуви.",
        "Глаза открыты, взгляд на точку впереди, руки вдоль тела.",
        "Поставьте свободную стопу на заднюю сторону опорной голени и постойте 10 секунд.",
        "Есть 3 попытки, на любой ноге. Потеряли равновесие — сразу возьмитесь за опору."
      ],
      "inputLabel": "Удалось ли простоять 10 секунд хотя бы в одной попытке?",
      "yes": "Да",
      "no": "Нет",
      "basedOn": "У этой проверки две зоны, без середины — так её оценивали в исследовании. На чём основано: в исследовании 1 702 человек 51–75 лет те, кто не смог простоять 10 секунд, чаще умирали в следующие 7 лет. Риск был выше на 84% с поправкой на возраст, пол и заболевания (Araujo et al., British Journal of Sports Medicine, 2022). Это наблюдение, а не причина: равновесие скорее отражает общее состояние организма."
    }
  }
};

enData.FunctionalBioAge = {
  "title": "4 Functional Age Checks",
  "subtitle": "No tests or gadgets — just a chair, measuring tape, and 10 minutes.",
  "introText1": "Biological age is not just one number. Scientists look at how the body works: how confidently we walk, stand up, and keep balance.",
  "introText2": "In the Dunedin study, 45-year-old peers were tested with similar simple tests. Those whose bodies aged faster walked slower, had weaker legs, and poorer balance.",
  "introText3": "These checks are taken from scientific studies. Each has data on how the result relates to future health. This is not an assessment. It's a guide — where your body has a reserve, and where it needs attention.",
  "forWhomTitle": "For whom:",
  "forWhomText": "Adults 45+. Scales are calculated for age 50+; at a younger age, most results will be in the green zone — and that is normal.",
  "beforeStartTitle": "Before starting",
  "beforeStartText": "Safety is more important than the result: any check can be skipped, and the total will be calculated on the rest.",
  "youNeedTitle": "You will need:",
  "youNeedList": [
    "a stable chair without wheels or armrests, seat height about 43–45 cm",
    "a measuring tape and masking tape or two objects to mark 4 meters",
    "a stopwatch (on a phone)",
    "a wall or chair back nearby — to hold onto",
    "ideally — a second person to time and support"
  ],
  "doNotDoTitle": "It's better not to do the checks now if:",
  "doNotDoList": [
    "you feel dizzy, have chest pain, or shortness of breath at rest",
    "you recently had surgery, injury, or a fall",
    "a doctor restricted physical activity",
    "you have a hip or knee replacement — then skip the standing up check"
  ],
  "warningText": "During the checks: if pain, dizziness, or uncertainty appears — stop. The result is not worth the risk. They go in order: from the easiest to the hardest. Take a minute rest between them.",
  "introBtn": "Start Checks",
  "stepText": "Check",
  "stepOf": "of",
  "back": "Back to diagnostics",
  "restart": "Start Over",
  "resultTitle": "Your Results",
  "backStep": "Back",
  "saveBtn": "Save",
  "saving": "Saving...",
  "saved": "Saved",
  "skip": "Skip",
  "next": "Next",
  "zoneGreen": "Reserve",
  "zoneYellow": "Middle",
  "zoneRed": "Attention Zone",
  "tests": {
    "walking": {
      "title": "Walking Speed",
      "shows": "What it shows: doctors call normal walking speed the 'sixth vital sign'. It immediately shows the work of muscles, heart, nervous system, and balance.",
      "howToTitle": "How to do it:",
      "howToSteps": [
        "Mark the start and finish on the floor 4 meters apart. Leave 1 meter before the start to accelerate, and 1 meter after the finish to slow down.",
        "Walk at your normal pace, like on the street. Do not rush.",
        "Time from the start line to the finish line.",
        "Do 2 attempts and enter the best one. You can use a cane if you normally use one."
      ],
      "inputLabel": "Time for 4 meters, seconds",
      "placeholder": "e.g., 4.2",
      "basedOn": "Based on: in a pooled analysis of 9 studies (about 35,000 people 65+), a speed of 1.0 m/s and above was associated with better expected survival (Studenski et al., JAMA, 2011). A threshold of 0.8 m/s is used by the European consensus on sarcopenia as a sign of reduced physical function (EWGSOP2, 2019)."
    },
    "chair": {
      "title": "Chair Stand in 30 Seconds",
      "shows": "What it shows: leg strength and endurance. It is the leg muscles that keep us moving and protect against falls.",
      "howToTitle": "How to do it:",
      "howToSteps": [
        "Place the chair back against the wall so it doesn't move.",
        "Sit in the middle of the seat, feet flat on the floor shoulder-width apart, arms crossed over the chest.",
        "On the 'start' command, stand up straight and sit back down. Repeat for 30 seconds at a calm pace.",
        "Count how many times you fully stood up. If by the 30th second you are more than halfway up — it counts. If you can't stand without using your hands, the result = 0. This is also important information, not a failure."
      ],
      "genderLabel": "Gender",
      "genderMale": "Male",
      "genderFemale": "Female",
      "ageLabel": "Age",
      "ageSelect": "Select age",
      "inputLabel": "Number of stands",
      "placeholder": "e.g., 12",
      "basedOn": "For ages 45–59, there are no official norms. We temporarily use the 60–64 row and label the result 'compared to people 60+'. Based on: 30-second chair stand test (Jones, Rikli & Beam, 1999) and norms by Rikli & Jones (1999). The same boundaries are used by the CDC STEADI fall prevention program."
    },
    "balance": {
      "title": "One-Leg Stand",
      "shows": "What it shows: balance. For this, the brain simultaneously integrates signals from the eyes, vestibular system, and receptors in the feet.",
      "howToTitle": "How to do it:",
      "howToSteps": [
        "Stand near a wall or the back of a chair — at arm's length, without shoes.",
        "Eyes open, look at a point ahead, arms along the body.",
        "Place the free foot on the back of the supporting lower leg and stand for 10 seconds.",
        "You have 3 attempts on either leg. If you lose balance — grab the support immediately."
      ],
      "inputLabel": "Did you stand for 10 seconds in at least one attempt?",
      "yes": "Yes",
      "no": "No",
      "basedOn": "This check has two zones, without a middle — as it was evaluated in the study. Based on: in a study of 1,702 people aged 51–75, those who could not stand for 10 seconds were more likely to die in the next 7 years. The risk was 84% higher adjusting for age, sex, and disease (Araujo et al., British Journal of Sports Medicine, 2022). This is an observation, not a cause: balance rather reflects the overall condition of the organism."
    }
  }
};

// 2. Add titles and descriptions for the new test in Diagnostics
ruData.Diagnostics = ruData.Diagnostics || {};
ruData.Diagnostics.functionalAgeTitle = "Функциональный возраст (4 проверки)";
ruData.Diagnostics.functionalAgeDesc = "Без приборов: скорость ходьбы, равновесие и сила мышц.";

enData.Diagnostics = enData.Diagnostics || {};
enData.Diagnostics.functionalAgeTitle = "Functional Age (4 checks)";
enData.Diagnostics.functionalAgeDesc = "No gadgets: walking speed, balance and muscle strength.";

fs.writeFileSync(ruPath, JSON.stringify(ruData, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));

console.log("Translations updated!");
