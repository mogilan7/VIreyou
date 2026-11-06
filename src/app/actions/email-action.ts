"use server";

import crypto from 'crypto';
import { Resend } from 'resend';
import { marked } from 'marked';
import { getClientIp, hashRateLimitKey, checkDbRateLimit } from '@/lib/rate-limit/dbRateLimit';

const resend = new Resend(process.env.RESEND_API_KEY);

function sanitizeUserName(name: string): string {
  return (name || '').replace(/[^\p{L}\s\d-]/gu, '').slice(0, 50).trim();
}

function sanitizeReportMarkdown(raw: string): string {
  // Strip any raw HTML tags
  let text = raw.replace(/<\/?[^>]+(>|$)/g, '');
  // Strip external links in markdown [label](url) -> label
  text = text.replace(/\[([^\]]+)\]\((?:https?:\/\/[^\)]+)\)/gi, '$1');
  return text;
}

export async function sendDiagnosticEmail(
  email: string,
  markdownText: string,
  userName: string,
  signature?: string
) {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("Не настроен API ключ для почты (RESEND_API_KEY)");
    }

    // 1. Strict email validation
    const normalizedEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 254) {
      return { success: false, error: "Некорректный адрес электронной почты" };
    }

    // 2. IP Rate Limit: max 3 emails per hour
    const ip = await getClientIp();
    const ipCheck = await checkDbRateLimit(hashRateLimitKey(ip, 'send_diagnostic_email_ip'), 3, 3600);
    if (!ipCheck.allowed) {
      return { success: false, error: "Превышен лимит отправки писем с вашего IP (максимум 3 в час)." };
    }

    // 3. Recipient Rate Limit: max 2 emails per 24 hours to the same address
    const emailCheck = await checkDbRateLimit(hashRateLimitKey(normalizedEmail, 'send_diagnostic_email_addr'), 2, 86400);
    if (!emailCheck.allowed) {
      return { success: false, error: "Превышен суточный лимит писем на данный email (максимум 2 в сутки)." };
    }

    // 4. Verify server-side cryptographic signature of report contents
    const secret = process.env.REPORT_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'vireyou-diagnostic-hmac-secret-2026';
    const trimmedMarkdown = (markdownText || '').trim();
    const expectedSignature = crypto.createHmac('sha256', secret).update(trimmedMarkdown).digest('hex');

    if (!signature || signature !== expectedSignature) {
      return { success: false, error: "Отправка отклонена: содержимое отчёта не подтверждено сервером." };
    }

    // 5. Sanitize text and user name: no custom HTML and no external links allowed
    const cleanMarkdown = sanitizeReportMarkdown(trimmedMarkdown);
    const safeUserName = sanitizeUserName(userName);

    // Convert Markdown to HTML
    const htmlContent = marked(cleanMarkdown);

    const emailTemplate = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ваш персональный план диагностики от VIReYou</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #334155;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            margin-top: 20px;
            margin-bottom: 20px;
          }
          .header {
            background-color: #0f3d2f; /* brand-forest */
            color: #ffffff;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .content {
            padding: 30px;
          }
          .content h1, .content h2, .content h3 {
            color: #0f3d2f;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
          }
          .content h2 {
            font-size: 20px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .content h3 {
            font-size: 18px;
          }
          .content p {
            margin-bottom: 1em;
          }
          .content ul {
            padding-left: 20px;
            margin-bottom: 1em;
          }
          .content li {
            margin-bottom: 8px;
          }
          .footer {
            background-color: #f1f5f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
          }
          .btn {
            display: inline-block;
            background-color: #0f3d2f;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            margin-top: 20px;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #d97706;
            padding: 16px;
            margin-top: 30px;
            border-radius: 4px;
            font-size: 14px;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Персональный план обследования</h1>
          </div>
          <div class="content">
            <p>Здравствуйте, ${safeUserName || 'дорогой друг'}!</p>
            <p>Мы сформировали для вас индивидуальный список анализов на основе ваших данных. Сдайте их, чтобы получить полную картину состояния вашего здоровья и начать работу над продлением активного долголетия.</p>
            
            <hr style="border:0; border-top:1px solid #e2e8f0; margin: 30px 0;">
            
            ${htmlContent}
            
            <div class="warning">
              <strong>Медицинский отказ от ответственности:</strong> Данный список анализов сформирован искусственным интеллектом для информационных целей. Обязательно проконсультируйтесь с лечащим врачом перед сдачей анализов и началом любого лечения.
            </div>
            
            <center>
              <a href="https://vireyou.com" class="btn">Перейти в личный кабинет</a>
            </center>
          </div>
          <div class="footer">
            <p>С заботой о вашем здоровье,<br>Команда VIReYou</p>
            <p>© 2026 VIReYou. Все права защищены.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const data = await resend.emails.send({
      from: 'VIReYou Health <hello@vireyou.com>',
      to: [email],
      subject: 'Ваш персональный список анализов от VIReYou',
      html: emailTemplate,
    });

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Email send error:", error);
    return { success: false, error: error.message || "Ошибка отправки почты" };
  }
}
