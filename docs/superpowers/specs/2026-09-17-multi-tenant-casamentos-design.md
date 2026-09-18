# Multi-tenant: contas de casal, slug público, contador e expiração — Design

## Contexto e motivação

O site hoje serve um único casal (Jonas & Natália), com dados fixos em `.env`
(`COUPLE_NAMES`, `WEDDING_DATE`, `PIX_KEY`, etc.) e um painel `/admin`
protegido por uma senha única também vinda do `.env`.

O pedido é transformar isso num produto multi-casal: qualquer pessoa pode
criar uma conta, configurar a própria lista de presentes (nome, data, local,
mensagem, chave Pix) e receber um link público próprio
(`/<slug-escolhido>`, ex: `/jonasenatalia`). O link expira automaticamente
um dia após a data do casamento. Cobertura de teste unitário de 100% é um
requisito explícito para todo o código novo e alterado.

## Escopo

Este spec cobre, de ponta a ponta, os três blocos identificados durante o
brainstorming:

- **A — Fundação multi-tenant**: contas, sessões, casamentos, escopo de
  presentes/pedidos por casamento.
- **B — Onboarding**: home pública explicando o produto, cadastro, login.
- **C — Contador regressivo e expiração automática do link**.

Fora de escopo (YAGNI, deferido explicitamente): recuperação de senha,
verificação de email, edição de slug após criado, exclusão de conta,
múltiplos administradores por casamento, i18n.

## Organização do código (estilo MVC)

Pedido explícito do dono do projeto: mesma stack (TypeScript/Next.js, sem
trocar de linguagem), mas organizada de um jeito que mapeie claramente para
Model-View-Controller, já que é o mental model que ele traz de ASP.NET/C#.
O Next.js não tem pastas `Models`/`Views`/`Controllers` nativas, então a
convenção abaixo é uma camada de organização por cima das convenções do
framework — sem brigar com o roteamento por arquivo do Next.js (que exige
`app/**/page.tsx` e `app/api/**/route.ts` nesses caminhos exatos).

- **`models/`** (substitui `lib/`) — um arquivo por entidade: tipos +
  acesso a dados. Ex.: `models/contas.ts`, `models/casamentos.ts`,
  `models/presentes.ts`, `models/pedidos.ts`, `models/sessoes.ts`,
  `models/pix.ts`, `models/db.ts`. Equivalente ao Model do MVC — nunca
  importa nada de `app/`.
- **`controllers/`** (pasta nova) — a lógica de negócio de cada ação,
  independente de HTTP: recebe dados já validados, chama os `models/`,
  devolve resultado ou lança erro. Ex.: `controllers/presentesController.ts`
  exporta `listar()`, `criar()`, `atualizar()`, `remover()`;
  `controllers/authController.ts` exporta `cadastrar()`, `login()`,
  `logout()`. Um controller não sabe o que é `Request`/`NextResponse`.
- **`app/api/**/route.ts`** — vira "Controller HTTP" bem fino: só extrai
  parâmetros da request (`params`, `body`, cookie de sessão), chama a
  função correspondente em `controllers/`, e traduz o resultado para
  `NextResponse`. Não tem lógica de negócio nem SQL.
- **`app/**/page.tsx` + `app/components/*.tsx`** — continuam sendo as
  Views. Ficam onde o Next.js exige (não dá pra mover), mas o objetivo é
  que fiquem "burras": só leitura de dados via props/fetch e apresentação,
  sem regra de negócio embutida — isso já era verdade na maior parte do
  código atual e continua sendo o padrão.

Essa separação (`route.ts` fino → `controllers/` com a regra → `models/`
com o acesso a dado) é o que dá a leitura "Controller chama Model, View só
mostra" mesmo sem uma pasta `Controllers/` no sentido literal do
ASP.NET MVC. Aplica-se a todo código novo deste spec e é usada para
reorganizar o código existente (`lib/presentes.ts`, `lib/pedidos.ts`,
`lib/pix.ts`, `lib/db.ts`) durante o bloco A, já que ele reescreve essas
mesmas funções para adicionar `casamento_id`.

## Modelo de dados

Substitui `db/schema.sql` atual. `presentes` e `pedidos` ganham
`casamento_id`; os campos que hoje vêm do `.env` viram colunas de
`casamentos`.

```sql
CREATE TABLE contas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessoes (
  token TEXT PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id),
  expira_em TEXT NOT NULL
);

CREATE TABLE casamentos (
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

CREATE TABLE presentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  casamento_id INTEGER NOT NULL REFERENCES casamentos(id),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco REAL NOT NULL,
  imagens TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'reservado', 'pago'))
);

CREATE TABLE pedidos (
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

`slug`: `^[a-z0-9-]{3,50}$`, validado e normalizado (lowercase, espaços viram
`-`) no cadastro. Unicidade garantida pela constraint `UNIQUE` + checagem
amigável antes do insert.

Não há mais `.env` para dados de casamento — `COUPLE_NAMES`, `WEDDING_DATE`,
`PIX_KEY`, `PIX_NOME_RECEBEDOR`, `PIX_CIDADE` saem do `.env.example`.
`ADMIN_PASSWORD` também sai (substituído por `contas`/login).

## Autenticação e sessão

- **Hash de senha**: `node:crypto` `scrypt` (stdlib, sem dependência nova).
  Formato armazenado: `salt:hash` em hex.
- **Sessão**: ao logar, gera token aleatório (`crypto.randomBytes(32)`),
  grava em `sessoes` com `expira_em` (+8h), define cookie `sessao` (httpOnly,
  sameSite=lax) com o token. Isso substitui o cookie atual que guardava a
  própria senha em texto puro.
- **Logout**: apaga a linha de `sessoes` e limpa o cookie.
- `middleware.ts` passa a resolver `casamento_id` a partir do cookie de
  sessão (join `sessoes → contas → casamentos`) em vez de comparar contra
  `ADMIN_PASSWORD`. Toda rota de API do painel usa esse `casamento_id`
  resolvido no servidor — nunca um valor vindo do corpo/query da requisição
  do cliente. Isso é o que impede um casal ler/editar dados de outro.

## Rotas

| Rota | Tipo | Descrição |
|---|---|---|
| `/` | pública | Home explicando o produto, botões "Criar minha lista" e "Já tenho conta" |
| `/cadastro` | pública | Formulário: email, senha, nome do casal, data, local, mensagem, slug, chave Pix, nome do recebedor, cidade |
| `/login` | pública | Email + senha |
| `/admin` | autenticada | Painel: CRUD de presentes/pedidos (já existe) + edição dos dados do próprio casamento (nome/data/local/mensagem/Pix/contador) |
| `/[slug]` | pública | Página do casal: contador (se `mostrar_contador`), lista de presentes, ou tela de encerramento se expirado |

`/[slug]` reaproveita `GiftGrid`/`CheckoutModal` já existentes, passando o
`casamento_id` resolvido pelo slug.

## Contador e expiração

- Calculado a cada request no servidor: `agora`, `data_casamento`,
  `corte = inicio_do_dia(data_casamento) + 1 dia`.
- Se `agora >= corte`: a rota `/[slug]` renderiza uma tela simples
  ("Este casamento já aconteceu, obrigado a todos! 💛") em vez da lista —
  não é um 404, para não parecer um erro pra quem tinha o link salvo.
- Se `agora < corte` e `mostrar_contador = 1`: componente client-side com
  `setInterval` de 1s mostrando dias/horas/min/seg restantes até
  `data_casamento`.
- Sem cron job / job agendado — é sempre um cálculo síncrono no render.

## Fluxo de cadastro (onboarding)

1. Home (`/`) explica o produto, "Criar minha lista de presentes" leva a `/cadastro`.
2. Formulário único (sem multi-step, para manter simples): conta + dados do
   casamento + Pix, tudo de uma vez.
3. No submit: cria `conta`, cria `casamento` vinculado, cria sessão, loga
   automaticamente, redireciona para `/admin` (onde a pessoa já cadastra os
   presentes).
4. Erros tratados: email já cadastrado, slug já em uso — mensagens inline,
   sem recarregar a página.

## Testes (100% de cobertura)

- `vitest.config.ts` ganha `coverage: { thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 } }`.
- Toda função nova (hash/verificação de senha, criação/validação de sessão,
  geração/validação de slug, cálculo de corte de expiração, escopo por
  `casamento_id` em `lib/presentes.ts`/`lib/pedidos.ts`) recebe teste
  unitário escrito antes da implementação (TDD, como já é praticado no
  projeto).
- Teste de isolamento multi-tenant explícito: criar dois casamentos, criar
  presentes em cada um, garantir que a API de um nunca retorna/altera dados
  do outro.

## Migração dos dados atuais

O banco de dev atual (`lista-presentes.db`) contém só dados de exemplo/teste
(presentes seedados, pedidos de teste) — será recriado do zero com o schema
novo, sem necessidade de migração de dados reais. Jonas e Natália se
cadastram pela nova tela de cadastro como o primeiro casal do sistema.

## Fora de escopo / deferido

- Recuperação de senha por email (exigiria serviço de envio de email).
- Edição do slug depois de criado.
- Mais de uma conta por casamento.
- Exclusão de conta/casamento pela própria pessoa.
- Internacionalização (produto pt-BR apenas, como hoje).
