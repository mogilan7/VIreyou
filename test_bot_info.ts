import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import path from "path";

// Load from local .env.local
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is missing in .env.local");
  process.exit(1);
}

const bot = new Telegraf(token);

async function main() {
  const me = await bot.telegram.getMe();
  console.log("\n--- Bot Information ---");
  console.log(`ID:       ${me.id}`);
  console.log(`Name:     ${me.first_name}`);
  console.log(`Username: @${me.username}`);
  console.log(`Can Join Groups: ${me.can_join_groups}`);
  console.log("-----------------------\n");
}

main().catch(console.error);
