'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'User not authenticated' }
    }

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

    // 3. Revalidate the cabinet page so the new result shows up
    revalidatePath('/[locale]/cabinet', 'page')
    revalidatePath('/[locale]/cabinet/results', 'page')

    return { success: true }
}
