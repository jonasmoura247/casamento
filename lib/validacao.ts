// lib/validacao.ts
import { NextResponse } from 'next/server';

// Erros deste tipo têm mensagem segura para o cliente; qualquer outro erro vira "Erro interno".
export class ErroValidacao extends Error {}

const MAX_BODY_BYTES = 100_000;

export async function lerJson(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    throw new ErroValidacao('Os dados enviados são grandes demais');
  }
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    throw new ErroValidacao('Não foi possível entender os dados enviados');
  }
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    throw new ErroValidacao('Não foi possível entender os dados enviados');
  }
  return corpo as Record<string, unknown>;
}

// Tira qualquer código HTML/script que a pessoa cole por engano (ou de propósito) nos campos.
function semCodigo(valor: string): string {
  return valor.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
}

export function texto(
  valor: unknown,
  campo: string,
  max: number,
  { obrigatorio = false }: { obrigatorio?: boolean } = {}
): string {
  if (valor === undefined || valor === null) valor = '';
  if (typeof valor !== 'string') throw new ErroValidacao(`Preencha o campo "${campo}" com texto`);
  const limpo = semCodigo(valor).trim();
  if (obrigatorio && !limpo) throw new ErroValidacao(`Preencha o campo "${campo}"`);
  if (limpo.length > max) throw new ErroValidacao(`O campo "${campo}" está muito longo (máximo de ${max} letras)`);
  return limpo;
}

export function dataIso(valor: unknown, campo: string): string {
  const data = texto(valor, campo, 10, { obrigatorio: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T00:00:00Z`))) {
    throw new ErroValidacao(`Escolha uma data válida em "${campo}"`);
  }
  return data;
}

export function urlHttps(valor: unknown, campo: string): string {
  const url = texto(valor, campo, 500, { obrigatorio: true });
  try {
    if (new URL(url).protocol !== 'https:') throw new Error();
  } catch {
    throw new ErroValidacao('O link da foto precisa começar com https:// (copie o endereço da imagem completo)');
  }
  return url;
}

export function respostaErro(erro: unknown, status = 400): NextResponse {
  if (erro instanceof ErroValidacao) return NextResponse.json({ erro: erro.message }, { status });
  console.error(erro);
  return NextResponse.json({ erro: 'Algo deu errado. Tente novamente em instantes.' }, { status: 500 });
}
