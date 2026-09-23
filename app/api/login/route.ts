// app/api/login/route.ts
import { NextResponse } from 'next/server';
import { login } from '@/controllers/authController';
import { lerJson, respostaErro } from '@/lib/validacao';
import { excedeuLimite, obterIp } from '@/lib/rateLimit';

const OITO_HORAS_EM_SEGUNDOS = 60 * 60 * 8;
const JANELA_RATE_LIMIT_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 10;

export async function POST(request: Request) {
  if (excedeuLimite(`login:${obterIp(request)}`, MAX_TENTATIVAS, JANELA_RATE_LIMIT_MS)) {
    return NextResponse.json({ erro: 'Muitas tentativas, tente novamente mais tarde' }, { status: 429 });
  }
  let resultado;
  try {
    const { email, senha } = await lerJson(request);
    if (typeof email === 'string' && excedeuLimite(`login-conta:${email.trim().toLowerCase()}`, MAX_TENTATIVAS, JANELA_RATE_LIMIT_MS)) {
      return NextResponse.json({ erro: 'Muitas tentativas, tente novamente mais tarde' }, { status: 429 });
    }
    resultado = login({ email, senha });
  } catch (erro) {
    return respostaErro(erro, 401);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('sessao', resultado.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OITO_HORAS_EM_SEGUNDOS,
  });
  return response;
}
