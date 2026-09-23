// app/api/cadastro/route.ts
import { NextResponse } from 'next/server';
import { cadastrar } from '@/controllers/authController';
import { lerJson, respostaErro } from '@/lib/validacao';
import { excedeuLimite, obterIp } from '@/lib/rateLimit';

const OITO_HORAS_EM_SEGUNDOS = 60 * 60 * 8;
const JANELA_RATE_LIMIT_MS = 60 * 60 * 1000;
const MAX_TENTATIVAS = 5;

export async function POST(request: Request) {
  if (excedeuLimite(`cadastro:${obterIp(request)}`, MAX_TENTATIVAS, JANELA_RATE_LIMIT_MS)) {
    return NextResponse.json({ erro: 'Muitas tentativas, tente novamente mais tarde' }, { status: 429 });
  }
  let resultado;
  try {
    resultado = cadastrar(await lerJson(request));
  } catch (erro) {
    return respostaErro(erro);
  }
  const response = NextResponse.json({ casamento: resultado.casamento }, { status: 201 });
  response.cookies.set('sessao', resultado.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OITO_HORAS_EM_SEGUNDOS,
  });
  return response;
}
