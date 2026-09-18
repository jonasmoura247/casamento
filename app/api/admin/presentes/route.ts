// app/api/admin/presentes/route.ts
import { NextResponse } from 'next/server';
import { resolverCasamentoIdDaSessao } from '../../_sessao';
import { criar, listar } from '@/controllers/presentesController';

export async function GET() {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  return NextResponse.json({ presentes: listar(casamentoId) });
}

export async function POST(request: Request) {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const dados = await request.json();
  const presente = criar(casamentoId, {
    nome: dados.nome,
    descricao: dados.descricao ?? '',
    preco: Number(dados.preco),
    imagens: Array.isArray(dados.imagens) ? dados.imagens : [],
  });
  return NextResponse.json({ presente }, { status: 201 });
}
