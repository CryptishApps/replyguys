import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const publicRoutes = ['/', '/leaderboard', '/login', '/api/auth', '/api/inngest']
const authRedirectRoutes = ['/', '/login']

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const { response, user } = await updateSession(request)

    const isPublicRoute = publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
    )

    // Redirect authenticated users away from landing/login to dashboard
    if (user && authRedirectRoutes.includes(pathname)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Redirect unauthenticated users to login for protected routes
    if (!isPublicRoute && !user) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
