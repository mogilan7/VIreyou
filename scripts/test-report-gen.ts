import { generatePeriodicReport } from "../src/lib/reportGenerator";
import prisma from "../src/lib/prisma";

async function main() {
  try {
    const user = await prisma.user.findFirst({
        where: { telegram_id: { not: null } }
    });

    if (!user) {
        console.log("No user found with telegram_id to test.");
        return;
    }

    console.log(`Generating report for user: ${user.full_name || user.email} (ID: ${user.id})`);
    
    const report = await generatePeriodicReport(user.id, 7);
    
    console.log("\n--- MARKDOWN ---");
    console.log(report.markdown);
    
    console.log("\n--- JSON (First 500 chars) ---");
    console.log(report.json.substring(0, 500) + "...");

  } catch (error) {
    console.error("Error testing report generation:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
