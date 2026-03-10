import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // 1. Create a Test User (for demo purposes)
    // Note: Match this with a real Supabase user ID if one exists, otherwise use a placeholder
    const demoUserId = '00000000-0000-0000-0000-000000000000'; // Placeholder Demo ID

    const user = await prisma.user.upsert({
        where: { email: 'demo@example.com' },
        update: {},
        create: {
            id: demoUserId,
            email: 'demo@example.com',
            role: 'CLIENT',
            full_name: 'Андрей Могилев',
            telegram_id: 'mock_tg_123',
        },
    });

    // 2. Create Health Data for the user
    await prisma.healthData.upsert({
        where: { user_id: user.id },
        update: {
            longevity_score: 88,
            biological_age_actual: 44,
            biological_age_calc: 40,
            hrv_value: 78,
            sleep_duration_hrs: 8.2,
            deep_sleep_hrs: 2.1,
            rem_sleep_hrs: 1.8,
            vo2_max: 54.2,
            fasting_window: "16:8",
            nutrient_density_pct: 94,
            sugar_index: "LOW",
            fiber_intake_g: 35,
            glucose: 4.7,
            ferritin: 115,
            cortisol: 420,
            vitamin_d3: 72,
            insulin: 4.0,
            ldl_cholesterol: 1.9,
            crp: 0.3,
            homocysteine: 6.8,
        },
        create: {
            user_id: user.id,
            longevity_score: 88,
            biological_age_actual: 44,
            biological_age_calc: 40,
            hrv_value: 78,
            sleep_duration_hrs: 8.2,
            deep_sleep_hrs: 2.1,
            rem_sleep_hrs: 1.8,
            vo2_max: 54.2,
            fasting_window: "16:8",
            nutrient_density_pct: 94,
            sugar_index: "LOW",
            fiber_intake_g: 35,
            glucose: 4.7,
            ferritin: 115,
            cortisol: 420,
            vitamin_d3: 72,
            insulin: 4.0,
            ldl_cholesterol: 1.9,
            crp: 0.3,
            homocysteine: 6.8,
        },
    });

    // 3. Create Tests
    const tests = [
        { id: 'mini-cog', name: 'Mini-Cog', description: 'Cognitive screening' },
        { id: 'score', name: 'SCORE (CVD Risk)', description: 'Cardiovascular risk' },
        { id: 'nicotine', name: 'Nicotine Dependence', description: 'Fagerström Test' },
        { id: 'alcohol', name: 'AUDIT (Alcohol)', description: 'Alcohol use disorder' },
        { id: 'insomnia', name: 'Insomnia Severity', description: 'ISI Scale' },
        { id: 'circadian', name: 'Circadian Rhythm', description: 'Morningness-Eveningness' },
    ];

    for (const testData of tests) {
        await prisma.test.upsert({
            where: { id: testData.id },
            update: {},
            create: {
                id: testData.id,
                name: testData.name,
                description: testData.description,
                is_public: true,
            },
        });

        // Grant permission to demo user
        await prisma.accessPermission.upsert({
            where: { user_id_test_id: { user_id: user.id, test_id: testData.id } },
            update: {},
            create: {
                user_id: user.id,
                test_id: testData.id,
            },
        });
    }

    console.log('Seeding completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
