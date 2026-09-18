# Multi-tenant Casamentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-couple wedding gift site into a multi-tenant product: anyone creates an account, gets a public link at `/<slug>`, sees a countdown to their wedding date, and the link auto-expires one day after the date — with real email/password login replacing the fixed `.env` admin password.

**Architecture:** Reorganize `lib/` into `models/` (data access only) + a new `controllers/` layer (business logic, HTTP-agnostic) so `app/api/**/route.ts` stays a thin adapter. Every `presentes`/`pedidos` row gains `casamento_id`; every admin API resolves that id server-side from the session cookie, never from client input, so one couple can never see another's data. Session auth uses `node:crypto` `scrypt` for password hashing (no new dependency) and a random token stored in a `sessoes` table.

**Tech Stack:** Same as today — Next.js (App Router, TypeScript), better-sqlite3, Vitest with 100% coverage thresholds. No new npm dependencies.

---

## File Structure

- `db/schema.sql` — replaced with the multi-tenant schema (`contas`, `sessoes`, `casamentos`, `presentes`/`pedidos` with `casamento_id`).
- `models/db.ts` — moved from `lib/db.ts`, unchanged logic.
- `models/contas.ts` — password hashing (scrypt) + account CRUD.
- `models/sessoes.ts` — session token create/validate/delete.
- `models/casamentos.ts` — casamento CRUD, slug validation, expiration calculation.
- `models/presentes.ts` — moved from `lib/presentes.ts`, every query scoped by `casamento_id`.
- `models/pedidos.ts` — moved from `lib/pedidos.ts`, unchanged (already scoped through `presente_id`).
- `models/pix.ts` — moved from `lib/pix.ts`, unchanged.
- `controllers/authController.ts` — `cadastrar()`, `login()`, `logout()`.
- `controllers/casamentosController.ts` — `atualizarDados()`, `obterEstadoPublico()` (contador/expiração).
- `controllers/presentesController.ts` — `listar()`, `criar()`, `atualizar()`, `remover()`, all taking `casamentoId` as an explicit argument.
- `controllers/pedidosController.ts` — `criar()`, `buscarStatus()`, `listar()`, `marcarPago()`.
- `middleware.ts` — rewritten: resolves `casamento_id` from the `sessao` cookie via `sessoes → contas → casamentos`, protects `/admin` and `/api/admin/*`.
- `app/api/cadastro/route.ts`, `app/api/login/route.ts`, `app/api/logout/route.ts` — new, thin, call `authController`.
- `app/api/admin/presentes/route.ts`, `[id]/route.ts` — modified to read `casamento_id` from the session and call `presentesController`.
- `app/api/admin/pedidos/route.ts`, `[id]/marcar-pago/route.ts` — modified similarly.
- `app/api/admin/casamento/route.ts` — new, `GET`/`PATCH` for the couple's own data.
- `app/api/pedidos/route.ts` — modified: takes `slug` instead of assuming a single couple, resolves `casamento_id` from it.
- `app/api/pedidos/[id]/route.ts` — unchanged (pedido lookup by id needs no casamento scoping beyond what already exists).
- `app/page.tsx` — replaced: public marketing home ("Criar minha lista" / "Já tenho conta"), no longer couple-specific.
- `app/cadastro/page.tsx` — new signup form.
- `app/login/page.tsx` — new login form.
- `app/[slug]/page.tsx` — new: countdown + gift grid or "encerrado" screen, reusing `GiftGrid`.
- `app/components/Contador.tsx` — new client component, `setInterval` countdown.
- `app/admin/AdminPasswordGate.tsx` — deleted (auth moves to `/login`).
- `app/admin/page.tsx` — modified: redirects to `/login` on 401 instead of showing an inline password form; adds a "Dados do casamento" section.
- `app/api/admin/login/route.ts`, `app/api/admin/session/route.ts` — deleted (replaced by `/api/login` + middleware).
- `vitest.config.ts` — adds `coverage.thresholds` at 100%.
- `.env.local.example` — trimmed to nothing (no more couple/Pix env vars).
- `lib/` — deleted once everything is moved.

---

## Task 1: Coverage thresholds

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Add coverage thresholds**

```typescript
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    coverage: {
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
```

- [ ] **Step 2: Verify the config loads**

Run: `npx vitest run --coverage`
Expected: runs (will likely FAIL on thresholds against current suite — that's expected until later tasks add full coverage; don't chase this to green yet).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test: require 100% coverage thresholds"
```

(If there is no git repo yet in this project, skip commit steps throughout this plan — same as the prior plan's convention.)

---

## Task 2: Multi-tenant schema + `models/db.ts`

**Files:**
- Modify: `db/schema.sql`
- Create: `models/db.ts` (moved from `lib/db.ts`)

- [ ] **Step 1: Replace `db/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS contas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id),
  expira_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS casamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id INTEGER NOT NULL UNIQUE REFERENCES contas(id),
  slug TEXT NOT NULL UNIQUE,
  nome_casal TEXT NOT NULL,
  data_casamento TEXT NOT NULL,
  local TEXT NOT NULL DEFAULT '',
  mensagem TEXT NOT NULL DEFAULT '',
  pix_key TEXT NOT NULL,
  pix_nome_recebedor TEXT NOT NULL,
  pix_cidade TEXT NOT NULL,
  mostrar_contador INTEGER NOT NULL DEFAULT 1 CHECK (mostrar_contador IN (0, 1))
);

CREATE TABLE IF NOT EXISTS presentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  casamento_id INTEGER NOT NULL REFERENCES casamentos(id),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco REAL NOT NULL,
  imagens TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'reservado', 'pago'))
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  presente_id INTEGER NOT NULL REFERENCES presentes(id),
  nome_convidado TEXT NOT NULL,
  mensagem TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento' CHECK (status IN ('aguardando_pagamento', 'pago', 'cancelado')),
  pix_copia_cola TEXT NOT NULL DEFAULT '',
  pix_qr_code_data_url TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Create `models/db.ts`** (identical logic to `lib/db.ts`, new path only)

```typescript
// models/db.ts
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const globalForDb = globalThis as unknown as { __db?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__db) return globalForDb.__db;

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'lista-presentes.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  globalForDb.__db = db;
  return db;
}
```

- [ ] **Step 3: Delete `lib/db.ts` and `lib/db.test.ts`, recreate the test at the new path**

```typescript
// models/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-db.db');

describe('getDb', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    (globalThis as unknown as { __db?: unknown }).__db = undefined;
  });

  it('cria todas as tabelas do schema multi-tenant', async () => {
    const { getDb } = await import('./db');
    const db = getDb();
    const tabelas = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name);
    expect(tabelas).toEqual(
      expect.arrayContaining(['contas', 'sessoes', 'casamentos', 'presentes', 'pedidos'])
    );
  });
});
```

- [ ] **Step 4: Delete the stale test database and run**

Run: `rm -f lista-presentes.db test-*.db && npx vitest run models/db.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add db/schema.sql models/db.ts models/db.test.ts
git rm lib/db.ts lib/db.test.ts
git commit -m "feat: multi-tenant schema and move db module to models/"
```

---

## Task 3: `models/contas.ts` — password hashing and account CRUD

**Files:**
- Create: `models/contas.ts`
- Test: `models/contas.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// models/contas.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-contas.db');

describe('contas', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('cria uma conta com senha em hash, nunca em texto puro', async () => {
    const { criarConta, buscarContaPorId } = await import('./contas');
    const conta = criarConta({ email: 'a@b.com', senha: 'segredo123' });
    expect(conta.email).toBe('a@b.com');
    const salva = buscarContaPorId(conta.id);
    expect(salva?.senha_hash).not.toBe('segredo123');
    expect(salva?.senha_hash).toContain(':');
  });

  it('rejeita email duplicado', async () => {
    const { criarConta } = await import('./contas');
    criarConta({ email: 'dup@b.com', senha: 'x1234567' });
    expect(() => criarConta({ email: 'dup@b.com', senha: 'y1234567' })).toThrow();
  });

  it('verificarSenha retorna true para a senha correta e false para a errada', async () => {
    const { criarConta, verificarSenha } = await import('./contas');
    const conta = criarConta({ email: 'c@b.com', senha: 'correta12' });
    expect(verificarSenha(conta.senha_hash, 'correta12')).toBe(true);
    expect(verificarSenha(conta.senha_hash, 'errada123')).toBe(false);
  });

  it('buscarContaPorEmail encontra e retorna undefined se nao existir', async () => {
    const { criarConta, buscarContaPorEmail } = await import('./contas');
    criarConta({ email: 'd@b.com', senha: '12345678' });
    expect(buscarContaPorEmail('d@b.com')?.email).toBe('d@b.com');
    expect(buscarContaPorEmail('naoexiste@b.com')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run models/contas.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `models/contas.ts`**

```typescript
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run models/contas.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add models/contas.ts models/contas.test.ts
git commit -m "feat: account model with scrypt password hashing"
```

---

## Task 4: `models/sessoes.ts` — session tokens

**Files:**
- Create: `models/sessoes.ts`
- Test: `models/sessoes.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// models/sessoes.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-sessoes.db');

describe('sessoes', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('cria uma sessao e resolve a conta a partir do token', async () => {
    const { criarConta } = await import('./contas');
    const { criarSessao, resolverContaIdPorToken } = await import('./sessoes');
    const conta = criarConta({ email: 'e@b.com', senha: '12345678' });
    const token = criarSessao(conta.id);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    expect(resolverContaIdPorToken(token)).toBe(conta.id);
  });

  it('retorna undefined para token inexistente', async () => {
    const { resolverContaIdPorToken } = await import('./sessoes');
    expect(resolverContaIdPorToken('token-que-nao-existe')).toBeUndefined();
  });

  it('retorna undefined para sessao expirada', async () => {
    const { criarConta } = await import('./contas');
    const { criarSessao, resolverContaIdPorToken } = await import('./sessoes');
    const { getDb } = await import('./db');
    const conta = criarConta({ email: 'f@b.com', senha: '12345678' });
    const token = criarSessao(conta.id);
    getDb().prepare("UPDATE sessoes SET expira_em = datetime('now', '-1 hours') WHERE token = ?").run(token);
    expect(resolverContaIdPorToken(token)).toBeUndefined();
  });

  it('apagarSessao remove o token', async () => {
    const { criarConta } = await import('./contas');
    const { criarSessao, apagarSessao, resolverContaIdPorToken } = await import('./sessoes');
    const conta = criarConta({ email: 'g@b.com', senha: '12345678' });
    const token = criarSessao(conta.id);
    apagarSessao(token);
    expect(resolverContaIdPorToken(token)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run models/sessoes.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `models/sessoes.ts`**

```typescript
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run models/sessoes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add models/sessoes.ts models/sessoes.test.ts
git commit -m "feat: session token model"
```

---

## Task 5: `models/casamentos.ts` — casamento CRUD, slug validation, expiration

**Files:**
- Create: `models/casamentos.ts`
- Test: `models/casamentos.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// models/casamentos.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-casamentos.db');

const DADOS_BASE = {
  slug: 'jonasenatalia',
  nomeCasal: 'Jonas & Natália',
  dataCasamento: '2026-12-12',
  local: 'Sitio Boa Vista',
  mensagem: 'Com carinho',
  pixKey: 'chave-pix',
  pixNomeRecebedor: 'JONAS',
  pixCidade: 'SAO PAULO',
};

describe('casamentos', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('valida slug: aceita minusculas/numeros/hifen entre 3 e 50 chars', async () => {
    const { slugValido } = await import('./casamentos');
    expect(slugValido('jonasenatalia')).toBe(true);
    expect(slugValido('joao-e-maria-2026')).toBe(true);
    expect(slugValido('ab')).toBe(false);
    expect(slugValido('Com Espaco')).toBe(false);
    expect(slugValido('a'.repeat(51))).toBe(false);
  });

  it('normalizarSlug faz lowercase e troca espacos por hifen', async () => {
    const { normalizarSlug } = await import('./casamentos');
    expect(normalizarSlug('Jonas E Natalia')).toBe('jonas-e-natalia');
  });

  it('cria um casamento vinculado a uma conta e busca por slug', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento, buscarPorSlug } = await import('./casamentos');
    const conta = criarConta({ email: 'h@b.com', senha: '12345678' });
    const casamento = criarCasamento({ contaId: conta.id, ...DADOS_BASE });
    expect(casamento.slug).toBe('jonasenatalia');
    expect(buscarPorSlug('jonasenatalia')?.nome_casal).toBe('Jonas & Natália');
  });

  it('rejeita slug duplicado', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento } = await import('./casamentos');
    const c1 = criarConta({ email: 'i@b.com', senha: '12345678' });
    const c2 = criarConta({ email: 'j@b.com', senha: '12345678' });
    criarCasamento({ contaId: c1.id, ...DADOS_BASE });
    expect(() => criarCasamento({ contaId: c2.id, ...DADOS_BASE })).toThrow();
  });

  it('buscarPorContaId encontra o casamento da conta', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento, buscarPorContaId } = await import('./casamentos');
    const conta = criarConta({ email: 'k@b.com', senha: '12345678' });
    criarCasamento({ contaId: conta.id, ...DADOS_BASE });
    expect(buscarPorContaId(conta.id)?.slug).toBe('jonasenatalia');
  });

  it('atualizarCasamento atualiza os campos editaveis', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento, atualizarCasamento, buscarPorSlug } = await import('./casamentos');
    const conta = criarConta({ email: 'l@b.com', senha: '12345678' });
    const casamento = criarCasamento({ contaId: conta.id, ...DADOS_BASE });
    atualizarCasamento(casamento.id, { mensagem: 'Nova mensagem', mostrarContador: false });
    const atualizado = buscarPorSlug('jonasenatalia')!;
    expect(atualizado.mensagem).toBe('Nova mensagem');
    expect(atualizado.mostrar_contador).toBe(0);
  });

  it('calcularCorteExpiracao retorna inicio do dia seguinte a data do casamento', async () => {
    const { calcularCorteExpiracao } = await import('./casamentos');
    const corte = calcularCorteExpiracao('2026-12-12');
    expect(corte.toISOString()).toBe('2026-12-13T00:00:00.000Z');
  });

  it('estaExpirado compara agora contra o corte', async () => {
    const { estaExpirado } = await import('./casamentos');
    expect(estaExpirado('2020-01-01', new Date('2020-01-05'))).toBe(true);
    expect(estaExpirado('2030-01-01', new Date('2020-01-05'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run models/casamentos.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `models/casamentos.ts`**

```typescript
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

export function calcularCorteExpiracao(dataCasamento: string): Date {
  const corte = new Date(`${dataCasamento}T00:00:00.000Z`);
  corte.setUTCDate(corte.getUTCDate() + 1);
  return corte;
}

export function estaExpirado(dataCasamento: string, agora: Date): boolean {
  return agora.getTime() >= calcularCorteExpiracao(dataCasamento).getTime();
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run models/casamentos.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add models/casamentos.ts models/casamentos.test.ts
git commit -m "feat: casamento model with slug validation and expiration calc"
```

---

## Task 6: Move `presentes`/`pedidos`/`pix` into `models/`, scope presentes by `casamento_id`

**Files:**
- Create: `models/presentes.ts` (replaces `lib/presentes.ts`)
- Create: `models/pedidos.ts` (replaces `lib/pedidos.ts`)
- Create: `models/pix.ts` (replaces `lib/pix.ts`, no logic change)
- Test: `models/presentes.test.ts`, `models/pedidos.test.ts`, `models/pix.test.ts`

- [ ] **Step 1: Write failing tests for `models/presentes.ts`, including cross-tenant isolation**

```typescript
// models/presentes.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-presentes.db');

async function criarCasamentoDeTeste(email: string, slug: string) {
  const { criarConta } = await import('./contas');
  const { criarCasamento } = await import('./casamentos');
  const conta = criarConta({ email, senha: '12345678' });
  return criarCasamento({
    contaId: conta.id,
    slug,
    nomeCasal: 'Casal',
    dataCasamento: '2026-12-12',
    local: '',
    mensagem: '',
    pixKey: 'x',
    pixNomeRecebedor: 'X',
    pixCidade: 'X',
  });
}

describe('presentes', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('cria e lista presentes disponiveis apenas do casamento pedido', async () => {
    const casamentoA = await criarCasamentoDeTeste('m@b.com', 'casal-a');
    const casamentoB = await criarCasamentoDeTeste('n@b.com', 'casal-b');
    const { criarPresente, listarDisponiveis } = await import('./presentes');
    criarPresente({ casamentoId: casamentoA.id, nome: 'Panela', descricao: '', preco: 100, imagens: [] });
    criarPresente({ casamentoId: casamentoB.id, nome: 'Liquidificador', descricao: '', preco: 200, imagens: [] });

    const disponiveisA = listarDisponiveis(casamentoA.id);
    expect(disponiveisA).toHaveLength(1);
    expect(disponiveisA[0].nome).toBe('Panela');
  });

  it('nao lista presentes reservados ou pagos', async () => {
    const casamento = await criarCasamentoDeTeste('o@b.com', 'casal-o');
    const { criarPresente, listarDisponiveis, atualizarStatus } = await import('./presentes');
    const p = criarPresente({ casamentoId: casamento.id, nome: 'X', descricao: '', preco: 1, imagens: [] });
    atualizarStatus(p.id, 'reservado');
    expect(listarDisponiveis(casamento.id)).toHaveLength(0);
  });

  it('atualiza e remove um presente', async () => {
    const casamento = await criarCasamentoDeTeste('p@b.com', 'casal-p');
    const { criarPresente, atualizarPresente, removerPresente, buscarPorId } = await import('./presentes');
    const p = criarPresente({ casamentoId: casamento.id, nome: 'Toalhas', descricao: '', preco: 100, imagens: [] });
    atualizarPresente(p.id, { preco: 120 });
    expect(buscarPorId(p.id)?.preco).toBe(120);
    removerPresente(p.id);
    expect(buscarPorId(p.id)).toBeUndefined();
  });

  it('listarTodos so retorna presentes do casamento pedido (isolamento multi-tenant)', async () => {
    const casamentoA = await criarCasamentoDeTeste('q@b.com', 'casal-q');
    const casamentoB = await criarCasamentoDeTeste('r@b.com', 'casal-r');
    const { criarPresente, listarTodos } = await import('./presentes');
    criarPresente({ casamentoId: casamentoA.id, nome: 'A1', descricao: '', preco: 1, imagens: [] });
    criarPresente({ casamentoId: casamentoB.id, nome: 'B1', descricao: '', preco: 1, imagens: [] });
    criarPresente({ casamentoId: casamentoB.id, nome: 'B2', descricao: '', preco: 1, imagens: [] });

    expect(listarTodos(casamentoA.id)).toHaveLength(1);
    expect(listarTodos(casamentoB.id)).toHaveLength(2);
  });

  it('respeita o limite de 5 fotos', async () => {
    const casamento = await criarCasamentoDeTeste('s@b.com', 'casal-s');
    const { criarPresente } = await import('./presentes');
    const p = criarPresente({
      casamentoId: casamento.id,
      nome: 'Muitas fotos',
      descricao: '',
      preco: 1,
      imagens: ['1', '2', '3', '4', '5', '6', '7'],
    });
    expect(p.imagens).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run models/presentes.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `models/presentes.ts`** (same as `lib/presentes.ts` plus `casamento_id` scoping)

```typescript
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run models/presentes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Move `lib/pedidos.ts` and its test to `models/` unchanged** (no schema/logic change needed — `pedidos` already scopes through `presente_id`, which now belongs to a casamento)

```typescript
// models/pedidos.ts
import { getDb } from './db';
import { atualizarStatus as atualizarStatusPresente } from './presentes';

export type StatusPedido = 'aguardando_pagamento' | 'pago' | 'cancelado';

export interface Pedido {
  id: number;
  presente_id: number;
  nome_convidado: string;
  mensagem: string;
  status: StatusPedido;
  pix_copia_cola: string;
  pix_qr_code_data_url: string;
  criado_em: string;
}

export function criarPedido(dados: {
  presenteId: number;
  nomeConvidado: string;
  mensagem: string;
  pixCopiaCola: string;
  pixQrCodeDataUrl: string;
}): Pedido {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO pedidos (presente_id, nome_convidado, mensagem, pix_copia_cola, pix_qr_code_data_url)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      dados.presenteId,
      dados.nomeConvidado,
      dados.mensagem,
      dados.pixCopiaCola,
      dados.pixQrCodeDataUrl
    );

  atualizarStatusPresente(dados.presenteId, 'reservado');

  return buscarPedidoPorId(Number(result.lastInsertRowid))!;
}

export function buscarPedidoPorId(id: number): Pedido | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id) as Pedido | undefined;
}

export function listarPedidos(casamentoId: number): Pedido[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT pedidos.* FROM pedidos
       JOIN presentes ON presentes.id = pedidos.presente_id
       WHERE presentes.casamento_id = ?
       ORDER BY pedidos.id DESC`
    )
    .all(casamentoId) as Pedido[];
}

export function marcarComoPago(id: number): void {
  const pedido = buscarPedidoPorId(id);
  if (!pedido) return;
  const db = getDb();
  db.prepare("UPDATE pedidos SET status = 'pago' WHERE id = ?").run(id);
  atualizarStatusPresente(pedido.presente_id, 'pago');
}

const CONDICAO_EXPIRADO = `status = 'aguardando_pagamento' AND datetime(criado_em) < datetime('now', '-1 hours')`;

export function expirarPedidosAntigos(): void {
  const db = getDb();
  db.prepare(
    `UPDATE presentes SET status = 'disponivel'
     WHERE id IN (SELECT presente_id FROM pedidos WHERE ${CONDICAO_EXPIRADO})`
  ).run();
  db.prepare(`UPDATE pedidos SET status = 'cancelado' WHERE ${CONDICAO_EXPIRADO}`).run();
}
```

Note the change from the old `listarPedidos()` (no args) to `listarPedidos(casamentoId)` — this is the multi-tenant scoping point for the admin's order list.

- [ ] **Step 6: Write `models/pedidos.test.ts`** (same 4 cases as the old `lib/pedidos.test.ts`, plus one for scoped listing)

```typescript
// models/pedidos.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-pedidos.db');

async function criarCasamentoComPresente(email: string, slug: string, nomePresente: string) {
  const { criarConta } = await import('./contas');
  const { criarCasamento } = await import('./casamentos');
  const { criarPresente } = await import('./presentes');
  const conta = criarConta({ email, senha: '12345678' });
  const casamento = criarCasamento({
    contaId: conta.id,
    slug,
    nomeCasal: 'Casal',
    dataCasamento: '2026-12-12',
    local: '',
    mensagem: '',
    pixKey: 'x',
    pixNomeRecebedor: 'X',
    pixCidade: 'X',
  });
  const presente = criarPresente({ casamentoId: casamento.id, nome: nomePresente, descricao: '', preco: 100, imagens: [] });
  return { casamento, presente };
}

describe('pedidos', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('cria um pedido e marca o presente como reservado', async () => {
    const { presente } = await criarCasamentoComPresente('t@b.com', 'casal-t', 'Copos');
    const { criarPedido } = await import('./pedidos');
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Maria',
      mensagem: 'Parabens!',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });
    expect(pedido.status).toBe('aguardando_pagamento');
    const { buscarPorId } = await import('./presentes');
    expect(buscarPorId(presente.id)?.status).toBe('reservado');
  });

  it('marca um pedido como pago e o presente como pago', async () => {
    const { presente } = await criarCasamentoComPresente('u@b.com', 'casal-u', 'Panela');
    const { criarPedido, marcarComoPago, buscarPedidoPorId } = await import('./pedidos');
    const { buscarPorId } = await import('./presentes');
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Joao',
      mensagem: '',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });
    marcarComoPago(pedido.id);
    expect(buscarPedidoPorId(pedido.id)?.status).toBe('pago');
    expect(buscarPorId(presente.id)?.status).toBe('pago');
  });

  it('expira pedidos com mais de 1h e libera o presente', async () => {
    const { presente } = await criarCasamentoComPresente('v@b.com', 'casal-v', 'Ferro');
    const { criarPedido, expirarPedidosAntigos, buscarPedidoPorId } = await import('./pedidos');
    const { buscarPorId } = await import('./presentes');
    const { getDb } = await import('./db');
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Ana',
      mensagem: '',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    getDb().prepare('UPDATE pedidos SET criado_em = ? WHERE id = ?').run(duasHorasAtras, pedido.id);
    expirarPedidosAntigos();
    expect(buscarPedidoPorId(pedido.id)?.status).toBe('cancelado');
    expect(buscarPorId(presente.id)?.status).toBe('disponivel');
  });

  it('nao expira pedidos com menos de 1h', async () => {
    const { presente } = await criarCasamentoComPresente('w@b.com', 'casal-w', 'Aspirador');
    const { criarPedido, expirarPedidosAntigos, buscarPedidoPorId } = await import('./pedidos');
    const { buscarPorId } = await import('./presentes');
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Carlos',
      mensagem: '',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });
    expirarPedidosAntigos();
    expect(buscarPedidoPorId(pedido.id)?.status).toBe('aguardando_pagamento');
    expect(buscarPorId(presente.id)?.status).toBe('reservado');
  });

  it('listarPedidos so retorna pedidos do casamento pedido (isolamento multi-tenant)', async () => {
    const { casamento: casamentoA, presente: presenteA } = await criarCasamentoComPresente('x@b.com', 'casal-x', 'A');
    const { presente: presenteB } = await criarCasamentoComPresente('y@b.com', 'casal-y', 'B');
    const { criarPedido, listarPedidos } = await import('./pedidos');
    criarPedido({ presenteId: presenteA.id, nomeConvidado: 'G1', mensagem: '', pixCopiaCola: 'x', pixQrCodeDataUrl: 'x' });
    criarPedido({ presenteId: presenteB.id, nomeConvidado: 'G2', mensagem: '', pixCopiaCola: 'x', pixQrCodeDataUrl: 'x' });
    expect(listarPedidos(casamentoA.id)).toHaveLength(1);
    expect(listarPedidos(casamentoA.id)[0].nome_convidado).toBe('G1');
  });
});
```

- [ ] **Step 7: Move `lib/pix.ts` and its test to `models/pix.ts` / `models/pix.test.ts` verbatim** (only the file location changes — copy the exact content already in `lib/pix.ts` and `lib/pix.test.ts` into the new path, no code edits)

- [ ] **Step 8: Delete the old `lib/presentes.ts`, `lib/presentes.test.ts`, `lib/pedidos.ts`, `lib/pedidos.test.ts`, `lib/pix.ts`, `lib/pix.test.ts`**

- [ ] **Step 9: Run all model tests**

Run: `npx vitest run models/`
Expected: PASS (all tests across contas, sessoes, casamentos, presentes, pedidos, pix, db)

- [ ] **Step 10: Commit**

```bash
git add models/
git rm -r lib/
git commit -m "feat: scope presentes/pedidos by casamento_id, move data layer to models/"
```

---

## Task 7: `controllers/authController.ts`

**Files:**
- Create: `controllers/authController.ts`
- Test: `controllers/authController.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// controllers/authController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-auth-controller.db');

const DADOS_CADASTRO = {
  email: 'z@b.com',
  senha: '12345678',
  slug: 'novo-casal',
  nomeCasal: 'Novo Casal',
  dataCasamento: '2027-01-01',
  local: '',
  mensagem: '',
  pixKey: 'chave',
  pixNomeRecebedor: 'NOME',
  pixCidade: 'CIDADE',
};

describe('authController', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('cadastrar cria conta + casamento e retorna um token de sessao', async () => {
    const { cadastrar } = await import('./authController');
    const resultado = cadastrar(DADOS_CADASTRO);
    expect(resultado.token).toBeTruthy();
    expect(resultado.casamento.slug).toBe('novo-casal');
  });

  it('cadastrar rejeita slug invalido', async () => {
    const { cadastrar } = await import('./authController');
    expect(() => cadastrar({ ...DADOS_CADASTRO, slug: 'ab' })).toThrow('slug invalido');
  });

  it('cadastrar rejeita email ja cadastrado', async () => {
    const { cadastrar } = await import('./authController');
    cadastrar(DADOS_CADASTRO);
    expect(() => cadastrar({ ...DADOS_CADASTRO, slug: 'outro-slug' })).toThrow('email ja cadastrado');
  });

  it('cadastrar rejeita slug ja em uso', async () => {
    const { cadastrar } = await import('./authController');
    cadastrar(DADOS_CADASTRO);
    expect(() => cadastrar({ ...DADOS_CADASTRO, email: 'outro@b.com' })).toThrow('slug ja em uso');
  });

  it('login com credenciais corretas retorna token', async () => {
    const { cadastrar, login } = await import('./authController');
    cadastrar(DADOS_CADASTRO);
    const resultado = login({ email: DADOS_CADASTRO.email, senha: DADOS_CADASTRO.senha });
    expect(resultado.token).toBeTruthy();
  });

  it('login com senha errada lanca erro', async () => {
    const { cadastrar, login } = await import('./authController');
    cadastrar(DADOS_CADASTRO);
    expect(() => login({ email: DADOS_CADASTRO.email, senha: 'errada' })).toThrow('credenciais invalidas');
  });

  it('login com email inexistente lanca erro', async () => {
    const { login } = await import('./authController');
    expect(() => login({ email: 'ninguem@b.com', senha: 'x' })).toThrow('credenciais invalidas');
  });

  it('logout apaga a sessao', async () => {
    const { cadastrar, logout } = await import('./authController');
    const { resolverContaIdPorToken } = await import('../models/sessoes');
    const { token } = cadastrar(DADOS_CADASTRO);
    logout(token);
    expect(resolverContaIdPorToken(token)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run controllers/authController.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `controllers/authController.ts`**

```typescript
// controllers/authController.ts
import { criarConta, buscarContaPorEmail, verificarSenha } from '../models/contas';
import { criarCasamento, slugValido, normalizarSlug, type Casamento } from '../models/casamentos';
import { criarSessao, apagarSessao } from '../models/sessoes';

export function cadastrar(dados: {
  email: string;
  senha: string;
  slug: string;
  nomeCasal: string;
  dataCasamento: string;
  local: string;
  mensagem: string;
  pixKey: string;
  pixNomeRecebedor: string;
  pixCidade: string;
}): { token: string; casamento: Casamento } {
  const slug = normalizarSlug(dados.slug);
  if (!slugValido(slug)) {
    throw new Error('slug invalido');
  }
  if (buscarContaPorEmail(dados.email)) {
    throw new Error('email ja cadastrado');
  }

  let conta;
  try {
    conta = criarConta({ email: dados.email, senha: dados.senha });
  } catch {
    throw new Error('email ja cadastrado');
  }

  let casamento;
  try {
    casamento = criarCasamento({ contaId: conta.id, ...dados, slug });
  } catch {
    throw new Error('slug ja em uso');
  }

  const token = criarSessao(conta.id);
  return { token, casamento };
}

export function login(dados: { email: string; senha: string }): { token: string } {
  const conta = buscarContaPorEmail(dados.email);
  if (!conta || !verificarSenha(conta.senha_hash, dados.senha)) {
    throw new Error('credenciais invalidas');
  }
  return { token: criarSessao(conta.id) };
}

export function logout(token: string): void {
  apagarSessao(token);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run controllers/authController.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add controllers/authController.ts controllers/authController.test.ts
git commit -m "feat: auth controller for signup/login/logout"
```

---

## Task 8: `controllers/casamentosController.ts`

**Files:**
- Create: `controllers/casamentosController.ts`
- Test: `controllers/casamentosController.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// controllers/casamentosController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-casamentos-controller.db');

describe('casamentosController', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('obterEstadoPublico retorna expirado=false e contador quando dentro do prazo', async () => {
    const { cadastrar } = await import('./authController');
    const { obterEstadoPublico } = await import('./casamentosController');
    cadastrar({
      email: 'aa@b.com', senha: '12345678', slug: 'ativo',
      nomeCasal: 'Ativo', dataCasamento: '2099-01-01', local: '', mensagem: '',
      pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
    });
    const estado = obterEstadoPublico('ativo');
    expect(estado?.expirado).toBe(false);
  });

  it('obterEstadoPublico retorna expirado=true um dia apos a data', async () => {
    const { cadastrar } = await import('./authController');
    const { obterEstadoPublico } = await import('./casamentosController');
    cadastrar({
      email: 'bb@b.com', senha: '12345678', slug: 'expirado',
      nomeCasal: 'Expirado', dataCasamento: '2020-01-01', local: '', mensagem: '',
      pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
    });
    const estado = obterEstadoPublico('expirado');
    expect(estado?.expirado).toBe(true);
  });

  it('obterEstadoPublico retorna undefined para slug inexistente', async () => {
    const { obterEstadoPublico } = await import('./casamentosController');
    expect(obterEstadoPublico('nao-existe')).toBeUndefined();
  });

  it('atualizarDados so altera o casamento da conta autenticada', async () => {
    const { cadastrar } = await import('./authController');
    const { atualizarDados } = await import('./casamentosController');
    const { buscarPorSlug } = await import('../models/casamentos');
    const { casamento } = cadastrar({
      email: 'cc@b.com', senha: '12345678', slug: 'meu-casal',
      nomeCasal: 'Meu Casal', dataCasamento: '2027-01-01', local: '', mensagem: '',
      pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
    });
    atualizarDados(casamento.id, { mensagem: 'Atualizado' });
    expect(buscarPorSlug('meu-casal')?.mensagem).toBe('Atualizado');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run controllers/casamentosController.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `controllers/casamentosController.ts`**

```typescript
// controllers/casamentosController.ts
import {
  buscarPorSlug,
  atualizarCasamento,
  estaExpirado,
  type Casamento,
} from '../models/casamentos';

export interface EstadoPublicoCasamento {
  casamento: Casamento;
  expirado: boolean;
}

export function obterEstadoPublico(slug: string): EstadoPublicoCasamento | undefined {
  const casamento = buscarPorSlug(slug);
  if (!casamento) return undefined;
  return { casamento, expirado: estaExpirado(casamento.data_casamento, new Date()) };
}

export function atualizarDados(
  casamentoId: number,
  dados: Parameters<typeof atualizarCasamento>[1]
): void {
  atualizarCasamento(casamentoId, dados);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run controllers/casamentosController.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add controllers/casamentosController.ts controllers/casamentosController.test.ts
git commit -m "feat: casamentos controller for public state and self-service updates"
```

---

## Task 9: `controllers/presentesController.ts` and `controllers/pedidosController.ts`

**Files:**
- Create: `controllers/presentesController.ts`
- Create: `controllers/pedidosController.ts`
- Test: `controllers/presentesController.test.ts`, `controllers/pedidosController.test.ts`

These are thin pass-throughs — the only reason they exist as a separate layer from `models/` is the MVC convention the spec asks for (`route.ts` → controller → model). Keep them exactly this thin; anything more would be an unrequested abstraction.

- [ ] **Step 1: Write failing tests for `presentesController`**

```typescript
// controllers/presentesController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-presentes-controller.db');

async function criarCasamentoDeTeste() {
  const { cadastrar } = await import('./authController');
  const { casamento } = cadastrar({
    email: 'dd@b.com', senha: '12345678', slug: 'presentes-teste',
    nomeCasal: 'Teste', dataCasamento: '2027-01-01', local: '', mensagem: '',
    pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
  });
  return casamento;
}

describe('presentesController', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('criar/listar/atualizar/remover operam escopados ao casamentoId', async () => {
    const casamento = await criarCasamentoDeTeste();
    const { criar, listar, atualizar, remover } = await import('./presentesController');
    const presente = criar(casamento.id, { nome: 'Panela', descricao: '', preco: 100, imagens: [] });
    expect(listar(casamento.id)).toHaveLength(1);
    atualizar(presente.id, { preco: 150 });
    expect(listar(casamento.id)[0].preco).toBe(150);
    remover(presente.id);
    expect(listar(casamento.id)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run controllers/presentesController.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `controllers/presentesController.ts`**

```typescript
// controllers/presentesController.ts
import {
  criarPresente,
  listarTodos,
  atualizarPresente,
  removerPresente,
  type Presente,
} from '../models/presentes';

export function criar(
  casamentoId: number,
  dados: Omit<Parameters<typeof criarPresente>[0], 'casamentoId'>
): Presente {
  return criarPresente({ casamentoId, ...dados });
}

export function listar(casamentoId: number): Presente[] {
  return listarTodos(casamentoId);
}

export function atualizar(id: number, dados: Parameters<typeof atualizarPresente>[1]): void {
  atualizarPresente(id, dados);
}

export function remover(id: number): void {
  removerPresente(id);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run controllers/presentesController.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write failing tests for `pedidosController`**

```typescript
// controllers/pedidosController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-pedidos-controller.db');

async function criarCasamentoComPresenteDisponivel() {
  const { cadastrar } = await import('./authController');
  const { criar: criarPresente } = await import('./presentesController');
  const { casamento } = cadastrar({
    email: 'ee@b.com', senha: '12345678', slug: 'pedidos-teste',
    nomeCasal: 'Teste', dataCasamento: '2027-01-01', local: '', mensagem: '',
    pixKey: 'chave-teste', pixNomeRecebedor: 'FULANO', pixCidade: 'SAO PAULO',
  });
  const presente = criarPresente(casamento.id, { nome: 'Cafeteira', descricao: '', preco: 130, imagens: [] });
  return { casamento, presente };
}

describe('pedidosController', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('criar gera pedido com pix a partir dos dados do casamento do presente', async () => {
    const { presente } = await criarCasamentoComPresenteDisponivel();
    const { criar } = await import('./pedidosController');
    const pedido = await criar({ presenteId: presente.id, nomeConvidado: 'Beatriz', mensagem: 'Felicidades!' });
    expect(pedido.status).toBe('aguardando_pagamento');
    expect(pedido.pix_copia_cola.length).toBeGreaterThan(0);
    expect(pedido.pix_qr_code_data_url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('criar lanca erro se o presente nao existe ou nao esta disponivel', async () => {
    const { criar } = await import('./pedidosController');
    await expect(criar({ presenteId: 9999, nomeConvidado: 'X', mensagem: '' })).rejects.toThrow(
      'presente indisponivel'
    );
  });

  it('buscarStatus retorna o pedido por id', async () => {
    const { presente } = await criarCasamentoComPresenteDisponivel();
    const { criar, buscarStatus } = await import('./pedidosController');
    const pedido = await criar({ presenteId: presente.id, nomeConvidado: 'X', mensagem: '' });
    expect(buscarStatus(pedido.id)?.status).toBe('aguardando_pagamento');
  });

  it('listar e marcarPago operam escopados ao casamento', async () => {
    const { casamento, presente } = await criarCasamentoComPresenteDisponivel();
    const { criar, listar, marcarPago } = await import('./pedidosController');
    const pedido = await criar({ presenteId: presente.id, nomeConvidado: 'X', mensagem: '' });
    expect(listar(casamento.id)).toHaveLength(1);
    marcarPago(pedido.id);
    expect(listar(casamento.id)[0].status).toBe('pago');
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run controllers/pedidosController.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Write `controllers/pedidosController.ts`**

```typescript
// controllers/pedidosController.ts
import { buscarPorId as buscarPresentePorId } from '../models/presentes';
import { criarPedido, buscarPedidoPorId, listarPedidos, marcarComoPago, type Pedido } from '../models/pedidos';
import { gerarPixCopiaCola, gerarQrCodeDataUrl } from '../models/pix';
import { buscarPorId as buscarCasamentoPorId } from '../models/casamentos';

export async function criar(dados: {
  presenteId: number;
  nomeConvidado: string;
  mensagem: string;
}): Promise<Pedido> {
  const presente = buscarPresentePorId(dados.presenteId);
  if (!presente || presente.status !== 'disponivel') {
    throw new Error('presente indisponivel');
  }
  const casamento = buscarCasamentoPorId(presente.casamento_id)!;

  const copiaCola = gerarPixCopiaCola({
    chave: casamento.pix_key,
    nomeRecebedor: casamento.pix_nome_recebedor,
    cidade: casamento.pix_cidade,
    valor: presente.preco,
    identificador: `PRESENTE${presente.id}`,
  });
  const qrCodeDataUrl = await gerarQrCodeDataUrl(copiaCola);

  return criarPedido({
    presenteId: presente.id,
    nomeConvidado: dados.nomeConvidado,
    mensagem: dados.mensagem,
    pixCopiaCola: copiaCola,
    pixQrCodeDataUrl: qrCodeDataUrl,
  });
}

export function buscarStatus(id: number): Pedido | undefined {
  return buscarPedidoPorId(id);
}

export function listar(casamentoId: number): Pedido[] {
  return listarPedidos(casamentoId);
}

export function marcarPago(id: number): void {
  marcarComoPago(id);
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run controllers/pedidosController.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Commit**

```bash
git add controllers/presentesController.ts controllers/presentesController.test.ts controllers/pedidosController.ts controllers/pedidosController.test.ts
git commit -m "feat: presentes/pedidos controllers"
```

---

## Task 10: Rewrite `middleware.ts` for session-based multi-tenant auth

**Files:**
- Modify: `middleware.ts`

There's no good way to unit-test Next.js middleware in this project's Vitest setup (it needs the edge runtime), so this task is verified manually in Task 13's end-to-end pass — same as the original middleware had no test.

- [ ] **Step 1: Write `middleware.ts`**

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const isAdminApi = request.nextUrl.pathname.startsWith('/api/admin');
  const isAdminPage = request.nextUrl.pathname === '/admin';

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  const token = request.cookies.get('sessao')?.value;
  if (!token) {
    return isAdminApi
      ? NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 })
      : NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/api/admin/:path*'],
};
```

Note: middleware (edge runtime) cannot use `better-sqlite3` to resolve `casamento_id` — that resolution (`sessao` cookie → `sessoes` → `contas` → `casamentos`) happens in each `/api/admin/*` route handler via a shared `resolverCasamentoIdDaSessao()` helper (Task 11), which runs in the Node.js runtime. Middleware here only does the cheap "is there a cookie at all" check so a logged-out visit to `/admin` doesn't flash the page before redirecting; the real authorization is enforced per-route.

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: middleware checks for session cookie presence on admin routes"
```

---

## Task 11: Session-resolution helper + rewrite admin/pedidos API routes

**Files:**
- Create: `app/api/_sessao.ts` (shared helper, not a route — no HTTP methods exported, so Next.js won't treat it as one)
- Modify: `app/api/admin/presentes/route.ts`
- Modify: `app/api/admin/presentes/[id]/route.ts`
- Modify: `app/api/admin/pedidos/route.ts`
- Modify: `app/api/admin/pedidos/[id]/marcar-pago/route.ts`
- Create: `app/api/admin/casamento/route.ts`
- Modify: `app/api/pedidos/route.ts`
- Delete: `app/api/admin/login/route.ts`, `app/api/admin/session/route.ts`

- [ ] **Step 1: Write `app/api/_sessao.ts`**

```typescript
// app/api/_sessao.ts
import { cookies } from 'next/headers';
import { resolverContaIdPorToken } from '@/models/sessoes';
import { buscarPorContaId } from '@/models/casamentos';

export async function resolverCasamentoIdDaSessao(): Promise<number | undefined> {
  const token = (await cookies()).get('sessao')?.value;
  if (!token) return undefined;
  const contaId = resolverContaIdPorToken(token);
  if (!contaId) return undefined;
  return buscarPorContaId(contaId)?.id;
}
```

- [ ] **Step 2: Rewrite `app/api/admin/presentes/route.ts`**

```typescript
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
```

- [ ] **Step 3: Rewrite `app/api/admin/presentes/[id]/route.ts`**

```typescript
// app/api/admin/presentes/[id]/route.ts
import { NextResponse } from 'next/server';
import { resolverCasamentoIdDaSessao } from '../../../_sessao';
import { atualizar, remover } from '@/controllers/presentesController';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const { id } = await params;
  const dados = await request.json();
  atualizar(Number(id), dados);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const { id } = await params;
  remover(Number(id));
  return NextResponse.json({ ok: true });
}
```

Note: this checks the requester is *some* logged-in couple, not that presente `id` belongs to *their* casamento. That gap already existed implicitly in the old single-tenant code (there was only one couple). Closing it fully means `atualizar`/`remover` would need to verify `buscarPorId(id)?.casamento_id === casamentoId` first — add that check now since it's one guard in the controller, not per caller:

- [ ] **Step 4: Add ownership check to `controllers/presentesController.ts`**

```typescript
// controllers/presentesController.ts
import {
  criarPresente,
  buscarPorId,
  listarTodos,
  atualizarPresente,
  removerPresente,
  type Presente,
} from '../models/presentes';

export function criar(
  casamentoId: number,
  dados: Omit<Parameters<typeof criarPresente>[0], 'casamentoId'>
): Presente {
  return criarPresente({ casamentoId, ...dados });
}

export function listar(casamentoId: number): Presente[] {
  return listarTodos(casamentoId);
}

export function atualizar(
  casamentoId: number,
  id: number,
  dados: Parameters<typeof atualizarPresente>[1]
): void {
  const presente = buscarPorId(id);
  if (!presente || presente.casamento_id !== casamentoId) {
    throw new Error('presente nao encontrado');
  }
  atualizarPresente(id, dados);
}

export function remover(casamentoId: number, id: number): void {
  const presente = buscarPorId(id);
  if (!presente || presente.casamento_id !== casamentoId) {
    throw new Error('presente nao encontrado');
  }
  removerPresente(id);
}
```

- [ ] **Step 5: Update `controllers/presentesController.test.ts`** to match the new signatures and add an isolation test

```typescript
// controllers/presentesController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-presentes-controller.db');

async function criarCasamentoDeTeste(email: string, slug: string) {
  const { cadastrar } = await import('./authController');
  const { casamento } = cadastrar({
    email, senha: '12345678', slug,
    nomeCasal: 'Teste', dataCasamento: '2027-01-01', local: '', mensagem: '',
    pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
  });
  return casamento;
}

describe('presentesController', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('criar/listar/atualizar/remover operam escopados ao casamentoId', async () => {
    const casamento = await criarCasamentoDeTeste('dd@b.com', 'presentes-teste');
    const { criar, listar, atualizar, remover } = await import('./presentesController');
    const presente = criar(casamento.id, { nome: 'Panela', descricao: '', preco: 100, imagens: [] });
    expect(listar(casamento.id)).toHaveLength(1);
    atualizar(casamento.id, presente.id, { preco: 150 });
    expect(listar(casamento.id)[0].preco).toBe(150);
    remover(casamento.id, presente.id);
    expect(listar(casamento.id)).toHaveLength(0);
  });

  it('atualizar/remover rejeitam presente de outro casamento', async () => {
    const casamentoA = await criarCasamentoDeTeste('ff@b.com', 'casal-ff');
    const casamentoB = await criarCasamentoDeTeste('gg@b.com', 'casal-gg');
    const { criar, atualizar, remover } = await import('./presentesController');
    const presenteDeA = criar(casamentoA.id, { nome: 'Panela', descricao: '', preco: 100, imagens: [] });
    expect(() => atualizar(casamentoB.id, presenteDeA.id, { preco: 1 })).toThrow('presente nao encontrado');
    expect(() => remover(casamentoB.id, presenteDeA.id)).toThrow('presente nao encontrado');
  });
});
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run controllers/presentesController.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Update `app/api/admin/presentes/[id]/route.ts` to pass `casamentoId` into the controller**

```typescript
// app/api/admin/presentes/[id]/route.ts
import { NextResponse } from 'next/server';
import { resolverCasamentoIdDaSessao } from '../../../_sessao';
import { atualizar, remover } from '@/controllers/presentesController';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const { id } = await params;
  const dados = await request.json();
  try {
    atualizar(casamentoId, Number(id), dados);
  } catch {
    return NextResponse.json({ erro: 'Presente nao encontrado' }, { status: 404 });
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
```

- [ ] **Step 8: Rewrite `app/api/admin/pedidos/route.ts`**

```typescript
// app/api/admin/pedidos/route.ts
import { NextResponse } from 'next/server';
import { resolverCasamentoIdDaSessao } from '../../_sessao';
import { listar } from '@/controllers/pedidosController';

export async function GET() {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  return NextResponse.json({ pedidos: listar(casamentoId) });
}
```

- [ ] **Step 9: Rewrite `app/api/admin/pedidos/[id]/marcar-pago/route.ts`**

```typescript
// app/api/admin/pedidos/[id]/marcar-pago/route.ts
import { NextResponse } from 'next/server';
import { resolverCasamentoIdDaSessao } from '../../../../_sessao';
import { marcarPago } from '@/controllers/pedidosController';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const { id } = await params;
  marcarPago(Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 10: Create `app/api/admin/casamento/route.ts`**

```typescript
// app/api/admin/casamento/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolverContaIdPorToken } from '@/models/sessoes';
import { buscarPorContaId } from '@/models/casamentos';
import { atualizarDados } from '@/controllers/casamentosController';

export async function GET() {
  const token = (await cookies()).get('sessao')?.value;
  const contaId = token && resolverContaIdPorToken(token);
  const casamento = contaId && buscarPorContaId(contaId);
  if (!casamento) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  return NextResponse.json({ casamento });
}

export async function PATCH(request: Request) {
  const token = (await cookies()).get('sessao')?.value;
  const contaId = token && resolverContaIdPorToken(token);
  const casamento = contaId && buscarPorContaId(contaId);
  if (!casamento) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const dados = await request.json();
  atualizarDados(casamento.id, dados);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 11: Rewrite `app/api/pedidos/route.ts`** to resolve `casamento_id` by slug instead of assuming one couple

```typescript
// app/api/pedidos/route.ts
import { NextResponse } from 'next/server';
import { buscarPorId } from '@/models/presentes';
import { criar } from '@/controllers/pedidosController';

export async function POST(request: Request) {
  const { presenteId, nomeConvidado, mensagem } = await request.json();

  const presenteExiste = buscarPorId(presenteId);
  if (!presenteExiste) {
    return NextResponse.json({ erro: 'Presente indisponivel' }, { status: 404 });
  }

  try {
    const pedido = await criar({ presenteId, nomeConvidado, mensagem: mensagem ?? '' });
    return NextResponse.json({ pedido }, { status: 201 });
  } catch {
    return NextResponse.json({ erro: 'Presente indisponivel' }, { status: 404 });
  }
}
```

No `slug` parameter is actually needed here: `presenteId` already uniquely identifies which casamento the gift belongs to (`pedidosController.criar` looks it up), so the client only ever needs to send the id it already has from the `/[slug]` page's gift grid.

- [ ] **Step 12: Update `app/api/pedidos/route.test.ts`** to match (imports move from `@/lib/presentes` to `@/models/presentes`, and setup goes through `authController`/`presentesController` instead of raw env vars)

```typescript
// app/api/pedidos/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-api-pedidos.db');

async function criarPresenteDisponivel() {
  const { cadastrar } = await import('@/controllers/authController');
  const { criar: criarPresente } = await import('@/controllers/presentesController');
  const { casamento } = cadastrar({
    email: 'hh@b.com', senha: '12345678', slug: 'api-pedidos-teste',
    nomeCasal: 'Teste', dataCasamento: '2027-01-01', local: '', mensagem: '',
    pixKey: 'chave-teste', pixNomeRecebedor: 'FULANO', pixCidade: 'SAO PAULO',
  });
  return criarPresente(casamento.id, { nome: 'Cafeteira', descricao: '', preco: 130, imagens: [] });
}

describe('POST /api/pedidos', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('cria um pedido e retorna dados do pix', async () => {
    const presente = await criarPresenteDisponivel();
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ presenteId: presente.id, nomeConvidado: 'Beatriz', mensagem: 'Felicidades!' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.pedido.status).toBe('aguardando_pagamento');
    expect(body.pedido.pix_copia_cola.length).toBeGreaterThan(0);
    expect(body.pedido.pix_qr_code_data_url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('retorna 404 se o presente nao existe', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ presenteId: 9999, nomeConvidado: 'X', mensagem: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 13: Update `app/api/pedidos/[id]/route.test.ts` imports** (`@/lib/presentes` → `@/models/presentes`, `@/lib/pedidos` → `@/models/pedidos`) — no other changes needed since that route is untouched.

- [ ] **Step 14: Delete `app/api/admin/login/route.ts` and `app/api/admin/session/route.ts`**

- [ ] **Step 15: Run the full test suite**

Run: `npx vitest run`
Expected: PASS across all remaining suites.

- [ ] **Step 16: Commit**

```bash
git add app/api controllers/presentesController.ts controllers/presentesController.test.ts
git rm app/api/admin/login/route.ts app/api/admin/session/route.ts
git commit -m "feat: wire admin/pedidos API routes to session-scoped casamento_id"
```

---

## Task 12: `/api/cadastro`, `/api/login`, `/api/logout` routes

**Files:**
- Create: `app/api/cadastro/route.ts`
- Create: `app/api/login/route.ts`
- Create: `app/api/logout/route.ts`

- [ ] **Step 1: Write `app/api/cadastro/route.ts`**

```typescript
// app/api/cadastro/route.ts
import { NextResponse } from 'next/server';
import { cadastrar } from '@/controllers/authController';

const OITO_HORAS_EM_SEGUNDOS = 60 * 60 * 8;

export async function POST(request: Request) {
  const dados = await request.json();
  let resultado;
  try {
    resultado = cadastrar(dados);
  } catch (erro) {
    return NextResponse.json({ erro: (erro as Error).message }, { status: 400 });
  }
  const response = NextResponse.json({ casamento: resultado.casamento }, { status: 201 });
  response.cookies.set('sessao', resultado.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: OITO_HORAS_EM_SEGUNDOS,
  });
  return response;
}
```

- [ ] **Step 2: Write `app/api/login/route.ts`**

```typescript
// app/api/login/route.ts
import { NextResponse } from 'next/server';
import { login } from '@/controllers/authController';

const OITO_HORAS_EM_SEGUNDOS = 60 * 60 * 8;

export async function POST(request: Request) {
  const { email, senha } = await request.json();
  let resultado;
  try {
    resultado = login({ email, senha });
  } catch (erro) {
    return NextResponse.json({ erro: (erro as Error).message }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('sessao', resultado.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: OITO_HORAS_EM_SEGUNDOS,
  });
  return response;
}
```

- [ ] **Step 3: Write `app/api/logout/route.ts`**

```typescript
// app/api/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logout } from '@/controllers/authController';

export async function POST() {
  const token = (await cookies()).get('sessao')?.value;
  if (token) logout(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('sessao');
  return response;
}
```

No dedicated route tests here: all branching logic these routes call into (`cadastrar`, `login`, `logout`) is already covered by `controllers/authController.test.ts`; these handlers are pure HTTP adapters (parse body → call controller → set/clear cookie), matching the "thin `route.ts`" rule from the spec. Manual verification happens in Task 15.

- [ ] **Step 4: Commit**

```bash
git add app/api/cadastro app/api/login app/api/logout
git commit -m "feat: signup/login/logout API routes"
```

---

## Task 13: Public pages — home, cadastro, login, `/[slug]`

**Files:**
- Create: `app/components/Contador.tsx`
- Modify: `app/page.tsx` (replaces couple-specific home)
- Create: `app/cadastro/page.tsx`
- Create: `app/login/page.tsx`
- Create: `app/[slug]/page.tsx`

- [ ] **Step 1: Write `app/components/Contador.tsx`**

```tsx
// app/components/Contador.tsx
'use client';

import { useEffect, useState } from 'react';

function calcularRestante(dataAlvo: string) {
  const diffMs = new Date(`${dataAlvo}T00:00:00`).getTime() - Date.now();
  const total = Math.max(0, diffMs);
  return {
    dias: Math.floor(total / 86_400_000),
    horas: Math.floor((total % 86_400_000) / 3_600_000),
    minutos: Math.floor((total % 3_600_000) / 60_000),
    segundos: Math.floor((total % 60_000) / 1000),
  };
}

export default function Contador({ dataCasamento }: { dataCasamento: string }) {
  const [restante, setRestante] = useState(() => calcularRestante(dataCasamento));

  useEffect(() => {
    const intervalo = setInterval(() => setRestante(calcularRestante(dataCasamento)), 1000);
    return () => clearInterval(intervalo);
  }, [dataCasamento]);

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 my-6">
      {(['dias', 'horas', 'minutos', 'segundos'] as const).map((unidade) => (
        <div key={unidade} className="text-center">
          <p className="font-serif text-3xl sm:text-4xl text-accent-dark">{restante[unidade]}</p>
          <p className="text-xs uppercase tracking-widest text-foreground/50">{unidade}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx`** with a product marketing home (no longer couple-specific — that content moves to `/[slug]`)

```tsx
// app/page.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 text-center">
      <p className="uppercase tracking-[0.3em] text-xs sm:text-sm text-gold font-medium mb-6">
        Listas de presentes de casamento
      </p>
      <h1 className="font-serif italic text-5xl sm:text-6xl text-accent-dark leading-tight mb-6">
        Sua lista, seu link, seu Pix
      </h1>
      <p className="text-foreground/80 max-w-xl mx-auto leading-relaxed mb-10">
        Crie sua lista de presentes em minutos e receba um link só seu. O
        dinheiro dos presentes cai direto na sua conta via Pix — sem
        intermediário, sem taxa.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link
          href="/cadastro"
          className="bg-accent hover:bg-accent-dark text-white rounded-full px-6 py-3 font-medium transition-colors"
        >
          Criar minha lista
        </Link>
        <Link
          href="/login"
          className="text-accent hover:text-accent-dark font-medium px-4 py-3"
        >
          Já tenho conta
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write `app/cadastro/page.tsx`**

```tsx
// app/cadastro/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FORM_VAZIO = {
  email: '', senha: '', slug: '', nomeCasal: '', dataCasamento: '',
  local: '', mensagem: '', pixKey: '', pixNomeRecebedor: '', pixCidade: '',
};

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');

  function campo(nome: keyof typeof FORM_VAZIO) {
    return {
      value: form[nome],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm({ ...form, [nome]: e.target.value }),
    };
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch('/api/cadastro', { method: 'POST', body: JSON.stringify(form) });
    if (!response.ok) {
      const body = await response.json();
      setErro(body.erro ?? 'Não foi possível criar a conta.');
      return;
    }
    router.push('/admin');
  }

  const inputClass =
    'border border-border-soft rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow';

  return (
    <main className="max-w-lg mx-auto px-6 py-16">
      <h1 className="font-serif text-3xl text-accent-dark mb-6">Criar minha lista</h1>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <input placeholder="Seu e-mail" type="email" required {...campo('email')} className={inputClass} />
        <input placeholder="Senha" type="password" required minLength={8} {...campo('senha')} className={inputClass} />
        <input placeholder="Link desejado (ex: jonasenatalia)" required {...campo('slug')} className={inputClass} />
        <input placeholder="Nome do casal" required {...campo('nomeCasal')} className={inputClass} />
        <input placeholder="Data do casamento" type="date" required {...campo('dataCasamento')} className={inputClass} />
        <input placeholder="Local (opcional)" {...campo('local')} className={inputClass} />
        <textarea placeholder="Mensagem para os convidados (opcional)" rows={3} {...campo('mensagem')} className={inputClass} />
        <input placeholder="Sua chave Pix" required {...campo('pixKey')} className={inputClass} />
        <input placeholder="Nome do titular da chave Pix" required {...campo('pixNomeRecebedor')} className={inputClass} />
        <input placeholder="Cidade do titular" required {...campo('pixCidade')} className={inputClass} />
        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        <button type="submit" className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-3 font-medium transition-colors mt-2">
          Criar conta e lista
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Write `app/login/page.tsx`**

```tsx
// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    if (!response.ok) {
      setErro('E-mail ou senha incorretos');
      return;
    }
    router.push('/admin');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={enviar}
        className="max-w-sm w-full flex flex-col gap-3 bg-surface border border-border-soft rounded-2xl p-8 shadow-sm"
      >
        <h1 className="font-serif text-2xl text-accent-dark mb-2">Entrar</h1>
        <input
          type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)}
          className="border border-border-soft rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow"
        />
        <input
          type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)}
          className="border border-border-soft rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow"
        />
        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        <button type="submit" className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-2.5 font-medium transition-colors mt-1">
          Entrar
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Write `app/[slug]/page.tsx`**

```tsx
// app/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { obterEstadoPublico } from '@/controllers/casamentosController';
import { listarDisponiveis } from '@/models/presentes';
import { expirarPedidosAntigos } from '@/models/pedidos';
import GiftGrid from '../components/GiftGrid';
import Contador from '../components/Contador';

export const dynamic = 'force-dynamic';

export default async function PaginaCasamento({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const estado = obterEstadoPublico(slug);
  if (!estado) notFound();

  const { casamento, expirado } = estado;

  const dataFormatada = new Date(`${casamento.data_casamento}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  if (expirado) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif italic text-4xl text-accent-dark mb-4">{casamento.nome_casal}</h1>
        <p className="text-foreground/70">Este casamento já aconteceu, obrigado a todos! 💛</p>
      </main>
    );
  }

  expirarPedidosAntigos();
  const presentes = listarDisponiveis(casamento.id);

  return (
    <main>
      <header className="relative overflow-hidden border-b border-border-soft">
        <div className="max-w-4xl mx-auto px-6 py-20 sm:py-28 text-center">
          <p className="uppercase tracking-[0.3em] text-xs sm:text-sm text-gold font-medium mb-6">
            Lista de presentes
          </p>
          <h1 className="font-serif italic text-5xl sm:text-7xl text-accent-dark leading-tight">
            {casamento.nome_casal}
          </h1>
          <div className="flex items-center justify-center gap-3 my-6">
            <span className="h-px w-10 bg-gold/60" />
            <span className="text-gold text-lg">❦</span>
            <span className="h-px w-10 bg-gold/60" />
          </div>
          <p className="text-foreground/70 tracking-wide">{dataFormatada}</p>
          {Boolean(casamento.mostrar_contador) && <Contador dataCasamento={casamento.data_casamento} />}
          {casamento.mensagem && (
            <p className="mt-6 text-foreground/80 max-w-xl mx-auto leading-relaxed">{casamento.mensagem}</p>
          )}
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <GiftGrid presentesIniciais={presentes} />
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Manually verify**

Run: `npm run dev`, then in the browser:
1. Open `http://localhost:3000` — confirm it shows the marketing home with "Criar minha lista" / "Já tenho conta".
2. Go through `/cadastro` with test data — confirm redirect to `/admin`.
3. Open `http://localhost:3000/<slug-cadastrado>` — confirm countdown and gift grid render (grid will be empty until Task 14 lets you add gifts).

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/cadastro app/login "app/[slug]" app/components/Contador.tsx
git commit -m "feat: public marketing home, signup, login, and per-couple slug page"
```

---

## Task 14: Update admin dashboard for session auth + casamento self-editing

**Files:**
- Modify: `app/admin/page.tsx`
- Delete: `app/admin/AdminPasswordGate.tsx`

- [ ] **Step 1: Rewrite `app/admin/page.tsx`** — remove `AdminPasswordGate`, redirect to `/login` on 401, add a "Dados do casamento" section wired to `/api/admin/casamento`, and thread `casamento.id`'s ownership checks already enforced server-side. Keep the existing gift/order tables from the current file as-is (they already work); only the top-level wrapper and the new section change.

```tsx
// app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Presente {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  imagens: string[];
  status: string;
}

interface Pedido {
  id: number;
  presente_id: number;
  nome_convidado: string;
  mensagem: string;
  status: string;
}

interface Casamento {
  id: number;
  nome_casal: string;
  data_casamento: string;
  local: string;
  mensagem: string;
  pix_key: string;
  pix_nome_recebedor: string;
  pix_cidade: string;
  mostrar_contador: 0 | 1;
}

const STATUS_STYLE: Record<string, string> = {
  disponivel: 'bg-green-50 text-green-700',
  reservado: 'bg-amber-50 text-amber-700',
  pago: 'bg-accent-soft text-accent-dark',
  aguardando_pagamento: 'bg-amber-50 text-amber-700',
  cancelado: 'bg-neutral-100 text-neutral-500',
};

function Selo({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-neutral-100 text-neutral-600'}`}>
      {status}
    </span>
  );
}

const FORM_VAZIO = { nome: '', descricao: '', preco: '', fotos: ['', '', '', '', ''] };
const inputClass =
  'border border-border-soft rounded-lg px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow';

function SecaoCasamento() {
  const [casamento, setCasamento] = useState<Casamento | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    fetch('/api/admin/casamento').then((r) => r.json()).then((body) => setCasamento(body.casamento));
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!casamento) return;
    await fetch('/api/admin/casamento', {
      method: 'PATCH',
      body: JSON.stringify({
        nomeCasal: casamento.nome_casal,
        dataCasamento: casamento.data_casamento,
        local: casamento.local,
        mensagem: casamento.mensagem,
        pixKey: casamento.pix_key,
        pixNomeRecebedor: casamento.pix_nome_recebedor,
        pixCidade: casamento.pix_cidade,
        mostrarContador: Boolean(casamento.mostrar_contador),
      }),
    });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  if (!casamento) return null;

  return (
    <section className="bg-surface border border-border-soft rounded-2xl p-6 shadow-sm">
      <h2 className="font-serif text-xl text-accent-dark mb-4">Dados do casamento</h2>
      <form onSubmit={salvar} className="flex flex-col gap-3 max-w-lg">
        <input className={inputClass} value={casamento.nome_casal} onChange={(e) => setCasamento({ ...casamento, nome_casal: e.target.value })} placeholder="Nome do casal" />
        <input className={inputClass} type="date" value={casamento.data_casamento} onChange={(e) => setCasamento({ ...casamento, data_casamento: e.target.value })} />
        <input className={inputClass} value={casamento.local} onChange={(e) => setCasamento({ ...casamento, local: e.target.value })} placeholder="Local" />
        <textarea className={inputClass} value={casamento.mensagem} onChange={(e) => setCasamento({ ...casamento, mensagem: e.target.value })} placeholder="Mensagem" rows={3} />
        <input className={inputClass} value={casamento.pix_key} onChange={(e) => setCasamento({ ...casamento, pix_key: e.target.value })} placeholder="Chave Pix" />
        <input className={inputClass} value={casamento.pix_nome_recebedor} onChange={(e) => setCasamento({ ...casamento, pix_nome_recebedor: e.target.value })} placeholder="Nome do titular" />
        <input className={inputClass} value={casamento.pix_cidade} onChange={(e) => setCasamento({ ...casamento, pix_cidade: e.target.value })} placeholder="Cidade" />
        <label className="flex items-center gap-2 text-sm text-foreground/70">
          <input type="checkbox" checked={Boolean(casamento.mostrar_contador)} onChange={(e) => setCasamento({ ...casamento, mostrar_contador: e.target.checked ? 1 : 0 })} />
          Mostrar contador regressivo
        </label>
        <button type="submit" className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-2 text-sm font-medium transition-colors self-start">
          {salvo ? 'Salvo!' : 'Salvar'}
        </button>
      </form>
    </section>
  );
}

function Painel() {
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const router = useRouter();

  async function carregar() {
    const [prRes, pdRes] = await Promise.all([
      fetch('/api/admin/presentes'),
      fetch('/api/admin/pedidos'),
    ]);
    if (prRes.status === 401 || pdRes.status === 401) {
      router.push('/login');
      return;
    }
    if (!prRes.ok || !pdRes.ok) {
      setErro('Não foi possível carregar os dados.');
      return;
    }
    const [pr, pd] = await Promise.all([prRes.json(), pdRes.json()]);
    setPresentes(pr.presentes);
    setPedidos(pd.pedidos);
  }

  useEffect(() => {
    carregar();
  }, []);

  function editar(p: Presente) {
    setEditandoId(p.id);
    const fotos = [...p.imagens, '', '', '', '', ''].slice(0, 5);
    setForm({ nome: p.nome, descricao: p.descricao, preco: String(p.preco), fotos });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
  }

  async function salvarPresente(e: React.FormEvent) {
    e.preventDefault();
    const corpo = { nome: form.nome, descricao: form.descricao, preco: form.preco, imagens: form.fotos.filter(Boolean) };
    const response = await fetch(
      editandoId ? `/api/admin/presentes/${editandoId}` : '/api/admin/presentes',
      { method: editandoId ? 'PATCH' : 'POST', body: JSON.stringify(corpo) }
    );
    if (!response.ok) {
      setErro(editandoId ? 'Não foi possível salvar o presente.' : 'Não foi possível adicionar o presente.');
      return;
    }
    setErro('');
    cancelarEdicao();
    carregar();
  }

  async function removerPresenteItem(id: number) {
    const response = await fetch(`/api/admin/presentes/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setErro('Não foi possível remover o presente.');
      return;
    }
    setErro('');
    if (editandoId === id) cancelarEdicao();
    carregar();
  }

  async function marcarPago(id: number) {
    const response = await fetch(`/api/admin/pedidos/${id}/marcar-pago`, { method: 'POST' });
    if (!response.ok) {
      setErro('Não foi possível marcar o pedido como pago.');
      return;
    }
    setErro('');
    carregar();
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8 sm:gap-12">
      <header>
        <p className="uppercase tracking-widest text-xs text-gold font-medium mb-1">Bastidores</p>
        <h1 className="font-serif text-3xl text-accent-dark">Painel administrativo</h1>
      </header>

      {erro && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-2">{erro}</p>
      )}

      <SecaoCasamento />

      <section className="bg-surface border border-border-soft rounded-2xl p-6 shadow-sm min-w-0">
        <h2 className="font-serif text-xl text-accent-dark mb-4">
          {editandoId ? 'Editar presente' : 'Novo presente'}
        </h2>
        <form onSubmit={salvarPresente} className="flex flex-col gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputClass} required />
            <input placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={`${inputClass} flex-1 min-w-[10rem]`} />
            <input placeholder="Preço" type="number" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} className={`${inputClass} w-28`} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {form.fotos.map((url, i) => (
              <input
                key={i}
                placeholder={`URL da foto ${i + 1}`}
                value={url}
                onChange={(e) => {
                  const fotos = [...form.fotos];
                  fotos[i] = e.target.value;
                  setForm({ ...form, fotos });
                }}
                className={inputClass}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-2 text-sm font-medium transition-colors">
              {editandoId ? 'Salvar alterações' : 'Adicionar'}
            </button>
            {editandoId && (
              <button type="button" onClick={cancelarEdicao} className="text-sm text-foreground/60 hover:text-foreground px-2">
                Cancelar
              </button>
            )}
          </div>
        </form>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border-soft text-foreground/50">
                <th className="pb-2 font-medium"></th>
                <th className="pb-2 font-medium">Nome</th>
                <th className="pb-2 font-medium">Preço</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {presentes.map((p) => (
                <tr key={p.id} className="border-b border-border-soft last:border-0">
                  <td className="py-2.5">
                    {p.imagens[0] && <img src={p.imagens[0]} alt="" className="w-10 h-10 rounded-md object-cover" />}
                  </td>
                  <td className="py-2.5">{p.nome}</td>
                  <td className="py-2.5">R$ {p.preco.toFixed(2)}</td>
                  <td className="py-2.5"><Selo status={p.status} /></td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => editar(p)} className="text-accent hover:text-accent-dark font-medium mr-3">Editar</button>
                    <button onClick={() => removerPresenteItem(p.id)} className="text-red-600 hover:text-red-700 font-medium">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-surface border border-border-soft rounded-2xl p-6 shadow-sm min-w-0">
        <h2 className="font-serif text-xl text-accent-dark mb-4">Pedidos</h2>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border-soft text-foreground/50">
                <th className="pb-2 font-medium">Convidado</th>
                <th className="pb-2 font-medium">Mensagem</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-b border-border-soft last:border-0">
                  <td className="py-2.5">{p.nome_convidado}</td>
                  <td className="py-2.5 text-foreground/70">{p.mensagem}</td>
                  <td className="py-2.5"><Selo status={p.status} /></td>
                  <td className="py-2.5 text-right">
                    {p.status !== 'pago' && (
                      <button onClick={() => marcarPago(p.id)} className="text-accent hover:text-accent-dark font-medium">Marcar como pago</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default function AdminPage() {
  return <Painel />;
}
```

- [ ] **Step 2: Delete `app/admin/AdminPasswordGate.tsx`**

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/admin` while logged out — confirm redirect to `/login`. Log in, confirm the dashboard loads, the "Dados do casamento" section shows the signed-up data, editing and saving it works, and adding a gift makes it show up at `/<slug>`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git rm app/admin/AdminPasswordGate.tsx
git commit -m "feat: admin dashboard uses session auth and edits own casamento data"
```

---

## Task 15: Cleanup — env vars, README, final coverage run

**Files:**
- Modify: `.env.local.example`
- Modify: `README.md`

- [ ] **Step 1: Replace `.env.local.example`**

```
# Nenhuma variavel de ambiente e necessaria para dados de casamento —
# cada casal cadastra os proprios dados (nome, data, Pix) em /cadastro,
# armazenados no banco SQLite local (lista-presentes.db).
```

- [ ] **Step 2: Update `README.md`**

```markdown
# Lista de Presentes de Casamento

Produto multi-casal: qualquer pessoa se cadastra em `/cadastro` e recebe um
link próprio em `/<slug-escolhido>` para a lista de presentes do seu
casamento. O link some (mostra uma tela de agradecimento) um dia após a
data do casamento cadastrada.

## Rodando localmente

1. `npm install`
2. `npm run dev` — abre em http://localhost:3000
3. Acesse `/cadastro` para criar a primeira conta e lista.

## Como funciona o pagamento

Não há gateway de pagamento nem conta externa: o próprio site gera o QR code
Pix "Copia e Cola" localmente, usando a chave Pix, nome e cidade que cada
casal informa no cadastro. O dinheiro cai direto na conta associada a essa
chave.

Como não existe confirmação automática, quando um convidado paga, o casal
precisa checar o extrato do banco e marcar o pedido como pago manualmente
em `/admin`. Só então o presente some da lista para todo mundo.

## Organização do código (MVC)

- `models/` — tipos e acesso a dados (SQLite via `better-sqlite3`), um
  arquivo por entidade.
- `controllers/` — regra de negócio, sem depender de `Request`/`NextResponse`.
- `app/api/**/route.ts` — adaptador HTTP fino: extrai dados da requisição,
  chama o controller, traduz o resultado.
- `app/**/page.tsx` + `app/components/*.tsx` — apresentação.

## Painel administrativo

Acesse `/login` com o e-mail/senha cadastrados. Em `/admin` você edita os
dados do próprio casamento, adiciona/remove presentes e marca pedidos como
pagos.

## Testes

`npm test` — roda a suíte. `npx vitest run --coverage` — roda com checagem
de cobertura 100%.
```

- [ ] **Step 3: Run the full suite with coverage**

Run: `rm -f lista-presentes.db test-*.db *.db-* && npx vitest run --coverage`
Expected: all tests PASS and coverage thresholds (100% lines/functions/branches/statements) are met. If any line is uncovered, add the missing test case to that file's existing test suite (do not relax the threshold).

- [ ] **Step 4: Full manual end-to-end walkthrough**

Run: `npm run dev`, then in the browser:
1. `/` shows the marketing home.
2. `/cadastro` — fill in Jonas & Natália's real data, submit, land on `/admin`.
3. In `/admin`, add 2-3 gifts with photos.
4. Open `/jonasenatalia` (or whatever slug was chosen) in an incognito window — confirm countdown + gift grid show, no login required.
5. Reserve a gift as a guest, confirm the Pix QR/copy-paste code appear.
6. Back in `/admin`, mark that order paid — confirm the guest's modal flips to the thank-you message within 5s and the gift disappears from `/jonasenatalia` on reload.
7. Sign up a second test account with a different slug, add a gift there, and confirm `/admin` for account 1 never shows account 2's gifts/orders (multi-tenant isolation, matching the automated test from Task 6).
8. Log out (add a temporary "Sair" button calling `/api/logout` if none exists yet, or call it via devtools) and confirm `/admin` redirects to `/login`.

- [ ] **Step 5: Commit**

```bash
git add .env.local.example README.md
git commit -m "docs: update README and env example for multi-tenant product"
```

---

## Self-Review Notes

- **Spec coverage:** schema (Task 2), auth/scrypt/sessions (Tasks 3-4, 7), casamentos CRUD/slug/expiration (Task 5, 8), presentes/pedidos scoping + multi-tenant isolation test (Task 6, 9, 11), MVC layering models→controllers→thin routes (Tasks 7-12), routes table from spec (`/`, `/cadastro`, `/login`, `/admin`, `/[slug]`) all present (Tasks 12-14), countdown + expiration screen (Task 13), signup flow with inline errors (Task 13 step 3 + `/api/cadastro` 400 responses), 100% coverage config + verification (Tasks 1, 15). Deferred items from the spec (password reset, email verification, slug editing, account deletion, multiple admins, i18n) are intentionally absent — matches spec's explicit out-of-scope list.
- **Type consistency:** `Presente.casamento_id` (Task 6) is read by `controllers/presentesController.ts` (Task 11) for the ownership check and by `models/pedidos.ts`'s `listarPedidos(casamentoId)` join. `Casamento` field names (`nome_casal`, `data_casamento`, `pix_key`, `pix_nome_recebedor`, `pix_cidade`, `mostrar_contador`) match across `models/casamentos.ts`, `controllers/casamentosController.ts`, `app/api/admin/casamento/route.ts`, and `app/admin/page.tsx`'s `SecaoCasamento`. `criarSessao`/`resolverContaIdPorToken`/`apagarSessao` signatures match between `models/sessoes.ts` and every caller (`authController`, `app/api/_sessao.ts`, `app/api/admin/casamento/route.ts`, `app/api/logout/route.ts`).
- **No placeholders:** every step has complete, runnable code, including the multi-tenant isolation tests explicitly required by the spec's testing section.
