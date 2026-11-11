# Conformidade LGPD — Design

## Contexto e motivação

A auditoria de 2026-09-21 encontrou o projeto sem nenhuma camada de
conformidade com a Lei 13.709/2018 (LGPD), apesar de tratar dados pessoais
de duas categorias de titular:

- **O casal** (`contas`/`casamentos`): e-mail, senha (já em hash), nome do
  casal, data, local, mensagem, chave Pix, nome do titular da chave, cidade.
- **O convidado** (`pedidos`): nome e mensagem, preenchidos sem nunca criar
  conta, apenas ao presentear.

Gaps identificados (ver auditoria completa na conversa): nenhuma política de
privacidade, nenhum canal para o titular exercer os direitos do art. 18,
nenhum encarregado identificado, nenhuma rotina de eliminação/retenção após
o fim da finalidade, e nenhuma forma de o casal excluir a própria conta.

## Escopo

- **A — Transparência**: página `/privacidade` (política de privacidade) +
  aviso/link no cadastro e no checkout do convidado.
- **B — Direitos do titular**: canal de contato (e-mail do encarregado) +
  exclusão de conta self-service pelo casal (`DELETE /api/admin/conta`),
  que apaga em cascata casamento, presentes e pedidos (dados dos
  convidados inclusos).
- **C — Retenção e eliminação automática**: dados de convidados
  (`nome_convidado`, `mensagem`) são anonimizados automaticamente 90 dias
  após o casamento expirar — sem cron job, reaproveitando o padrão já usado
  por `expirarPedidosAntigos()` (roda de forma oportunista quando o dado é
  acessado).
- **D — Registro de operações de tratamento**: documento interno
  (`docs/lgpd-registro-tratamento.md`) listando dado × finalidade × base
  legal × retenção, satisfazendo o art. 37 sem construir software para
  isso.

Fora de escopo (deferido, com justificativa):

- **Criptografia em repouso da chave Pix** — exigiria gestão de chave/
  segredo nova (KMS, variável de ambiente com master key, rotação). É item
  de segurança técnica (art. 46) mais do que uma exigência textual direta
  da LGPD; tratar em spec própria se o dono do projeto confirmar que quer
  esse investimento.
- **Portabilidade/exportação automatizada de dados** (art. 18 V) — volume
  de titulares é baixo (produto pessoal, não SaaS de massa); atendida
  manualmente via o canal de contato até que o volume justifique
  automação.
- **Banner de consentimento de cookies** — o único cookie (`sessao`) é
  estritamente necessário para autenticação; a LGPD (diferente da
  ePrivacy/GDPR) não exige aviso para cookies estritamente necessários.
- **Relatório de Impacto à Proteção de Dados (RIPD) formal** — só é
  exigível a pedido da ANPD (art. 38) ou para tratamento de alto risco;
  volume e sensibilidade dos dados aqui não justificam produzir um agora.

## Modelo de dados

Nenhuma migração de schema. A anonimização usa um valor-sentinela na
própria coluna existente (`pedidos.nome_convidado`), evitando coluna nova:

```sql
-- nenhuma alteração em db/schema.sql
```

Marcador de "já anonimizado": `nome_convidado = '[removido]'`. Idempotente
— a query de anonimização já filtra `WHERE nome_convidado != '[removido]'`.

## Retenção e eliminação automática (bloco C)

Janela de retenção: **90 dias corridos após o casamento expirar**
(`data_casamento + 1 dia`, mesmo corte já usado por `estaExpirado`).

```typescript
// models/pedidos.ts — nova função
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

Ponto de disparo: dentro de `pedidosController.listar()` (o único lugar
onde os dados de convidados de fato ficam visíveis para um humano — o
painel `/admin`), antes de devolver a lista. Mesmo padrão de
"roda de forma oportunista a cada acesso" já usado por
`expirarPedidosAntigos()` em `app/[slug]/page.tsx` — sem cron job novo.

## Exclusão de conta (bloco B)

Cascata de eliminação, na ordem exigida pelas FKs (pedidos → presentes →
sessões → casamento → conta):

```typescript
// models/pedidos.ts
export function removerPedidosDoCasamento(casamentoId: number): void {
  const db = getDb();
  db.prepare(
    `DELETE FROM pedidos WHERE presente_id IN
       (SELECT id FROM presentes WHERE casamento_id = ?)`
  ).run(casamentoId);
}

// models/presentes.ts
export function removerTodosDoCasamento(casamentoId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM presentes WHERE casamento_id = ?').run(casamentoId);
}

// models/casamentos.ts
export function removerCasamento(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM casamentos WHERE id = ?').run(id);
}

// models/sessoes.ts
export function apagarSessoesDaConta(contaId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM sessoes WHERE conta_id = ?').run(contaId);
}

// models/contas.ts
export function removerConta(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM contas WHERE id = ?').run(id);
}
```

```typescript
// controllers/authController.ts
export function excluirConta(contaId: number, casamentoId: number): void {
  removerPedidosDoCasamento(casamentoId);
  removerTodosDoCasamento(casamentoId);
  removerCasamento(casamentoId);
  apagarSessoesDaConta(contaId);
  removerConta(contaId);
}
```

```typescript
// app/api/admin/conta/route.ts — novo
export async function DELETE() {
  const token = (await cookies()).get('sessao')?.value;
  const contaId = token && resolverContaIdPorToken(token);
  const casamento = contaId && buscarPorContaId(contaId);
  if (!contaId || !casamento) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  excluirConta(contaId, casamento.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('sessao');
  return response;
}
```

UI: em `app/admin/Painel.tsx`, seção "Dados do casamento" ganha um botão
"Excluir minha conta" (estilo destrutivo, `window.confirm` antes de
disparar — sem modal customizado, YAGNI) que chama
`DELETE /api/admin/conta` e redireciona para `/`.

## Transparência (bloco A)

Página nova `app/privacidade/page.tsx`, estática (sem dado dinâmico),
cobrindo os itens exigidos pelo art. 9º:

- Quem é o controlador (o casal dono de cada lista) e quem opera a
  infraestrutura (o autor do produto).
- Quais dados são coletados de cada titular (casal vs. convidado) e para
  quê.
- Base legal: execução de contrato (art. 7º V) para os dados necessários
  a gerar/entregar o presente e o Pix; nenhum dado é usado para
  finalidade além dessa.
- Prazo de retenção: dados de convidado anonimizados 90 dias após o
  casamento expirar; dados do casal mantidos enquanto a conta existir,
  apagáveis a qualquer momento em `/admin`.
- Direitos do titular (art. 18) e como exercê-los: e-mail de contato.
- Identificação do encarregado (mesmo e-mail, ou outro se o dono do
  projeto preferir).

Contato do encarregado vem de env var nova (`.env.local.example`):

```
PRIVACY_CONTACT_EMAIL=preencha-aqui@exemplo.com
```

Link "Política de Privacidade" adicionado:
- Rodapé simples em `app/layout.tsx` (novo `<footer>`, só nas páginas
  públicas — não precisa aparecer dentro do `/admin`).
- Texto curto abaixo do botão de submit em `CadastroForm.tsx` e
  `CheckoutModal.tsx`: "Ao continuar, você concorda com nossa
  [Política de Privacidade](/privacidade)."

## Registro de operações de tratamento (bloco D)

Documento novo, não voltado ao usuário final, para satisfazer o art. 37
("manter registro das operações de tratamento"):

`docs/lgpd-registro-tratamento.md` — tabela dado × tabela/coluna ×
finalidade × base legal × retenção × compartilhamento (nenhum
compartilhamento com terceiros hoje — Pix é gerado localmente, sem
gateway).

## Testes

- `models/pedidos.test.ts`: `anonimizarPedidosAntigos` anonimiza pedidos
  de casamentos expirados há mais de 90 dias e preserva os demais
  (dentro da janela, ou já anonimizados — idempotência).
- `controllers/pedidosController.test.ts`: `listar()` aciona a
  anonimização antes de devolver a lista.
- `models/contas.test.ts`, `models/casamentos.test.ts`,
  `models/presentes.test.ts`, `models/sessoes.test.ts`: testes das novas
  funções de remoção.
- `controllers/authController.test.ts`: `excluirConta` remove conta,
  casamento, presentes, pedidos e sessões; sessão apagada não resolve
  mais para nenhuma conta.
- `app/api/admin/conta/route.test.ts`: 401 sem sessão; 200 + cookie
  limpo com sessão válida; idempotência do lado do banco (segunda
  chamada com o mesmo cookie já removido cai no 401).
- Cobertura 100% mantida (`vitest.config.ts` já exige isso).

## Migração de dados existentes

Nenhuma. O banco de dev/produção atual não tem casamentos expirados há
mais de 90 dias, então a anonimização automática não apaga nada
retroativamente na primeira execução.
