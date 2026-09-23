// app/api/admin/presentes/[id]/route.ts
import { NextResponse } from 'next/server';
import { resolverCasamentoIdDaSessao } from '../../../_sessao';
import { ErroValidacao, lerJson, respostaErro } from '@/lib/validacao';
import { atualizar, remover } from '@/controllers/presentesController';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const { id } = await params;
  try {
    atualizar(casamentoId, Number(id), await lerJson(request));
  } catch (erro) {
    if (erro instanceof ErroValidacao && erro.message === 'presente nao encontrado') {
      return NextResponse.json({ erro: 'Presente nao encontrado' }, { status: 404 });
    }
    return respostaErro(erro);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const { id } = await params;
  try {
    remover(casamentoId, Number(id));
  } catch {
    return NextResponse.json({ erro: 'Presente nao encontrado' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
