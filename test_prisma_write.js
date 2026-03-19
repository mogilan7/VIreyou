const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user_id = "e06c66a2-3a5b-4796-aca0-7684f5f6c40e"; // Андрей
    console.log("Reading existing profile...");
    const profile = await prisma.profiles.findUnique({ where: { id: user_id } });
    const existingWelcome = profile?.welcome_data || {};


    console.log("Existing welcome:", existingWelcome);

    const welcome_data = {
       ...existingWelcome,
       weight: "77",
       waist: "88",
       hips: "99"
    };

    console.log("Updating profile with welcome_data:", welcome_data);

    await prisma.profiles.update({
       where: { id: user_id },
       data: { welcome_data: welcome_data }
    });



    console.log("Update sent. Verification...");
    const updated = await prisma.profiles.findUnique({ where: { id: user_id } });
    console.log("Updated welcome_data:", updated?.welcome_data);
  } catch (e) {
    console.error("Crash during update:", e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
