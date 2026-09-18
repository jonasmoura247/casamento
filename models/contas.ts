// models/contas.ts
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDb } from './db';

export interface Conta {
  id: number;
  email: string;
  senha_hash: string;
  criado_em: string;
}

function gerarHash(senha: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verificarSenha(senhaHash: string, senha: string): boolean {
  const [salt, hash] = senhaHash.split(':');
  const hashTentativa = scryptSync(senha, salt, 64);
  const hashArmazenado = Buffer.from(hash, 'hex');
  return (
    hashTentativa.length === hashArmazenado.length &&
    timingSafeEqual(hashTentativa, hashArmazenado)
  );
}

export function criarConta(dados: { email: string; senha: string }): Conta {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO contas (email, senha_hash) VALUES (?, ?)')
    .run(dados.email, gerarHash(dados.senha));
  return buscarContaPorId(Number(result.lastInsertRowid))!;
}

export function buscarContaPorId(id: number): Conta | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM contas WHERE id = ?').get(id) as Conta | undefined;
}

export function buscarContaPorEmail(email: string): Conta | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM contas WHERE email = ?').get(email) as Conta | undefined;
}
