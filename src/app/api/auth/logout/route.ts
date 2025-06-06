
import { NextResponse, type NextRequest } from 'next/server';
// import { serialize } from 'cookie'; // Cookie no longer used here

// const COOKIE_NAME = 'authToken'; // Cookie no longer used here

export async function POST(req: NextRequest) {
  // Client will handle removing token from localStorage.
  // This API endpoint can be simplified or used for server-side session invalidation if needed in future.
  // For now, just confirm logout.
  
  // const cookie = serialize(COOKIE_NAME, '', { // Removed cookie invalidation
  //   httpOnly: true,
  //   secure: process.env.NODE_ENV === 'production',
  //   maxAge: 0, 
  //   path: '/',
  //   sameSite: 'lax',
  // });

  const response = NextResponse.json({ success: true, message: 'Logged out successfully (server acknowledgement).' }, { status: 200 });
  // response.headers.set('Set-Cookie', cookie); // Removed cookie setting
  return response;
}
