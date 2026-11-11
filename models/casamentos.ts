// models/casamentos.ts
import { getDb } from './db';

export interface Casamento {
  id: number;
  conta_id: number;
  slug: string;
  nome_casal: string;
  data_casamento: string;
  local: string;
  mensagem: string;
  pix_key: string;
  pix_nome_recebedor: string;
  pix_cidade: string;
  mostrar_contador: 0 | 1;
}

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

export function slugValido(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export function normalizarSlug(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, '-');
}

export function criarCasamento(dados: {
  contaId: number;
  slug: string;
  nomeCasal: string;
  dataCasamento: string;
  local: string;
  mensagem: string;
  pixKey: string;
  pixNomeRecebedor: string;
  pixCidade: string;
}): Casamento {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO casamentos
        (conta_id, slug, nome_casal, data_casamento, local, mensagem, pix_key, pix_nome_recebedor, pix_cidade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      dados.contaId,
      dados.slug,
      dados.nomeCasal,
      dados.dataCasamento,
      dados.local,
      dados.mensagem,
      dados.pixKey,
      dados.pixNomeRecebedor,
      dados.pixCidade
    );
  return buscarPorId(Number(result.lastInsertRowid))!;
}

export function buscarPorId(id: number): Casamento | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM casamentos WHERE id = ?').get(id) as Casamento | undefined;
}

export function buscarPorSlug(slug: string): Casamento | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM casamentos WHERE slug = ?').get(slug) as Casamento | undefined;
}

export function buscarPorContaId(contaId: number): Casamento | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM casamentos WHERE conta_id = ?').get(contaId) as
    | Casamento
    | undefined;
}

export function atualizarCasamento(
  id: number,
  dados: Partial<{
    nomeCasal: string;
    dataCasamento: string;
    local: string;
    mensagem: string;
    pixKey: string;
    pixNomeRecebedor: string;
    pixCidade: string;
    mostrarContador: boolean;
  }>
): void {
  const atual = buscarPorId(id);
  if (!atual) return;
  const db = getDb();
  db.prepare(
    `UPDATE casamentos SET
      nome_casal = ?, data_casamento = ?, local = ?, mensagem = ?,
      pix_key = ?, pix_nome_recebedor = ?, pix_cidade = ?, mostrar_contador = ?
     WHERE id = ?`
  ).run(
    dados.nomeCasal ?? atual.nome_casal,
    dados.dataCasamento ?? atual.data_casamento,
    dados.local ?? atual.local,
    dados.mensagem ?? atual.mensagem,
    dados.pixKey ?? atual.pix_key,
    dados.pixNomeRecebedor ?? atual.pix_nome_recebedor,
    dados.pixCidade ?? atual.pix_cidade,
    dados.mostrarContador === undefined ? atual.mostrar_contador : dados.mostrarContador ? 1 : 0,
    id
  );
}

export function removerCasamento(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM casamentos WHERE id = ?').run(id);
}

export function calcularCorteExpiracao(dataCasamento: string): Date {
  const corte = new Date(`${dataCasamento}T00:00:00.000Z`);
  corte.setUTCDate(corte.getUTCDate() + 1);
  return corte;
}

export function estaExpirado(dataCasamento: string, agora: Date): boolean {
  return agora.getTime() >= calcularCorteExpiracao(dataCasamento).getTime();
}
