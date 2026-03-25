import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Telegraf } from "telegraf";

const token = process.env.TELEGRAM_BOT_TOKEN;

async function check() {
  if (!token) {
    console.log("No token");
    return;
  }

  const bot = new Telegraf(token);
  
  try {
     console.log("Starting bot.launch(). Waiting 40 seconds for resolution...");
     
     bot.launch().then(() => {
         console.log("✅ Bot launched successfully!");
         setTimeout(() => {
             console.log("Stopping test bot...");
             bot.stop('SIGINT');
             process.exit(0);
         }, 3000);
     }).catch(err => {
         console.error("❌ bot.launch error:", err.message || err);
     });

  } catch (err: any) {
     console.error("❌ Error:", err.message || err);
  }
}

check();
// Wait 45 seconds
setTimeout(() => {
    console.log("--- tests timeout (45s) ---");
    process.exit(0);
}, 45000);
