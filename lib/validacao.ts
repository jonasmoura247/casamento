// lib/validacao.ts
import { NextResponse } from 'next/server';

// Erros deste tipo têm mensagem segura para o cliente; qualquer outro erro vira "Erro interno".
export class ErroValidacao extends Error {}

const MAX_BODY_BYTES = 100_000;

export async function lerJson(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    throw new ErroValidacao('Requisição grande demais');
  }
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    throw new ErroValidacao('Corpo da requisição inválido');
  }
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    throw new ErroValidacao('Corpo da requisição inválido');
  }
  return corpo as Record<string, unknown>;
}

export function texto(
  valor: unknown,
  campo: string,
  max: number,
  { obrigatorio = false }: { obrigatorio?: boolean } = {}
): string {
  if (valor === undefined || valor === null) valor = '';
  if (typeof valor !== 'string') throw new ErroValidacao(`${campo} inválido`);
  const limpo = valor.trim();
  if (obrigatorio && !limpo) throw new ErroValidacao(`${campo} é obrigatório`);
  if (limpo.length > max) throw new ErroValidacao(`${campo} deve ter no máximo ${max} caracteres`);
  return limpo;
}

export function dataIso(valor: unknown, campo: string): string {
  const data = texto(valor, campo, 10, { obrigatorio: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T00:00:00Z`))) {
    throw new ErroValidacao(`${campo} inválida`);
  }
  return data;
}

export function urlHttps(valor: unknown, campo: string): string {
  const url = texto(valor, campo, 500, { obrigatorio: true });
  try {
    if (new URL(url).protocol !== 'https:') throw new Error();
  } catch {
    throw new ErroValidacao(`${campo} deve ser uma URL https válida`);
  }
  return url;
}

export function respostaErro(erro: unknown, status = 400): NextResponse {
  if (erro instanceof ErroValidacao) return NextResponse.json({ erro: erro.message }, { status });
  console.error(erro);
  return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
}
