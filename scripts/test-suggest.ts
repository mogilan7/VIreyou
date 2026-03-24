import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = require("../src/lib/prisma").default;

async function main() {
    console.log("Starting test script with .env.local loaded.");

    const { POST } = require("../src/app/api/v1/diagnostics/suggest-labs/route");

    // Use a REAL profile UUID that exists in auth.users
    const userId = "c68d0860-63b1-4e48-8354-83e9ba202108"; 

    // 1. Verify User/Profile exists
    const profile = await prisma.profiles.findUnique({ where: { id: userId } });
    if (!profile) {
        console.error("❌ Profile not found with ID:", userId);
        return;
    }

    console.log(`Found profile for ${profile.full_name || "Unknown"}.`);

    // 2. Insert mock questionnaire score (SARC-F > 4)
    console.log("Checking if mock SARC-F score exists...");
    const existingResult = await prisma.test_results.findFirst({
        where: { user_id: userId, test_type: "sarc-f" }
    });

    if (!existingResult) {
        console.log("Inserting mock SARC-F=5 for user...");
        await prisma.test_results.create({
            data: {
                user_id: userId,
                test_type: "sarc-f", 
                score: 5,
                interpretation: "Низкий балл, риск саркопении"
            }
        });
    } else {
         console.log("Mock SARC-F score already exists.");
    }

    // 3. Trigger endpoint logic
    console.log("\nCalling suggest-labs API Route with triggers...");
    const req = new Request("http://localhost:3000/api/v1/diagnostics/suggest-labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId })
    });

    const response = await POST(req);
    const data = await response.json();

    console.log("\n--- API Response ---");
    console.log(JSON.stringify(data, null, 2));
}

main().catch(err => {
    console.error("Test failed:", err);
});
