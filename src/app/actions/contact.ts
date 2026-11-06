"use server";

import prisma from "@/lib/prisma";
import { getClientIp, hashRateLimitKey, checkDbRateLimit } from "@/lib/rate-limit/dbRateLimit";

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export async function submitContactForm(formData: FormData) {
    const ip = await getClientIp();
    const rateCheck = await checkDbRateLimit(hashRateLimitKey(ip, 'submit_contact_form_ip'), 3, 3600);
    if (!rateCheck.allowed) {
        return { success: false, error: "Слишком много запросов. Пожалуйста, попробуйте позже." };
    }

    const name = formData.get("name") as string;
    const request = formData.get("request") as string;
    const contact = formData.get("contact") as string;
    const messenger = formData.get("messenger") as string;

    if (!name || !request) {
        return { success: false, error: "Missing required fields" };
    }

    try {
        // Find all admins with linked Telegram accounts
        const admins = await prisma.user.findMany({
            where: {
                role: 'admin',
                telegram_id: { not: null }
            },
            select: { telegram_id: true }
        });

        if (admins.length === 0) {
            console.warn("No admins with linked Telegram accounts found to receive contact form.");
            // We'll still return success so the user sees the success message
            return { success: true };
        }

        const botToken = process.env.VIREYOU_BOT_TOKEN || '8648031032:AAHEJ-6KQqIS_I5_VenJXR4uPCYnPk63jiM';
        const cleanName = escapeHtml(name.slice(0, 100));
        const cleanContact = escapeHtml((contact || 'Не указан').slice(0, 100));
        const cleanMessenger = escapeHtml((messenger || 'Не выбран').slice(0, 100));
        const cleanRequest = escapeHtml(request.slice(0, 2000));

        const messageText = `📩 <b>Новая заявка с сайта!</b>\n\n👤 <b>Имя:</b> ${cleanName}\n📞 <b>Телефон:</b> ${cleanContact}\n💬 <b>Мессенджер:</b> ${cleanMessenger}\n\n📝 <b>Сообщение:</b>\n${cleanRequest}`;

        const sendPromises = admins.map(admin => {
            return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: admin.telegram_id,
                    text: messageText,
                    parse_mode: 'HTML'
                })
            }).catch(e => console.error(`Failed to send to admin ${admin.telegram_id}:`, e));
        });

        await Promise.all(sendPromises);

        return { success: true };
    } catch (error) {
        console.error("Error submitting contact form:", error);
        return { success: false, error: "Internal Server Error" };
    }
}
