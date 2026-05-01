
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReferral(username1, username2) {
    const user1 = await prisma.user.findFirst({
        where: { OR: [{ telegram_username: username1 }, { full_name: { contains: username1 } }] }
    });
    const user2 = await prisma.user.findFirst({
        where: { OR: [{ telegram_username: username2 }, { full_name: { contains: username2 } }] }
    });

    console.log("User 1 (Referrer?):", user1 ? { id: user1.id, name: user1.full_name, tg: user1.telegram_username, balance: user1.balance, referrer_id: user1.referrer_id } : "Not found");
    console.log("User 2 (Referral?):", user2 ? { id: user2.id, name: user2.full_name, tg: user2.telegram_username, balance: user2.balance, referrer_id: user2.referrer_id } : "Not found");

    if (user1 && user2) {
        if (user2.referrer_id === user1.id) {
            console.log("✅ Correct referral link found!");
        } else {
            console.log("❌ User 2 is NOT referred by User 1.");
        }
    }
}

const args = process.argv.slice(2);
checkReferral(args[0], args[1]).then(() => process.exit(0));
