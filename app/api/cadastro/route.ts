// app/api/cadastro/route.ts
import { NextResponse } from 'next/server';
import { cadastrar } from '@/controllers/authController';

const OITO_HORAS_EM_SEGUNDOS = 60 * 60 * 8;

export async function POST(request: Request) {
  const dados = await request.json();
  let resultado;
  try {
    resultado = cadastrar(dados);
  } catch (erro) {
    return NextResponse.json({ erro: (erro as Error).message }, { status: 400 });
  }
  const response = NextResponse.json({ casamento: resultado.casamento }, { status: 201 });
  response.cookies.set('sessao', resultado.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: OITO_HORAS_EM_SEGUNDOS,
  });
  return response;
}
