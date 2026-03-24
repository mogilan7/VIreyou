import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = require("../src/lib/prisma").default;

async function main() {
    console.log("Looking up 1 existing profile model...");
    const profile = await prisma.profiles.findFirst();
    if (profile) {
        console.log("✅ Found Profile ID (UUID):", profile.id);
    } else {
        console.log("❌ No profiles found.");
    }
}

main().catch(console.error);
