# Lista de Presentes de Casamento - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally-runnable (`npm run dev` on `localhost:3000`) wedding gift registry site where guests reserve a gift, pay via Pix directly into the couple's own account (no payment gateway), and the item disappears from the grid for everyone once reserved/paid.

**Architecture:** Single Next.js app (App Router) with SQLite (via `better-sqlite3`) as the database. A `lib/pix.ts` module builds the standard Brazilian Central Bank "Pix Copia e Cola" BR Code string (EMV QR format) locally from the couple's own Pix key — no external gateway, no API keys, money lands directly in their account. Because there is no gateway/webhook, payment confirmation is manual: the couple checks their bank statement and marks the order paid from an admin panel. Reservations older than 1 hour and still unpaid are lazily expired back to `disponivel` whenever the gift grid is read.

**Tech Stack:** Next.js (App Router, TypeScript), better-sqlite3, `qrcode` npm package (renders the BR Code string as a scannable QR image), Vitest for unit tests, Tailwind CSS for styling.

---

## File Structure

- `db/schema.sql` — table definitions for `presentes` and `pedidos`.
- `lib/db.ts` — opens the SQLite file, runs `schema.sql` on first use.
- `lib/presentes.ts` — CRUD + query helpers for gifts.
- `lib/pedidos.ts` — create/cancel-expired/mark-paid helpers for orders, including the 1h expiry rule.
- `lib/pix.ts` — builds the Pix BR Code string (EMV format with CRC16 checksum) and renders it as a QR code data URL.
- `scripts/seed.ts` — inserts 6-8 placeholder gifts.
- `app/api/pedidos/route.ts` — `POST` creates a pedido + generates the Pix BR Code.
- `app/api/pedidos/[id]/route.ts` — `GET` returns current pedido status (for polling, so the guest's screen updates once an admin marks it paid).
- `app/api/admin/presentes/route.ts` — `GET`/`POST` admin gift list/create.
- `app/api/admin/presentes/[id]/route.ts` — `PATCH` (update) / `DELETE` for a gift.
- `app/api/admin/pedidos/route.ts` — `GET` list all orders.
- `app/api/admin/pedidos/[id]/marcar-pago/route.ts` — `POST`, admin marks a pedido paid.
- `app/page.tsx` — home page: couple names, date, message, gift grid.
- `app/components/GiftGrid.tsx` — renders the grid of available gifts.
- `app/components/CheckoutModal.tsx` — client component: name/message form, then QR code + copia-e-cola + polling for admin confirmation.
- `app/admin/page.tsx` — password-gated admin dashboard.
- `app/admin/AdminPasswordGate.tsx` — client component prompting for the admin password, storing a session cookie.
- `middleware.ts` — protects `/admin` and `/api/admin/*` routes by checking the admin cookie.
- `.env.local.example` — documents `ADMIN_PASSWORD`, `PIX_KEY`, `PIX_NOME_RECEBEDOR`, `PIX_CIDADE`, `COUPLE_NAMES`, `WEDDING_DATE`.
- `README.md` — how to install, seed, and run.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `app/layout.tsx`, `app/globals.css`, `.gitignore`, `.env.local.example`

- [ ] **Step 1: Scaffold the Next.js app**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
```
When prompted, accept defaults. This creates `package.json`, `tsconfig.json`, `next.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`.

- [ ] **Step 2: Install extra dependencies**

Run:
```bash
npm install better-sqlite3 qrcode
npm install -D vitest @types/better-sqlite3 @types/qrcode tsx
```

- [ ] **Step 3: Add scripts to `package.json`**

In `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run",
"seed": "tsx scripts/seed.ts"
```

- [ ] **Step 4: Create `.env.local.example`**

```
# Senha para acessar /admin
ADMIN_PASSWORD=troque-esta-senha

# Sua chave Pix real (CPF, e-mail, telefone ou chave aleatoria)
PIX_KEY=sua-chave-pix-aqui

# Nome do titular da chave Pix, ate 25 caracteres, sem acentos (exigencia do padrao BR Code)
PIX_NOME_RECEBEDOR=NOME COMPLETO

# Cidade do titular, ate 15 caracteres, sem acentos
PIX_CIDADE=SAO PAULO

# Texto exibido na home
COUPLE_NAMES=Fulano & Fulana
WEDDING_DATE=2026-12-12
```

- [ ] **Step 5: Copy the example into a real local env file**

Run:
```bash
cp .env.local.example .env.local
```

- [ ] **Step 6: Verify the scaffold runs**

Run: `npm run dev`
Expected: Server starts on `http://localhost:3000` and the default Next.js welcome page loads without errors. Stop the server (Ctrl+C) before continuing.

- [ ] **Step 7: Commit is skipped — no git repository in this project (per user instruction).**

---

## Task 2: Database module and schema

**Files:**
- Create: `db/schema.sql`
- Create: `lib/db.ts`
- Test: `lib/db.test.ts`

- [ ] **Step 1: Write `db/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS presentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco REAL NOT NULL,
  imagem_url TEXT NOT NULL DEFAULT '',
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

- [ ] **Step 2: Write the failing test for `lib/db.ts`**

```typescript
// lib/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-lista-presentes.db');

describe('getDb', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
  });

  it('creates the presentes and pedidos tables', async () => {
    const { getDb } = await import('./db');
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name);
    expect(tables).toContain('presentes');
    expect(tables).toContain('pedidos');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/db.test.ts`
Expected: FAIL — `lib/db.ts` does not exist yet.

- [ ] **Step 4: Write `lib/db.ts`**

```typescript
// lib/db.ts
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'lista-presentes.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/db.test.ts`
Expected: PASS

- [ ] **Step 6: Add test db files to `.gitignore`**

Append to `.gitignore`:
```
*.db
*.db-journal
*.db-wal
*.db-shm
.env.local
```

---

## Task 3: Gift (presentes) data layer

**Files:**
- Create: `lib/presentes.ts`
- Test: `lib/presentes.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/presentes.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-presentes.db');

describe('presentes', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('cria e lista presentes disponiveis', async () => {
    const { criarPresente, listarDisponiveis } = await import('./presentes');
    criarPresente({ nome: 'Jogo de panelas', descricao: 'Tramontina 5 pecas', preco: 350, imagem_url: '/img/panelas.jpg' });
    const disponiveis = listarDisponiveis();
    expect(disponiveis).toHaveLength(1);
    expect(disponiveis[0].nome).toBe('Jogo de panelas');
    expect(disponiveis[0].status).toBe('disponivel');
  });

  it('nao lista presentes reservados ou pagos', async () => {
    const { criarPresente, listarDisponiveis, atualizarStatus } = await import('./presentes');
    const p = criarPresente({ nome: 'Liquidificador', descricao: '', preco: 200, imagem_url: '' });
    atualizarStatus(p.id, 'reservado');
    expect(listarDisponiveis()).toHaveLength(0);
  });

  it('atualiza e remove um presente', async () => {
    const { criarPresente, atualizarPresente, removerPresente, buscarPorId } = await import('./presentes');
    const p = criarPresente({ nome: 'Jogo de toalhas', descricao: '', preco: 100, imagem_url: '' });
    atualizarPresente(p.id, { preco: 120 });
    expect(buscarPorId(p.id)?.preco).toBe(120);
    removerPresente(p.id);
    expect(buscarPorId(p.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/presentes.test.ts`
Expected: FAIL — `lib/presentes.ts` does not exist yet.

- [ ] **Step 3: Write `lib/presentes.ts`**

```typescript
// lib/presentes.ts
import { getDb } from './db';

export type StatusPresente = 'disponivel' | 'reservado' | 'pago';

export interface Presente {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string;
  status: StatusPresente;
}

export function listarDisponiveis(): Presente[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM presentes WHERE status = 'disponivel' ORDER BY id")
    .all() as Presente[];
}

export function listarTodos(): Presente[] {
  const db = getDb();
  return db.prepare('SELECT * FROM presentes ORDER BY id').all() as Presente[];
}

export function buscarPorId(id: number): Presente | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM presentes WHERE id = ?').get(id) as Presente | undefined;
}

export function criarPresente(dados: {
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string;
}): Presente {
  const db = getDb();
  const result = db
    .prepare(
      'INSERT INTO presentes (nome, descricao, preco, imagem_url) VALUES (?, ?, ?, ?)'
    )
    .run(dados.nome, dados.descricao, dados.preco, dados.imagem_url);
  return buscarPorId(Number(result.lastInsertRowid))!;
}

export function atualizarPresente(
  id: number,
  dados: Partial<Pick<Presente, 'nome' | 'descricao' | 'preco' | 'imagem_url'>>
): void {
  const atual = buscarPorId(id);
  if (!atual) return;
  const merged = { ...atual, ...dados };
  const db = getDb();
  db.prepare(
    'UPDATE presentes SET nome = ?, descricao = ?, preco = ?, imagem_url = ? WHERE id = ?'
  ).run(merged.nome, merged.descricao, merged.preco, merged.imagem_url, id);
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/presentes.test.ts`
Expected: PASS (3 tests)

---

## Task 4: Order (pedidos) data layer with 1h expiry

**Files:**
- Create: `lib/pedidos.ts`
- Test: `lib/pedidos.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/pedidos.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-pedidos.db');

describe('pedidos', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
    vi.useRealTimers();
  });

  it('cria um pedido e marca o presente como reservado', async () => {
    const { criarPresente } = await import('./presentes');
    const { criarPedido } = await import('./pedidos');
    const presente = criarPresente({ nome: 'Jogo de copos', descricao: '', preco: 80, imagem_url: '' });

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
    const { criarPresente, buscarPorId } = await import('./presentes');
    const { criarPedido, marcarComoPago } = await import('./pedidos');
    const presente = criarPresente({ nome: 'Panela eletrica', descricao: '', preco: 250, imagem_url: '' });
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Joao',
      mensagem: '',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });

    marcarComoPago(pedido.id);

    const { buscarPedidoPorId } = await import('./pedidos');
    expect(buscarPedidoPorId(pedido.id)?.status).toBe('pago');
    expect(buscarPorId(presente.id)?.status).toBe('pago');
  });

  it('expira pedidos com mais de 1h aguardando pagamento e libera o presente', async () => {
    const { criarPresente, buscarPorId } = await import('./presentes');
    const { criarPedido, expirarPedidosAntigos, buscarPedidoPorId } = await import('./pedidos');
    const presente = criarPresente({ nome: 'Ferro de passar', descricao: '', preco: 150, imagem_url: '' });
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Ana',
      mensagem: '',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });

    const db = (await import('./db')).getDb();
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE pedidos SET criado_em = ? WHERE id = ?').run(duasHorasAtras, pedido.id);

    expirarPedidosAntigos();

    expect(buscarPedidoPorId(pedido.id)?.status).toBe('cancelado');
    expect(buscarPorId(presente.id)?.status).toBe('disponivel');
  });

  it('nao expira pedidos com menos de 1h', async () => {
    const { criarPresente, buscarPorId } = await import('./presentes');
    const { criarPedido, expirarPedidosAntigos, buscarPedidoPorId } = await import('./pedidos');
    const presente = criarPresente({ nome: 'Aspirador', descricao: '', preco: 400, imagem_url: '' });
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/pedidos.test.ts`
Expected: FAIL — `lib/pedidos.ts` does not exist yet.

- [ ] **Step 3: Write `lib/pedidos.ts`**

```typescript
// lib/pedidos.ts
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

const UMA_HORA_MS = 60 * 60 * 1000;

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

export function listarPedidos(): Pedido[] {
  const db = getDb();
  return db.prepare('SELECT * FROM pedidos ORDER BY id DESC').all() as Pedido[];
}

export function marcarComoPago(id: number): void {
  const pedido = buscarPedidoPorId(id);
  if (!pedido) return;
  const db = getDb();
  db.prepare("UPDATE pedidos SET status = 'pago' WHERE id = ?").run(id);
  atualizarStatusPresente(pedido.presente_id, 'pago');
}

export function expirarPedidosAntigos(): void {
  const db = getDb();
  const pendentes = db
    .prepare("SELECT * FROM pedidos WHERE status = 'aguardando_pagamento'")
    .all() as Pedido[];

  const agora = Date.now();
  for (const pedido of pendentes) {
    const criadoEm = new Date(pedido.criado_em + 'Z').getTime();
    if (agora - criadoEm > UMA_HORA_MS) {
      db.prepare("UPDATE pedidos SET status = 'cancelado' WHERE id = ?").run(pedido.id);
      atualizarStatusPresente(pedido.presente_id, 'disponivel');
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/pedidos.test.ts`
Expected: PASS (4 tests)

---

## Task 5: Local Pix BR Code generator

**Files:**
- Create: `lib/pix.ts`
- Test: `lib/pix.test.ts`

Background: Pix "Copia e Cola" is a plain-text string in the EMV QR Code format (the same standard used by many countries' QR payments), defined by the Central Bank of Brazil. It's built from simple TLV (tag-length-value) fields — no signature, no external call needed — ending in a CRC16-CCITT checksum of the string itself. Any app that reads Pix QR codes can parse this string directly.

- [ ] **Step 1: Write failing tests**

```typescript
// lib/pix.test.ts
import { describe, it, expect } from 'vitest';
import { gerarPixCopiaCola, calcularCRC16 } from './pix';

describe('calcularCRC16', () => {
  it('calcula o CRC16-CCITT de uma string conhecida', () => {
    // Valor de referencia validado manualmente com a especificacao do Banco Central
    expect(calcularCRC16('123456789')).toBe('29B1');
  });
});

describe('gerarPixCopiaCola', () => {
  it('gera uma string terminando com o campo CRC (6304 + 4 hex chars)', () => {
    const codigo = gerarPixCopiaCola({
      chave: 'convidado@exemplo.com',
      nomeRecebedor: 'FULANO DA SILVA',
      cidade: 'SAO PAULO',
      valor: 150.5,
      identificador: 'PEDIDO001',
    });

    expect(codigo.startsWith('000201')).toBe(true);
    expect(codigo).toMatch(/6304[0-9A-F]{4}$/);
  });

  it('inclui o valor formatado com duas casas decimais', () => {
    const codigo = gerarPixCopiaCola({
      chave: 'chave-pix',
      nomeRecebedor: 'FULANO',
      cidade: 'SAO PAULO',
      valor: 99,
      identificador: 'X',
    });
    expect(codigo).toContain('540599.00');
  });

  it('trunca nome e cidade para os limites do padrao (25 e 15 caracteres)', () => {
    const codigo = gerarPixCopiaCola({
      chave: 'chave-pix',
      nomeRecebedor: 'NOME MUITO MUITO MUITO LONGO DEMAIS',
      cidade: 'CIDADE COM NOME MUITO LONGO',
      valor: 10,
      identificador: 'X',
    });
    // campo 59 (nome) com tamanho maximo 25, campo 60 (cidade) com tamanho maximo 15
    expect(codigo).toContain('5925NOME MUITO MUITO MUITO');
    expect(codigo).toContain('6015CIDADE COM NOME');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/pix.test.ts`
Expected: FAIL — `lib/pix.ts` does not exist yet.

- [ ] **Step 3: Write `lib/pix.ts`**

```typescript
// lib/pix.ts
import QRCode from 'qrcode';

function campo(id: string, valor: string): string {
  const tamanho = String(valor.length).padStart(2, '0');
  return `${id}${tamanho}${valor}`;
}

export function calcularCRC16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPixCopiaCola(dados: {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valor: number;
  identificador: string;
}): string {
  const nome = dados.nomeRecebedor.trim().slice(0, 25);
  const cidade = dados.cidade.trim().slice(0, 15);
  const identificador = dados.identificador.trim().slice(0, 25) || '***';

  const merchantAccountInfo =
    campo('00', 'br.gov.bcb.pix') + campo('01', dados.chave);

  const partesSemCrc =
    campo('00', '01') + // Payload Format Indicator
    campo('26', merchantAccountInfo) + // Merchant Account Information (Pix)
    campo('52', '0000') + // Merchant Category Code
    campo('53', '986') + // Transaction Currency (BRL)
    campo('54', dados.valor.toFixed(2)) + // Transaction Amount
    campo('58', 'BR') + // Country Code
    campo('59', nome) + // Merchant Name
    campo('60', cidade) + // Merchant City
    campo('62', campo('05', identificador)); // Additional Data Field (txid)

  const payloadParaCrc = `${partesSemCrc}6304`;
  const crc = calcularCRC16(payloadParaCrc);

  return `${payloadParaCrc}${crc}`;
}

export async function gerarQrCodeDataUrl(copiaCola: string): Promise<string> {
  return QRCode.toDataURL(copiaCola, { margin: 1, width: 300 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/pix.test.ts`
Expected: PASS (4 tests)

---

## Task 6: Seed script

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: Write the seed script**

```typescript
// scripts/seed.ts
import { criarPresente, listarTodos } from '../lib/presentes';

const presentesExemplo = [
  { nome: 'Jogo de Panelas Tramontina', descricao: '5 pecas antiaderentes', preco: 450, imagem_url: 'https://placehold.co/400x400?text=Panelas' },
  { nome: 'Jogo de Cama Casal', descricao: '4 pecas, 200 fios', preco: 220, imagem_url: 'https://placehold.co/400x400?text=Cama' },
  { nome: 'Liquidificador', descricao: 'Potente, 3 velocidades', preco: 180, imagem_url: 'https://placehold.co/400x400?text=Liquidificador' },
  { nome: 'Jogo de Toalhas', descricao: '6 pecas felpudas', preco: 150, imagem_url: 'https://placehold.co/400x400?text=Toalhas' },
  { nome: 'Air Fryer', descricao: '5 litros', preco: 500, imagem_url: 'https://placehold.co/400x400?text=Air+Fryer' },
  { nome: 'Jogo de Taças', descricao: '6 taças de vinho', preco: 120, imagem_url: 'https://placehold.co/400x400?text=Tacas' },
  { nome: 'Cota Lua de Mel', descricao: 'Ajude a pagar a viagem', preco: 300, imagem_url: 'https://placehold.co/400x400?text=Lua+de+Mel' },
  { nome: 'Robo Aspirador', descricao: 'Limpeza automatica', preco: 900, imagem_url: 'https://placehold.co/400x400?text=Robo+Aspirador' },
];

function seed() {
  if (listarTodos().length > 0) {
    console.log('Ja existem presentes cadastrados, pulando seed.');
    return;
  }
  for (const presente of presentesExemplo) {
    criarPresente(presente);
  }
  console.log(`${presentesExemplo.length} presentes de exemplo criados.`);
}

seed();
```

- [ ] **Step 2: Run the seed script and verify output**

Run: `npm run seed`
Expected: `8 presentes de exemplo criados.`

---

## Task 7: API route — create pedido + generate Pix

**Files:**
- Create: `app/api/pedidos/route.ts`
- Test: `app/api/pedidos/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// app/api/pedidos/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-api-pedidos.db');

describe('POST /api/pedidos', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.PIX_KEY = 'chave-teste';
    process.env.PIX_NOME_RECEBEDOR = 'FULANO';
    process.env.PIX_CIDADE = 'SAO PAULO';
    vi.resetModules();
  });

  it('cria um pedido e retorna dados do pix', async () => {
    const { criarPresente } = await import('@/lib/presentes');
    const presente = criarPresente({ nome: 'Cafeteira', descricao: '', preco: 130, imagem_url: '' });

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/pedidos/route.test.ts`
Expected: FAIL — route file does not exist yet.

- [ ] **Step 3: Write `app/api/pedidos/route.ts`**

```typescript
// app/api/pedidos/route.ts
import { NextResponse } from 'next/server';
import { buscarPorId } from '@/lib/presentes';
import { criarPedido } from '@/lib/pedidos';
import { gerarPixCopiaCola, gerarQrCodeDataUrl } from '@/lib/pix';

export async function POST(request: Request) {
  const { presenteId, nomeConvidado, mensagem } = await request.json();

  const presente = buscarPorId(presenteId);
  if (!presente || presente.status !== 'disponivel') {
    return NextResponse.json({ erro: 'Presente indisponivel' }, { status: 404 });
  }

  const copiaCola = gerarPixCopiaCola({
    chave: process.env.PIX_KEY ?? '',
    nomeRecebedor: process.env.PIX_NOME_RECEBEDOR ?? '',
    cidade: process.env.PIX_CIDADE ?? '',
    valor: presente.preco,
    identificador: `PRESENTE${presente.id}`,
  });
  const qrCodeDataUrl = await gerarQrCodeDataUrl(copiaCola);

  const pedido = criarPedido({
    presenteId: presente.id,
    nomeConvidado,
    mensagem: mensagem ?? '',
    pixCopiaCola: copiaCola,
    pixQrCodeDataUrl: qrCodeDataUrl,
  });

  return NextResponse.json({ pedido }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/pedidos/route.test.ts`
Expected: PASS (2 tests)

---

## Task 8: API route — status polling

**Files:**
- Create: `app/api/pedidos/[id]/route.ts`
- Test: `app/api/pedidos/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// app/api/pedidos/[id]/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-api-status.db');

describe('GET /api/pedidos/[id]', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('retorna o status atual do pedido', async () => {
    const { criarPresente } = await import('@/lib/presentes');
    const { criarPedido } = await import('@/lib/pedidos');
    const presente = criarPresente({ nome: 'Panela de pressao', descricao: '', preco: 200, imagem_url: '' });
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Rafael',
      mensagem: '',
      pixCopiaCola: 'x',
      pixQrCodeDataUrl: 'data:image/png;base64,eA==',
    });

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: String(pedido.id) }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pedido.status).toBe('aguardando_pagamento');
  });

  it('retorna 404 para pedido inexistente', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '9999' }) });
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/api/pedidos/[id]/route.test.ts"`
Expected: FAIL — route file does not exist yet.

- [ ] **Step 3: Write `app/api/pedidos/[id]/route.ts`**

```typescript
// app/api/pedidos/[id]/route.ts
import { NextResponse } from 'next/server';
import { buscarPedidoPorId } from '@/lib/pedidos';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pedido = buscarPedidoPorId(Number(id));
  if (!pedido) {
    return NextResponse.json({ erro: 'Pedido nao encontrado' }, { status: 404 });
  }
  return NextResponse.json({ pedido });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/api/pedidos/[id]/route.test.ts"`
Expected: PASS (2 tests)

---

## Task 9: Admin password gate

**Files:**
- Create: `middleware.ts`
- Create: `app/admin/AdminPasswordGate.tsx`
- Create: `app/api/admin/login/route.ts`

- [ ] **Step 1: Write `app/api/admin/login/route.ts`**

```typescript
// app/api/admin/login/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { senha } = await request.json();

  if (senha !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ erro: 'Senha incorreta' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_session', process.env.ADMIN_PASSWORD ?? '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return response;
}
```

- [ ] **Step 2: Write `middleware.ts`**

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const isAdminApi = request.nextUrl.pathname.startsWith('/api/admin') &&
    request.nextUrl.pathname !== '/api/admin/login';
  const isAdminPage = request.nextUrl.pathname === '/admin';

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  const session = request.cookies.get('admin_session')?.value;
  if (session && session === process.env.ADMIN_PASSWORD) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/api/admin/:path*'],
};
```

Note: `/admin` itself is allowed through even without a session so the page component can render the password form client-side; the API routes underneath are what actually enforce the gate.

- [ ] **Step 3: Write `app/admin/AdminPasswordGate.tsx`**

```tsx
// app/admin/AdminPasswordGate.tsx
'use client';

import { useState, type ReactNode } from 'react';

export default function AdminPasswordGate({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ senha }),
    });
    if (response.ok) {
      setAutenticado(true);
      setErro('');
    } else {
      setErro('Senha incorreta');
    }
  }

  if (autenticado) return <>{children}</>;

  return (
    <form onSubmit={entrar} className="max-w-sm mx-auto mt-24 flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Acesso restrito</h1>
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha de administrador"
        className="border rounded px-3 py-2"
      />
      {erro && <p className="text-red-600 text-sm">{erro}</p>}
      <button type="submit" className="bg-neutral-800 text-white rounded px-3 py-2">
        Entrar
      </button>
    </form>
  );
}
```

---

## Task 10: Admin API — manage gifts and mark orders paid

**Files:**
- Create: `app/api/admin/presentes/route.ts`
- Create: `app/api/admin/presentes/[id]/route.ts`
- Create: `app/api/admin/pedidos/route.ts`
- Create: `app/api/admin/pedidos/[id]/marcar-pago/route.ts`

- [ ] **Step 1: Write `app/api/admin/presentes/route.ts`**

```typescript
// app/api/admin/presentes/route.ts
import { NextResponse } from 'next/server';
import { criarPresente, listarTodos } from '@/lib/presentes';

export async function GET() {
  return NextResponse.json({ presentes: listarTodos() });
}

export async function POST(request: Request) {
  const dados = await request.json();
  const presente = criarPresente({
    nome: dados.nome,
    descricao: dados.descricao ?? '',
    preco: Number(dados.preco),
    imagem_url: dados.imagem_url ?? '',
  });
  return NextResponse.json({ presente }, { status: 201 });
}
```

- [ ] **Step 2: Write `app/api/admin/presentes/[id]/route.ts`**

```typescript
// app/api/admin/presentes/[id]/route.ts
import { NextResponse } from 'next/server';
import { atualizarPresente, removerPresente } from '@/lib/presentes';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dados = await request.json();
  atualizarPresente(Number(id), dados);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  removerPresente(Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Write `app/api/admin/pedidos/route.ts`**

```typescript
// app/api/admin/pedidos/route.ts
import { NextResponse } from 'next/server';
import { listarPedidos } from '@/lib/pedidos';

export async function GET() {
  return NextResponse.json({ pedidos: listarPedidos() });
}
```

- [ ] **Step 4: Write `app/api/admin/pedidos/[id]/marcar-pago/route.ts`**

```typescript
// app/api/admin/pedidos/[id]/marcar-pago/route.ts
import { NextResponse } from 'next/server';
import { marcarComoPago } from '@/lib/pedidos';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  marcarComoPago(Number(id));
  return NextResponse.json({ ok: true });
}
```

No automated tests in this task: these are thin CRUD wrappers already covered indirectly by the `lib/presentes.ts` and `lib/pedidos.ts` unit tests. Manual verification happens in Task 13.

---

## Task 11: Home page and gift grid

**Files:**
- Modify: `app/page.tsx`
- Create: `app/components/GiftGrid.tsx`
- Create: `app/components/CheckoutModal.tsx`

- [ ] **Step 1: Write `app/components/CheckoutModal.tsx`**

```tsx
// app/components/CheckoutModal.tsx
'use client';

import { useEffect, useState } from 'react';

interface Props {
  presenteId: number;
  nome: string;
  preco: number;
  onFechar: () => void;
  onPago: () => void;
}

type Etapa = 'formulario' | 'aguardando' | 'confirmado';

export default function CheckoutModal({ presenteId, nome, preco, onFechar, onPago }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('formulario');
  const [nomeConvidado, setNomeConvidado] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copiaCola, setCopiaCola] = useState('');

  async function confirmarReserva(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ presenteId, nomeConvidado, mensagem }),
    });
    const body = await response.json();
    setPedidoId(body.pedido.id);
    setCopiaCola(body.pedido.pix_copia_cola);
    setQrCodeDataUrl(body.pedido.pix_qr_code_data_url);
    setEtapa('aguardando');
  }

  useEffect(() => {
    if (etapa !== 'aguardando' || !pedidoId) return;
    const intervalo = setInterval(async () => {
      const response = await fetch(`/api/pedidos/${pedidoId}`);
      const body = await response.json();
      if (body.pedido.status === 'pago') {
        setEtapa('confirmado');
        onPago();
        clearInterval(intervalo);
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [etapa, pedidoId, onPago]);

  function copiarCodigo() {
    navigator.clipboard.writeText(copiaCola);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <button onClick={onFechar} className="float-right text-neutral-500">×</button>
        <h2 className="text-lg font-semibold mb-4">{nome} — R$ {preco.toFixed(2)}</h2>

        {etapa === 'formulario' && (
          <form onSubmit={confirmarReserva} className="flex flex-col gap-3">
            <input
              required
              placeholder="Seu nome"
              value={nomeConvidado}
              onChange={(e) => setNomeConvidado(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <textarea
              placeholder="Mensagem para os noivos (opcional)"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <button type="submit" className="bg-rose-700 text-white rounded px-3 py-2">
              Gerar Pix
            </button>
          </form>
        )}

        {etapa === 'aguardando' && (
          <div className="flex flex-col items-center gap-3">
            {qrCodeDataUrl && (
              <img src={qrCodeDataUrl} alt="QR Code Pix" className="w-48 h-48 object-contain border" />
            )}
            <button onClick={copiarCodigo} className="text-xs underline text-neutral-600 break-all">
              Copiar código Pix
            </button>
            <p className="text-sm text-neutral-700 text-center">
              Pague com o app do seu banco. Os noivos confirmam o recebimento manualmente
              assim que o Pix cair na conta — pode levar algumas horas.
            </p>
          </div>
        )}

        {etapa === 'confirmado' && (
          <p className="text-green-700 font-medium">Presente confirmado, muito obrigado! 💛</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/components/GiftGrid.tsx`**

```tsx
// app/components/GiftGrid.tsx
'use client';

import { useState } from 'react';
import CheckoutModal from './CheckoutModal';

interface Presente {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string;
}

export default function GiftGrid({ presentesIniciais }: { presentesIniciais: Presente[] }) {
  const [presentes, setPresentes] = useState(presentesIniciais);
  const [selecionado, setSelecionado] = useState<Presente | null>(null);

  function removerDaGrade(id: number) {
    setPresentes((atual) => atual.filter((p) => p.id !== id));
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {presentes.map((presente) => (
        <div key={presente.id} className="border rounded-lg overflow-hidden flex flex-col">
          <img src={presente.imagem_url} alt={presente.nome} className="w-full aspect-square object-cover" />
          <div className="p-3 flex flex-col gap-2 flex-1">
            <h3 className="font-medium">{presente.nome}</h3>
            <p className="text-sm text-neutral-600 flex-1">{presente.descricao}</p>
            <p className="font-semibold">R$ {presente.preco.toFixed(2)}</p>
            <button
              onClick={() => setSelecionado(presente)}
              className="bg-rose-700 text-white rounded px-3 py-2 text-sm"
            >
              Presentear
            </button>
          </div>
        </div>
      ))}

      {selecionado && (
        <CheckoutModal
          presenteId={selecionado.id}
          nome={selecionado.nome}
          preco={selecionado.preco}
          onFechar={() => setSelecionado(null)}
          onPago={() => removerDaGrade(selecionado.id)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `app/page.tsx`**

```tsx
// app/page.tsx
import { listarDisponiveis } from '@/lib/presentes';
import { expirarPedidosAntigos } from '@/lib/pedidos';
import GiftGrid from './components/GiftGrid';

export default function Home() {
  expirarPedidosAntigos();
  const presentes = listarDisponiveis();
  const nomes = process.env.COUPLE_NAMES ?? 'Nossa Lista de Presentes';
  const data = process.env.WEDDING_DATE ?? '';

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <header className="text-center mb-10">
        <h1 className="font-serif text-4xl mb-2">{nomes}</h1>
        {data && <p className="text-neutral-600">{data}</p>}
        <p className="mt-4 text-neutral-700 max-w-xl mx-auto">
          Sua presença é o nosso maior presente, mas se quiser nos ajudar a começar essa nova vida, aqui está nossa lista.
        </p>
      </header>
      <GiftGrid presentesIniciais={presentes} />
    </main>
  );
}
```

- [ ] **Step 4: Manually verify the home page renders**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: Page shows the couple names/date/message and a grid of the 8 seeded gifts, each with a "Presentear" button.

---

## Task 12: Admin dashboard page

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Write `app/admin/page.tsx`**

```tsx
// app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import AdminPasswordGate from './AdminPasswordGate';

interface Presente {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string;
  status: string;
}

interface Pedido {
  id: number;
  presente_id: number;
  nome_convidado: string;
  mensagem: string;
  status: string;
}

function Painel() {
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [novo, setNovo] = useState({ nome: '', descricao: '', preco: '', imagem_url: '' });

  async function carregar() {
    const [pr, pd] = await Promise.all([
      fetch('/api/admin/presentes').then((r) => r.json()),
      fetch('/api/admin/pedidos').then((r) => r.json()),
    ]);
    setPresentes(pr.presentes);
    setPedidos(pd.pedidos);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function adicionarPresente(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/admin/presentes', { method: 'POST', body: JSON.stringify(novo) });
    setNovo({ nome: '', descricao: '', preco: '', imagem_url: '' });
    carregar();
  }

  async function removerPresenteItem(id: number) {
    await fetch(`/api/admin/presentes/${id}`, { method: 'DELETE' });
    carregar();
  }

  async function marcarPago(id: number) {
    await fetch(`/api/admin/pedidos/${id}/marcar-pago`, { method: 'POST' });
    carregar();
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-10">
      <section>
        <h2 className="text-xl font-semibold mb-4">Presentes</h2>
        <form onSubmit={adicionarPresente} className="flex flex-wrap gap-2 mb-4">
          <input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="border rounded px-2 py-1" required />
          <input placeholder="Descrição" value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} className="border rounded px-2 py-1" />
          <input placeholder="Preço" type="number" value={novo.preco} onChange={(e) => setNovo({ ...novo, preco: e.target.value })} className="border rounded px-2 py-1" required />
          <input placeholder="URL da imagem" value={novo.imagem_url} onChange={(e) => setNovo({ ...novo, imagem_url: e.target.value })} className="border rounded px-2 py-1" />
          <button type="submit" className="bg-neutral-800 text-white rounded px-3 py-1">Adicionar</button>
        </form>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th>Nome</th><th>Preço</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {presentes.map((p) => (
              <tr key={p.id} className="border-b">
                <td>{p.nome}</td>
                <td>R$ {p.preco.toFixed(2)}</td>
                <td>{p.status}</td>
                <td><button onClick={() => removerPresenteItem(p.id)} className="text-red-600">Remover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Pedidos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th>Convidado</th><th>Mensagem</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-b">
                <td>{p.nome_convidado}</td>
                <td>{p.mensagem}</td>
                <td>{p.status}</td>
                <td>
                  {p.status !== 'pago' && (
                    <button onClick={() => marcarPago(p.id)} className="text-green-700">Marcar como pago</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

export default function AdminPage() {
  return (
    <AdminPasswordGate>
      <Painel />
    </AdminPasswordGate>
  );
}
```

- [ ] **Step 2: Manually verify the admin flow**

Run: `npm run dev`, open `http://localhost:3000/admin`.
Expected: Password form appears; entering the wrong password shows "Senha incorreta"; entering `ADMIN_PASSWORD` from `.env.local` shows the gift/order tables. Adding a gift makes it appear in the table and on the home grid. Removing a gift removes it from both.

---

## Task 13: End-to-end manual verification and README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Lista de Presentes de Casamento

## Rodando localmente

1. `npm install`
2. `cp .env.local.example .env.local` e edite os valores (nomes, data, senha do admin, chave Pix, nome do titular e cidade).
3. `npm run seed` — popula o banco com 8 presentes de exemplo.
4. `npm run dev` — abre em http://localhost:3000

## Como funciona o pagamento

Não há gateway de pagamento nem conta externa: o próprio site gera o QR code
Pix "Copia e Cola" localmente, usando a chave Pix, nome e cidade definidos no
`.env.local`. O dinheiro cai direto na conta associada a essa chave.

Como não existe confirmação automática, quando um convidado paga, os noivos
precisam checar o extrato do banco e marcar o pedido como pago manualmente
em `/admin`. Só então o presente some da lista para todo mundo.

## Painel administrativo

Acesse `/admin` e use a senha definida em `ADMIN_PASSWORD`. Lá você adiciona/remove
presentes e marca pedidos como pagos.

## Testes

`npm test`
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: All tests pass (db, presentes, pedidos, pix, pedidos route, status route).

- [ ] **Step 3: Full manual end-to-end walkthrough**

Run: `npm run dev`, then in the browser:
1. Open `http://localhost:3000` — confirm the grid shows 8 gifts.
2. Click "Presentear" on one, fill in a name, submit — confirm a QR code image and a "Copiar código Pix" link appear, plus the text explaining confirmation is manual.
3. Open `http://localhost:3000/admin` in another tab, log in, find that order under "Pedidos", click "Marcar como pago".
4. Back on the guest tab, within 5 seconds the modal should show the thank-you message.
5. Reload the home page — confirm the gift is gone from the grid (state persisted in SQLite).
6. Optionally scan the QR code with a real bank app to confirm it's recognized as a valid Pix charge for the right amount (it will show your real Pix key and the item's price).

---

## Self-Review Notes

- **Spec coverage:** home + grid (Task 11), checkout flow with name/message/Pix QR/copia-e-cola/manual-confirmation messaging (Task 11 CheckoutModal), admin panel (Tasks 9-12), data model (Tasks 2-4), local Pix BR Code generation (Task 5), seed content (Task 6). All spec sections are covered. No Mercado Pago / gateway / webhook remains anywhere in the plan, matching the user's explicit choice that money must land directly in their own account.
- **Type consistency:** `Pedido.pix_copia_cola` / `pix_qr_code_data_url` field names match across `lib/pedidos.ts`, `db/schema.sql`, the API routes, and `CheckoutModal.tsx`. `Presente.status` values (`disponivel`/`reservado`/`pago`) match across `lib/presentes.ts`, `schema.sql`, and the admin UI.
- **No placeholders:** all steps include complete, runnable code, including a from-scratch EMV/CRC16 Pix BR Code implementation (Task 5) with a manually-verified CRC16 test vector.
