'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireUser } from '@/lib/auth/guards'

export async function saveTestResult({
    testType,
    score,
    interpretation,
    rawData
}: {
    testType: string
    score: number
    interpretation: string
    rawData: any
}) {
    const supabase = await createClient()

    // 1. Get current authenticated user strictly from session
    const user = await requireUser();

    // 2. Insert test result
    const { error } = await supabase
        .from('test_results')
        .insert({
            user_id: user.id,
            test_type: testType,
            score: score,
            interpretation: interpretation,
            raw_data: rawData
        })

    if (error) {
        console.error('Error saving test result:', error)
        try {
            const fs = require('fs');
            fs.appendFileSync('/tmp/save_error.txt', `${new Date().toISOString()} - ${testType} - ${error.message}\n`);
        } catch (e) {}
        return { success: false, error: error.message }
    }

    // 3. If this is the energy test, update the user profile too
    if (testType === 'energy' && rawData && rawData.results) {
        try {
            let activityString = rawData.activity?.toString();
            // Optional: Map numeric multipliers back to string keys if needed by bot.
            // But if it's already a string or number, just store it.
            if (activityString === '1.2') activityString = 'sedentary';
            if (activityString === '1.375') activityString = 'light';
            if (activityString === '1.55') activityString = 'moderate';
            if (activityString === '1.725') activityString = 'active';
            if (activityString === '1.9') activityString = 'very_active';

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    gender: rawData.gender,
                    age: rawData.age,
                    weight: rawData.weight,
                    height: rawData.height,
                    activity_level: activityString,
                    goal: rawData.goal,
                    target_calories: rawData.results.targetCalories,
                    target_protein: rawData.results.macros.protein,
                    target_fat: rawData.results.macros.fats,
                    target_carbs: rawData.results.macros.carbs
                }
            })
        } catch (updateError) {
            console.error('Failed to update user profile with energy results:', updateError);
        }
    }

    // 4. Update water target
    if (testType === 'water' && score) {
        try {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    target_water: score
                }
            })
        } catch (updateError) {
            console.error('Failed to update user profile with water results:', updateError);
        }
    }

    // 4b. If protein test, update biometrics (gender, age, weight, height)
    if (testType === 'protein' && rawData) {
        try {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    ...(rawData.gender ? { gender: rawData.gender } : {}),
                    ...(rawData.age ? { age: Number(rawData.age) } : {}),
                    ...(rawData.weight ? { weight: Number(rawData.weight) } : {}),
                    ...(rawData.height ? { height: Number(rawData.height) } : {})
                }
            });
        } catch (updateError) {
            console.error('Failed to update user profile with protein results:', updateError);
        }
    }

    // 5. Revalidate the cabinet page so the new result shows up
    revalidatePath('/[locale]/cabinet', 'page')
    revalidatePath('/[locale]/cabinet/results', 'page')

    return { success: true }
}

export async function getUserBiometrics() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const u = await prisma.user.findUnique({
            where: { id: user.id },
            select: { gender: true, age: true, weight: true, height: true }
        });
        return u;
    } catch (e) {
        return null;
    }
}
