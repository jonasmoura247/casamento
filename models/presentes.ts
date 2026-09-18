// models/presentes.ts
import { getDb } from './db';

export type StatusPresente = 'disponivel' | 'reservado' | 'pago';

export interface Presente {
  id: number;
  casamento_id: number;
  nome: string;
  descricao: string;
  preco: number;
  imagens: string[];
  status: StatusPresente;
}

const MAX_FOTOS = 5;

interface PresenteRow {
  id: number;
  casamento_id: number;
  nome: string;
  descricao: string;
  preco: number;
  imagens: string;
  status: StatusPresente;
}

function paraFotos(imagens: string[]): string {
  return JSON.stringify(imagens.filter(Boolean).slice(0, MAX_FOTOS));
}

function mapRow(row: PresenteRow): Presente {
  return { ...row, imagens: JSON.parse(row.imagens) };
}

export function listarDisponiveis(casamentoId: number): Presente[] {
  const db = getDb();
  return (
    db
      .prepare("SELECT * FROM presentes WHERE casamento_id = ? AND status = 'disponivel' ORDER BY id")
      .all(casamentoId) as PresenteRow[]
  ).map(mapRow);
}

export function listarTodos(casamentoId: number): Presente[] {
  const db = getDb();
  return (
    db.prepare('SELECT * FROM presentes WHERE casamento_id = ? ORDER BY id').all(casamentoId) as PresenteRow[]
  ).map(mapRow);
}

export function buscarPorId(id: number): Presente | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM presentes WHERE id = ?').get(id) as PresenteRow | undefined;
  return row && mapRow(row);
}

export function criarPresente(dados: {
  casamentoId: number;
  nome: string;
  descricao: string;
  preco: number;
  imagens: string[];
}): Presente {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO presentes (casamento_id, nome, descricao, preco, imagens) VALUES (?, ?, ?, ?, ?)')
    .run(dados.casamentoId, dados.nome, dados.descricao, dados.preco, paraFotos(dados.imagens));
  return buscarPorId(Number(result.lastInsertRowid))!;
}

export function atualizarPresente(
  id: number,
  dados: Partial<Pick<Presente, 'nome' | 'descricao' | 'preco' | 'imagens'>>
): void {
  const atual = buscarPorId(id);
  if (!atual) return;
  const merged = { ...atual, ...dados };
  const db = getDb();
  db.prepare('UPDATE presentes SET nome = ?, descricao = ?, preco = ?, imagens = ? WHERE id = ?').run(
    merged.nome,
    merged.descricao,
    merged.preco,
    paraFotos(merged.imagens),
    id
  );
}

export function atualizarStatus(id: number, status: StatusPresente): void {
  const db = getDb();
  db.prepare('UPDATE presentes SET status = ? WHERE id = ?').run(status, id);
}

export function removerPresente(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM presentes WHERE id = ?').run(id);
}
