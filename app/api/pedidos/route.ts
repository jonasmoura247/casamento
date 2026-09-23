// app/api/pedidos/route.ts
import { NextResponse } from 'next/server';
import { criar } from '@/controllers/pedidosController';
import { ErroValidacao, lerJson, respostaErro } from '@/lib/validacao';
import { excedeuLimite, obterIp } from '@/lib/rateLimit';

const JANELA_RATE_LIMIT_MS = 10 * 60 * 1000;
const MAX_PEDIDOS = 10;

export async function POST(request: Request) {
  if (excedeuLimite(`pedidos:${obterIp(request)}`, MAX_PEDIDOS, JANELA_RATE_LIMIT_MS)) {
    return NextResponse.json({ erro: 'Muitas tentativas, tente novamente mais tarde' }, { status: 429 });
  }
  try {
    const { presenteId, nomeConvidado, mensagem } = await lerJson(request);
    const pedido = await criar({ presenteId, nomeConvidado, mensagem });
    return NextResponse.json({ pedido }, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroValidacao && erro.message === 'presente indisponivel') {
      return NextResponse.json({ erro: 'Presente indisponivel' }, { status: 404 });
    }
    return respostaErro(erro);
  }
}
