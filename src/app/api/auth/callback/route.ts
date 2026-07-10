import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/cabinet'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const isLocalEnv = process.env.NODE_ENV === 'development'
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        return NextResponse.redirect(`${siteUrl}${next}`)
      }
    }
  }

  // If there's no code or an error occurred, redirect to login page with an error
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
  return NextResponse.redirect(`${siteUrl}/login?error=auth_callback_failed`)
}
