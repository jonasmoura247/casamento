// app/api/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logout } from '@/controllers/authController';

export async function POST() {
  const token = (await cookies()).get('sessao')?.value;
  if (token) logout(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('sessao');
  return response;
}
