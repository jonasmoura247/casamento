// models/sessoes.ts
import { randomBytes } from 'node:crypto';
import { getDb } from './db';

const DURACAO_HORAS = 8;

export function criarSessao(contaId: number): string {
  const token = randomBytes(32).toString('hex');
  const db = getDb();
  db.prepare(
    `INSERT INTO sessoes (token, conta_id, expira_em) VALUES (?, ?, datetime('now', '+${DURACAO_HORAS} hours'))`
  ).run(token, contaId);
  return token;
}

export function resolverContaIdPorToken(token: string): number | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT conta_id FROM sessoes WHERE token = ? AND expira_em > datetime('now')")
    .get(token) as { conta_id: number } | undefined;
  return row?.conta_id;
}

export function apagarSessao(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessoes WHERE token = ?').run(token);
}
