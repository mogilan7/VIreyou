import React from 'react';
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardViews from "@/components/dashboard/aeterna/DashboardViews";
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export default async function ClientDashboardPage() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) {
            console.error('Auth error:', authError);
            // Handle unauthorized - maybe redirect to login instead of crashing
        }

        const userId = user?.id || '00000000-0000-0000-0000-000000000000';
        const isDemo = userId === '00000000-0000-0000-0000-000000000000';

        // 1. Fetch Supabase Profile & Results
        const [{ data: sbProfile, error: profileErr }, { data: sbResults, error: resultsErr }] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
            supabase.from('test_results').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        ]);

        if (profileErr) console.warn('Profile fetch warning:', profileErr);
        if (resultsErr) console.warn('Results fetch warning:', resultsErr);


        // 3. Fetch from Prisma
        let dbUser = null;
        try {
            dbUser = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    healthData: true,
                    biomarker_results: {
                        orderBy: { recorded_at: 'desc' }
                    },
                    accessPermissions: {
                        include: {
                            test: true
                        }
                    },
                    nutritionLogs: true,
                    sleepLogs: true,
                    activityLogs: true,
                    habitLogs: true,
                    hydrationLogs: true
                }
            });
        } catch (prismaErr) {
            console.error('Prisma fetch error:', prismaErr);
            // Don't crash the whole page if Prisma fails (e.g. DB connection issues)
        }

        // 2. Resolve Profile Name
        const resolvedName = sbProfile?.full_name ||
            user?.user_metadata?.full_name ||
            dbUser?.full_name ||
            'Пользователь';


        let profile = {
            full_name: resolvedName,
            id: userId,
            email: user?.email // Added to support admin-only features
        };

        // 4. Resolve Health Data
        let healthData = (dbUser as any)?.healthData || {
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

        const latestBioAgeResult = sbResults?.find(r => r.test_type === 'bio-age');
        if (latestBioAgeResult && latestBioAgeResult.score) {
            healthData.biological_age_calc = latestBioAgeResult.score;
        }

        const biomarkerResults = (dbUser as any)?.biomarker_results || [];

        // 5. Build Test Results
        const coreTestIds = ['mini-cog', 'score', 'nicotine', 'alcohol', 'insomnia', 'circadian', 'sarc-f', 'energy', 'bio-age'];
        const demoData: Record<string, { score: number, interpretation: string }> = {
            'mini-cog': { score: 5, interpretation: 'Когнитивные функции в норме' },
            'score': { score: 2, interpretation: 'Умеренный риск ССЗ' },
            'nicotine': { score: 0, interpretation: 'Зависимость отсутствует' },
            'alcohol': { score: 4, interpretation: 'Низкий риск потребления алкоголя' },
            'insomnia': { score: 5, interpretation: 'Отсутствие клинически значимой бессонницы' },
            'circadian': { score: 1, interpretation: 'Тип: Жаворонок' },
            'sarc-f': { score: 0, interpretation: 'Риск саркопении отсутствует' },
            'energy': { score: 2400, interpretation: 'Базовый метаболизм' },
            'bio-age': { score: 40, interpretation: 'Соответствует паспорту' }
        };

        let testResults: any[] = [];

        if (sbResults && sbResults.length > 0) {
            testResults = sbResults.map(r => ({
                test_type: r.test_type,
                score: r.score,
                interpretation: r.interpretation,
                rawData: r.raw_data || r.rawData,
                created_at: r.created_at
            }));

            if (dbUser && (dbUser as any).accessPermissions.length > 0) {
                (dbUser as any).accessPermissions.forEach((ap: any) => {
                    if (!testResults.find(tr => tr.test_type === ap.test_id)) {
                        testResults.push({
                            test_type: ap.test_id,
                            score: null,
                            interpretation: ap.test.description || 'Нет данных'
                        });
                    }
                });
            }
        } else if (dbUser && (dbUser as any).accessPermissions.length > 0) {
            testResults = (dbUser as any).accessPermissions.map((ap: any) => {
                const demo = demoData[ap.test_id] || { score: null, interpretation: ap.test.description || 'Нет данных' };
                return {
                    test_type: ap.test_id,
                    score: demo.score,
                    interpretation: demo.interpretation
                };
            });
        } else {
            testResults = coreTestIds.map(id => ({
                test_type: id === 'alcohol' ? 'RU-AUDIT' : id,
                score: demoData[id].score,
                interpretation: demoData[id].interpretation
            }));
        }

        return (
            <div className="min-h-screen font-sans flex transition-colors duration-300">
                <Sidebar role="client" profileName={profile.full_name} />

                <main className="flex-1 w-full lg:ml-64 p-4 md:p-8 overflow-x-hidden pt-24 lg:pt-8">
                    {dbUser && !dbUser.telegram_id && (
                        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between shadow-sm">
                            <div className="flex items-center mb-4 sm:mb-0">
                                <div className="bg-blue-100 p-2 rounded-full mr-4 text-blue-600">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.896-.667 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800">Подключите Telegram</h3>
                                    <p className="text-xs text-gray-600">Получайте уведомления и управляйте планом прямо в мессенджере.</p>
                                </div>
                            </div>
                            <a 
                                href={`https://t.me/vireyou_bot?start=link_${dbUser.id}`} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="whitespace-nowrap px-4 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                Подключить Telegram
                            </a>
                        </div>
                    )}
                    <DashboardViews
                        profile={profile}
                        testResults={testResults}
                        healthData={healthData}
                        biomarkerResults={biomarkerResults}
                        nutritionLogs={(dbUser as any)?.nutritionLogs || []}
                        sleepLogs={(dbUser as any)?.sleepLogs || []}
                        activityLogs={(dbUser as any)?.activityLogs || []}
                        habitLogs={(dbUser as any)?.habitLogs || []}
                        hydrationLogs={(dbUser as any)?.hydrationLogs || []}
                        user={dbUser}
                    />
                </main>
            </div>
        );
    } catch (err: any) {
        console.error('Fatal Dashboard Error:', err);
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-red-100">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Ошибка загрузки кабинета</h1>
                    <p className="text-gray-600 mb-6">
                        Произошла ошибка при загрузке данных. Это может быть связано с настройками подключения или временными техническими работами.
                    </p>
                    <div className="bg-red-50 p-4 rounded-lg mb-6 overflow-auto max-h-40">
                        <code className="text-sm text-red-800 break-all">
                            {err.message || 'Unknown server error'}
                        </code>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-brand-primary text-white py-3 rounded-lg font-medium hover:bg-brand-primary/90 transition-all font-sans"
                    >
                        Попробовать снова
                    </button>
                    <p className="mt-4 text-xs text-center text-gray-400">
                        ID ошибки: {Math.random().toString(36).substring(7)}
                    </p>
                </div>
            </div>
        );
    }
}
