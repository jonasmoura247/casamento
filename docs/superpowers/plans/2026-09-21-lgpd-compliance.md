# Conformidade LGPD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os gaps de LGPD encontrados na auditoria de 2026-09-21:
transparência (política de privacidade), direitos do titular (exclusão de
conta self-service), retenção/eliminação automática dos dados de
convidados, e registro interno de operações de tratamento.

**Architecture:** Nenhuma mudança estrutural — segue o MVC já existente
(`models/` → `controllers/` → `app/api/**/route.ts`). Nenhuma dependência
nova, nenhuma migração de schema (a anonimização usa um valor-sentinela na
coluna existente).

**Tech Stack:** Igual ao atual — Next.js (App Router, TypeScript),
better-sqlite3, Vitest com cobertura 100%.

Ver spec completa em `docs/superpowers/specs/2026-09-21-lgpd-compliance-design.md`.

---

## File Structure

- `models/pedidos.ts` — `anonimizarPedidosAntigos()`, `removerPedidosDoCasamento()`.
- `models/presentes.ts` — `removerTodosDoCasamento()`.
- `models/casamentos.ts` — `removerCasamento()`.
- `models/sessoes.ts` — `apagarSessoesDaConta()`.
- `models/contas.ts` — `removerConta()`.
- `controllers/pedidosController.ts` — `listar()` passa a chamar `anonimizarPedidosAntigos()` antes de listar.
- `controllers/authController.ts` — `excluirConta(contaId, casamentoId)`.
- `app/api/admin/conta/route.ts` — novo, `DELETE`.
- `app/privacidade/page.tsx` — novo, política de privacidade estática.
- `app/layout.tsx` — ganha rodapé com link para `/privacidade`.
- `app/cadastro/CadastroForm.tsx` — texto + link para `/privacidade` perto do submit.
- `app/components/CheckoutModal.tsx` — texto + link para `/privacidade` perto do submit.
- `app/admin/Painel.tsx` — botão "Excluir minha conta" na seção do casamento.
- `.env.local.example` — nova var `PRIVACY_CONTACT_EMAIL`.
- `docs/lgpd-registro-tratamento.md` — novo, documentação interna (art. 37).

---

## Task 1: Retenção automática de dados de convidados

**Files:**
- Modify: `models/pedidos.ts`
- Modify: `controllers/pedidosController.ts`
- Test: `models/pedidos.test.ts`, `controllers/pedidosController.test.ts`

- [ ] **Step 1: Escrever testes falhando em `models/pedidos.test.ts`**

Casos: (a) pedido de casamento expirado há mais de 90 dias tem
`nome_convidado`/`mensagem` zerados; (b) pedido de casamento expirado há
menos de 90 dias não é tocado; (c) pedido já anonimizado não é
reprocessado (idempotência); (d) pedido de casamento ainda não expirado
não é tocado.

- [ ] **Step 2: Rodar para confirmar falha** — `npx vitest run models/pedidos.test.ts`

- [ ] **Step 3: Implementar `anonimizarPedidosAntigos()` em `models/pedidos.ts`**

```typescript
const RETENCAO_CONVIDADO_DIAS = 90;

export function anonimizarPedidosAntigos(): void {
  const db = getDb();
  db.prepare(
    `UPDATE pedidos SET nome_convidado = '[removido]', mensagem = ''
     WHERE nome_convidado != '[removido]'
       AND presente_id IN (
         SELECT presentes.id FROM presentes
         JOIN casamentos ON casamentos.id = presentes.casamento_id
         WHERE date(casamentos.data_casamento, '+1 day', '+${RETENCAO_CONVIDADO_DIAS} days') <= date('now')
       )`
  ).run();
}
```

- [ ] **Step 4: Rodar para confirmar sucesso** — `npx vitest run models/pedidos.test.ts`

- [ ] **Step 5: Escrever teste em `controllers/pedidosController.test.ts`** garantindo que `listar()` aciona a anonimização antes de devolver a lista (criar pedido de casamento expirado há 91 dias, chamar `listar`, esperar `nome_convidado === '[removido]'`).

- [ ] **Step 6: Chamar `anonimizarPedidosAntigos()` no início de `listar()` em `controllers/pedidosController.ts`**

```typescript
export function listar(casamentoId: number): Pedido[] {
  anonimizarPedidosAntigos();
  return listarPedidos(casamentoId);
}
```

- [ ] **Step 7: Rodar suíte completa** — `npx vitest run`

- [ ] **Step 8: Commit**

```bash
git add models/pedidos.ts controllers/pedidosController.ts models/pedidos.test.ts controllers/pedidosController.test.ts
git commit -m "feat(lgpd): anonimiza dados de convidados 90 dias apos o casamento expirar"
```

---

## Task 2: Exclusão de conta (cascata)

**Files:**
- Modify: `models/pedidos.ts`, `models/presentes.ts`, `models/casamentos.ts`, `models/sessoes.ts`, `models/contas.ts`
- Modify: `controllers/authController.ts`
- Create: `app/api/admin/conta/route.ts`
- Test: um teste por função nova nos models + `controllers/authController.test.ts` + `app/api/admin/conta/route.test.ts`

- [ ] **Step 1: Testes + implementação das funções de remoção nos models** (TDD por arquivo, mesmo padrão dos models existentes):
  - `models/pedidos.ts`: `removerPedidosDoCasamento(casamentoId)`
  - `models/presentes.ts`: `removerTodosDoCasamento(casamentoId)`
  - `models/casamentos.ts`: `removerCasamento(id)`
  - `models/sessoes.ts`: `apagarSessoesDaConta(contaId)`
  - `models/contas.ts`: `removerConta(id)`

  Cada função é uma única query `DELETE FROM <tabela> WHERE <coluna> = ?`
  (ver spec para o SQL exato de cada uma).

- [ ] **Step 2: Rodar `npx vitest run models/` para confirmar tudo verde**

- [ ] **Step 3: Escrever teste falhando em `controllers/authController.test.ts`** — `excluirConta` apaga tudo na ordem certa; sessão apagada não resolve mais para nenhuma conta; presente/pedido do casamento excluído somem.

- [ ] **Step 4: Implementar `excluirConta` em `controllers/authController.ts`**

```typescript
export function excluirConta(contaId: number, casamentoId: number): void {
  removerPedidosDoCasamento(casamentoId);
  removerTodosDoCasamento(casamentoId);
  removerCasamento(casamentoId);
  apagarSessoesDaConta(contaId);
  removerConta(contaId);
}
```

- [ ] **Step 5: Rodar para confirmar sucesso** — `npx vitest run controllers/authController.test.ts`

- [ ] **Step 6: Escrever teste falhando em `app/api/admin/conta/route.test.ts`** — 401 sem cookie de sessão; 200 + cookie `sessao` removido da resposta com sessão válida; após a chamada, uma nova requisição com o mesmo cookie antigo recebe 401 (a sessão foi apagada).

- [ ] **Step 7: Implementar `app/api/admin/conta/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolverContaIdPorToken } from '@/models/sessoes';
import { buscarPorContaId } from '@/models/casamentos';
import { excluirConta } from '@/controllers/authController';

export async function DELETE() {
  const token = (await cookies()).get('sessao')?.value;
  const contaId = token && resolverContaIdPorToken(token);
  const casamento = contaId && buscarPorContaId(contaId);
  if (!contaId || !casamento) {
    return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  }
  excluirConta(contaId, casamento.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('sessao');
  return response;
}
```

- [ ] **Step 8: Rodar suíte completa** — `npx vitest run`

- [ ] **Step 9: Commit**

```bash
git add models/ controllers/authController.ts controllers/authController.test.ts app/api/admin/conta/
git commit -m "feat(lgpd): permite exclusao de conta em cascata (art. 18 VI)"
```

---

## Task 3: UI de exclusão de conta

**Files:**
- Modify: `app/admin/Painel.tsx`
- Modify (se existir): `app/admin/Painel.test.tsx`

- [ ] **Step 1: Adicionar botão "Excluir minha conta" na seção `SecaoCasamento`** — estilo destrutivo (`text-red-600`), com `window.confirm('Isso vai apagar sua conta, sua lista e todos os pedidos recebidos. Essa ação não pode ser desfeita. Continuar?')` antes de disparar `fetch('/api/admin/conta', { method: 'DELETE' })`; em caso de sucesso, `router.push('/')`.

- [ ] **Step 2: Teste em `app/admin/Painel.test.tsx`** cobrindo: clique confirma → chama DELETE → redireciona; clique cancela (confirm retorna false) → não chama fetch.

- [ ] **Step 3: Rodar** — `npx vitest run app/admin/Painel.test.tsx`

- [ ] **Step 4: Commit**

```bash
git add app/admin/Painel.tsx app/admin/Painel.test.tsx
git commit -m "feat(lgpd): botao de excluir conta no painel"
```

---

## Task 4: Página de política de privacidade + avisos

**Files:**
- Create: `app/privacidade/page.tsx`
- Modify: `app/layout.tsx` (rodapé)
- Modify: `app/cadastro/CadastroForm.tsx`
- Modify: `app/components/CheckoutModal.tsx`
- Modify: `.env.local.example`

- [ ] **Step 1: Adicionar `PRIVACY_CONTACT_EMAIL` em `.env.local.example`** com comentário explicando que é o e-mail do encarregado/contato para exercício de direitos do titular.

- [ ] **Step 2: Criar `app/privacidade/page.tsx`** — página estática (server component, sem necessidade de teste de interação; se o projeto exigir cobertura de página, um smoke test de render basta) cobrindo: controlador, dados coletados por titular, finalidade, base legal, retenção (referenciar os 90 dias e a exclusão self-service), direitos do art. 18 e como exercê-los (`process.env.PRIVACY_CONTACT_EMAIL`), identificação do encarregado.

- [ ] **Step 3: Adicionar rodapé em `app/layout.tsx`** com link `<Link href="/privacidade">Política de Privacidade</Link>`.

- [ ] **Step 4: Adicionar aviso + link em `CadastroForm.tsx`** logo acima do botão de submit: "Ao continuar, você concorda com nossa Política de Privacidade."

- [ ] **Step 5: Adicionar o mesmo aviso em `CheckoutModal.tsx`**, na etapa `formulario`, acima do botão "Gerar Pix".

- [ ] **Step 6: Rodar suíte + typecheck** — `npx vitest run && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add app/privacidade/ app/layout.tsx app/cadastro/CadastroForm.tsx app/components/CheckoutModal.tsx .env.local.example
git commit -m "feat(lgpd): pagina de politica de privacidade e avisos no cadastro/checkout"
```

---

## Task 5: Registro interno de operações de tratamento

**Files:**
- Create: `docs/lgpd-registro-tratamento.md`

- [ ] **Step 1: Escrever o documento** — tabela markdown: dado pessoal | tabela/coluna | finalidade | base legal | retenção | compartilhado com terceiros (todas as linhas "não" — Pix gerado localmente, sem gateway/processador externo).

- [ ] **Step 2: Commit**

```bash
git add docs/lgpd-registro-tratamento.md
git commit -m "docs(lgpd): registro das operacoes de tratamento (art. 37)"
```

---

## Task 6: Verificação final

- [ ] **Step 1:** `npx vitest run --coverage` — cobertura 100% mantida.
- [ ] **Step 2:** `npx tsc --noEmit` — sem erros.
- [ ] **Step 3:** `npx eslint .` — sem erros novos introduzidos por este plano.
- [ ] **Step 4:** Teste manual: cadastrar um casamento de teste com `dataCasamento` no passado (>90 dias), abrir `/admin`, confirmar que o pedido de teste aparece anonimizado; excluir a conta pelo botão e confirmar que `/login` com as mesmas credenciais falha.
