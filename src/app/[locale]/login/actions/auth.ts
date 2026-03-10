'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from '@/i18n/routing'
import { createClient } from '@/utils/supabase/server'
import fs from 'fs';

const logPath = '/tmp/api-debug.log';

export async function login(formData: FormData, locale: string) {
    const log = (msg: string) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] AUTH LOGIN: ${msg}\n`);
    const supabase = await createClient()

    // type-casting here for convenience
    // in practice, you should validate your inputs
    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    log(`Attempt for email: ${data.email}`);
    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        log(`Error: ${error.message}`);
        return { success: false, error: error.message }
    }
    log(`Success`);

    revalidatePath('/', 'layout')
    redirect({ href: '/cabinet', locale })
}

export async function signup(formData: FormData) {
    const log = (msg: string) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] AUTH SIGNUP: ${msg}\n`);
    const supabase = await createClient()

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    log(`Attempt for email: ${data.email}`);
    const { error } = await supabase.auth.signUp(data)

    if (error) {
        log(`Error: ${error.message}`);
        return { success: false, error: error.message }
    }

    log(`Success`);
    revalidatePath('/', 'layout')

    return { success: true, message: 'Check email to continue sign in process' }
}

export async function logout(locale: string) {
    const supabase = await createClient()
    await supabase.auth.signOut()

    revalidatePath('/', 'layout')
    redirect({ href: '/login', locale })
}
