import React from 'react';
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardViews from "@/components/dashboard/aeterna/DashboardViews";
import { createClient } from '@/utils/supabase/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function ClientDashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    const isDemo = userId === '00000000-0000-0000-0000-000000000000';

    // 1. Fetch Supabase Profile & Results
    const [{ data: sbProfile }, { data: sbResults }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).single(),
        supabase.from('test_results').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    ]);

    // 3. Fetch from Prisma
    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            healthData: true,
            accessPermissions: {
                include: {
                    test: true
                }
            }
        }
    });

    // 2. Resolve Profile Name
    // Priority: Supabase Profile > Supabase Metadata > Prisma User > Demo Default
    const resolvedName = sbProfile?.full_name ||
        user?.user_metadata?.full_name ||
        dbUser?.full_name ||
        'Андрей Могилев';

    let profile = {
        full_name: resolvedName,
        id: userId
    };

    // 4. Resolve Health Data
    let healthData = dbUser?.healthData || {
        longevity_score: 88,
        biological_age_actual: 44,
        biological_age_calc: 40,
        glucose: 4.8,
        ferritin: 112,
        cortisol: 540,
        vitamin_d3: 68,
        insulin: 4.2,
        ldl_cholesterol: 2.1,
        crp: 0.4,
        homocysteine: 7.2,
        vo2_max: 52.4,
        nutrient_density_pct: 92,
        fasting_window: "16:8"
    };

    // 5. Build Test Results
    // We want to ensure all core tests are present for the "Screenings and Indices" card
    const coreTestIds = ['mini-cog', 'score', 'nicotine', 'alcohol', 'insomnia', 'circadian'];
    const demoData: Record<string, { score: number, interpretation: string }> = {
        'mini-cog': { score: 5, interpretation: 'Когнитивные функции в норме' },
        'score': { score: 2, interpretation: 'Умеренный риск ССЗ' },
        'nicotine': { score: 0, interpretation: 'Зависимость отсутствует' },
        'alcohol': { score: 4, interpretation: 'Низкий риск потребления алкоголя' },
        'insomnia': { score: 5, interpretation: 'Отсутствие клинически значимой бессонницы' },
        'circadian': { score: 1, interpretation: 'Тип: Жаворонок' }
    };

    let testResults: any[] = [];

    // Prioritize results from Supabase if they exist
    if (sbResults && sbResults.length > 0) {
        // Map available results to the structure expected by the UI
        testResults = sbResults.map(r => ({
            test_type: r.test_type,
            score: r.score,
            interpretation: r.interpretation
        }));

        // If we have Prisma info, we can also add tests that don't have results yet
        if (dbUser && dbUser.accessPermissions.length > 0) {
            dbUser.accessPermissions.forEach(ap => {
                if (!testResults.find(tr => tr.test_type === ap.test_id)) {
                    testResults.push({
                        test_type: ap.test_id,
                        score: null,
                        interpretation: ap.test.description || 'Нет данных'
                    });
                }
            });
        }
    } else if (dbUser && dbUser.accessPermissions.length > 0) {
        testResults = dbUser.accessPermissions.map(ap => {
            const demo = demoData[ap.test_id] || { score: null, interpretation: ap.test.description || 'Нет данных' };
            return {
                test_type: ap.test_id,
                score: demo.score,
                interpretation: demo.interpretation
            };
        });
    } else {
        // Fallback for demo or new user: show all core tests with demo data
        testResults = coreTestIds.map(id => ({
            test_type: id === 'alcohol' ? 'RU-AUDIT' : id, // UI prefers RU-AUDIT for alcohol
            score: demoData[id].score,
            interpretation: demoData[id].interpretation
        }));
    }

    return (
        <div className="min-h-screen font-sans flex transition-colors duration-300">
            {/* The old sidebar will remain on the left, but we might want to restyle it later if requested */}
            <div className="hidden lg:block">
                <Sidebar role="client" profileName={profile.full_name} />
            </div>

            <main className="flex-1 w-full lg:ml-64 p-4 md:p-8 overflow-x-hidden pt-24 lg:pt-8">
                <DashboardViews profile={profile} testResults={testResults} healthData={healthData} />
            </main>
        </div>
    );
}
