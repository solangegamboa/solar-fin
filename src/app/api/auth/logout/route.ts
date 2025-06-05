
import { NextResponse, type NextRequest } from 'next/server';
import { serialize } from 'cookie';

const COOKIE_NAME = 'authToken';

export async function POST(req: NextRequest) {
  // Invalidate the cookie by setting its maxAge to 0
  const cookie = serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0, // Expire immediately
    path: '/',
    sameSite: 'lax',
  });

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' }, { status: 200 });
  response.headers.set('Set-Cookie', cookie);
  return response;
}
