function calculateKBJU(params: any) {
    let bmr = 0;
    const { gender, age, weight, height, activity, goal } = params;
    
    if (gender === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    const activityMultipliers: Record<string, number> = {
        'sedentary': 1.2,
        'light': 1.375,
        'moderate': 1.55,
        'active': 1.725,
        'very_active': 1.9
    };

    const tdee = bmr * (activityMultipliers[activity] || 1.2);
    
    const goalAdjustments: Record<string, number> = {
        'lose_weight': -500,
        'maintain': 0,
        'gain_muscle': 500
    };

    const targetCalories = tdee + (goalAdjustments[goal] || 0);
    
    const targetProtein = weight * (goal === 'gain_muscle' ? 2.0 : 1.8);
    const targetFat = weight * 0.9;
    const targetCarbs = (targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4;

    return {
        calories: Math.round(targetCalories),
        protein: Math.round(targetProtein),
        fat: Math.round(targetFat),
        carbs: Math.round(targetCarbs)
    };
}

// Вспомогательная функция для отображения меню
async function sendWelcomeMenu(ctx: any, user: any) {
  const imagePath = path.join(__dirname, '../public/bot_assistant_avatar.png');

  let name = 'клиент';
  try {
      let profile = null;
      const authUser = await prisma.users.findFirst({ 
          where: { email: { equals: user.email, mode: 'insensitive' } } 
      });
      if (authUser) {
          profile = await prisma.profiles.findUnique({ where: { id: authUser.id } });
      }

      if (profile?.full_name) {
          name = profile.full_name;
      } else if (user.full_name) {
          name = user.full_name;
      }
  } catch (e) {
      console.log("Profile fetch failed:", e);
  }

  const lang = ctx.state?.lang || 'ru';
  const caption = t(lang, 'Menu.caption', { name });

  const isPro = user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
  const createdDate = user.created_at ? new Date(user.created_at) : new Date();
  const daysSinceCreated = (new Date().getTime() - createdDate.getTime()) / (1000 * 3600 * 24);
  const isTrial = daysSinceCreated <= 3;

  const dashboardUrl = lang === 'en' ? 'https://vireyou.com/en/cabinet/lifestyle' : 'https://vireyou.com/ru/cabinet/lifestyle';
  
  const menuButtons = [
      [Markup.button.callback(t(lang, 'Menu.nutrition'), 'menu_nutrition')],
      [Markup.button.callback(t(lang, 'Menu.activity'), 'menu_activity')],
      [Markup.button.callback(t(lang, 'Menu.sleep'), 'menu_sleep')],
      [Markup.button.callback(t(lang, 'Menu.water'), 'menu_water')],
      [Markup.button.callback(t(lang, 'Menu.habits'), 'menu_habits')]
  ];

  if (isPro || isTrial) {
      menuButtons.push([Markup.button.callback('✨ PRO', 'menu_pro')]);
  }

  menuButtons.push([Markup.button.webApp(t(lang, 'Menu.dashboard'), dashboardUrl)]);
  menuButtons.push([Markup.button.callback(t(lang, 'Menu.settings'), 'menu_settings')]);

  try {
      if (fs.existsSync(imagePath)) {
          await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) }, {
              caption: caption,
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard(menuButtons)
          });
      } else {
           await ctx.reply(caption, {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard(menuButtons)
          });
      }
  } catch (err) {
      console.error("Send Menu error:", err);
  }
}

bot.action('menu_pro', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    await ctx.reply(lang === 'en' ? '🌟 PRO Functions' : '🌟 Функции PRO', 
        Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'en' ? '👥 My Marathon' : '👥 Мой Марафон', 'menu_my_squad')],
            [Markup.button.callback(lang === 'en' ? '🛒 Shop Assistant' : '🛒 Помощник в магазине', 'menu_shop_assistant')],
            [Markup.button.callback(lang === 'en' ? '🍽️ What to eat next?' : '🍽️ Что съесть дальше?', 'menu_what_to_eat')],
            [Markup.button.callback(lang === 'en' ? '⬅️ Back' : '⬅️ Назад', 'menu_main')]
        ])
    );
});

bot.action('menu_main', async (ctx: any) => {
    ctx.answerCbQuery();
    await sendWelcomeMenu(ctx, ctx.state.user);
});
