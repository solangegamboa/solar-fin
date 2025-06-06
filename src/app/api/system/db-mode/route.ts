
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const databaseMode = process.env.DATABASE_MODE || 'local'; // Default to 'local' if not set

  return NextResponse.json({ mode: databaseMode }, { status: 200 });
}
