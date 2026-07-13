"use server";

import prisma from "@/lib/prisma";

export async function submitContactForm(formData: FormData) {
    const name = formData.get("name") as string;
    const request = formData.get("request") as string;
    const contact = formData.get("contact") as string; // Let's check what fields exist

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
        const messageText = `📩 <b>Новая заявка с сайта!</b>\n\n👤 <b>Имя:</b> ${name}\n📞 <b>Контакт:</b> ${contact || 'Не указан'}\n\n💬 <b>Сообщение:</b>\n${request}`;

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
