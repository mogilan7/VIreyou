import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is missing");
  process.exit(1);
}

async function check() {
  const url = `https://api.telegram.org/bot${token}/getWebhookInfo`;
  try {
    const res = await axios.get(url);
    console.log("Webhook Info:", res.data);
    if (res.data.result.url) {
      console.log("Webhook IS ACTIVE. Deleting it...");
      const delUrl = `https://api.telegram.org/bot${token}/deleteWebhook`;
      const delRes = await axios.get(delUrl);
      console.log("Delete Webhook Result:", delRes.data);
    } else {
      console.log("No active Webhook (Long Polling is allowed)");
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

check();
