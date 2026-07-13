"use server";

import { Resend } from 'resend';
import { marked } from 'marked';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDiagnosticEmail(email: string, markdownText: string, userName: string) {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("Не настроен API ключ для почты (RESEND_API_KEY)");
    }

    // Convert Markdown to HTML
    const htmlContent = marked(markdownText);

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
            <p>Здравствуйте, ${userName || 'дорогой друг'}!</p>
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
