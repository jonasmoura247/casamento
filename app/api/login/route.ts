// app/api/login/route.ts
import { NextResponse } from 'next/server';
import { login } from '@/controllers/authController';

const OITO_HORAS_EM_SEGUNDOS = 60 * 60 * 8;

export async function POST(request: Request) {
  const { email, senha } = await request.json();
  let resultado;
  try {
    resultado = login({ email, senha });
  } catch (erro) {
    return NextResponse.json({ erro: (erro as Error).message }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('sessao', resultado.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: OITO_HORAS_EM_SEGUNDOS,
  });
  return response;
}
