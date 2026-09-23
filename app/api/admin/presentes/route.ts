// app/api/admin/presentes/route.ts
import { NextResponse } from 'next/server';
import { resolverCasamentoIdDaSessao } from '../../_sessao';
import { criar, listar } from '@/controllers/presentesController';
import { lerJson, respostaErro } from '@/lib/validacao';

export async function GET() {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  return NextResponse.json({ presentes: listar(casamentoId) });
}

export async function POST(request: Request) {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  try {
    const presente = criar(casamentoId, await lerJson(request));
    return NextResponse.json({ presente }, { status: 201 });
  } catch (erro) {
    return respostaErro(erro);
  }
}
