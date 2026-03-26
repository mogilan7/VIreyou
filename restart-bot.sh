#!/bin/bash

# Скрипт для перезапуска Telegram бота

# Находим PID процесса, содержащего scripts/telegram-bot.ts
PIDS=$(ps aux | grep 'scripts/telegram-bot.ts' | grep -v grep | awk '{print $2}')

if [ -n "$PIDS" ] && [ "$PIDS" != " " ]; then
  echo "Останавливаю бота (PIDs: $PIDS)..."
  kill $PIDS
  sleep 3
  
  # Проверка, остановился ли
  REMAINING=$(ps aux | grep 'scripts/telegram-bot.ts' | grep -v grep | awk '{print $2}')
  if [ -n "$REMAINING" ]; then
    echo "Бот еще работает, выполняю kill -9..."
    kill -9 $REMAINING
  fi
  echo "Бот успешно остановлен."
else
  echo "Бот не запущен."
fi

echo "Запускаю бота вфоновом режиме..."
nohup npx tsx scripts/telegram-bot.ts > telegram-bot.log 2>&1 &
echo "Бот перезапущен в фоновом режиме."
echo "Логи можно проверить командой: tail -f telegram-bot.log"
