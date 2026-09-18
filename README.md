# 💌 Lista de Presentes de Casamento

Produto multi-tenant: qualquer pessoa se cadastra em `/cadastro` e recebe um
link próprio (`/<slug-escolhido>`) com a lista de presentes do seu casamento,
pronto para enviar aos convidados. O link vira uma tela de agradecimento
automaticamente um dia após a data do casamento cadastrada.

## Índice

- [Stack](#stack)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Como funciona o pagamento](#como-funciona-o-pagamento)
- [Painel administrativo](#painel-administrativo)
- [Organização do código](#organização-do-código-mvc)
- [Testes](#testes)
- [Segurança](#segurança)

## Stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)
- Tailwind CSS
- [Vitest](https://vitest.dev/) + Testing Library para testes
- QR code Pix gerado localmente com [`qrcode`](https://github.com/soldair/node-qrcode)

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local   # ajuste os valores, veja abaixo
npm run dev                        # abre em http://localhost:3000
```

Acesse `/cadastro` para criar a primeira conta e lista de presentes.

## Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

| Variável | Descrição |
| --- | --- |
| `ADMIN_PASSWORD` | Senha usada em rotas administrativas legadas (single-tenant). |
| `PIX_KEY` | Chave Pix padrão (CPF, e-mail, telefone ou chave aleatória). |
| `PIX_NOME_RECEBEDOR` | Nome do titular da chave Pix, até 25 caracteres, sem acentos (exigência do padrão BR Code). |
| `PIX_CIDADE` | Cidade do titular, até 15 caracteres, sem acentos. |
| `COUPLE_NAMES` | Texto exibido na home. |
| `WEDDING_DATE` | Data usada na home/contador. |

No fluxo multi-tenant (`/cadastro`), cada casal informa sua própria chave Pix,
nome e cidade direto no formulário — essas variáveis de ambiente servem apenas
como valores padrão/legado.

## Como funciona o pagamento

Não há gateway de pagamento nem conta externa: o próprio site gera o QR code
Pix "Copia e Cola" localmente, usando a chave Pix, nome e cidade que cada
casal informa no cadastro. O dinheiro cai direto na conta associada a essa
chave.

Como não existe confirmação automática, quando um convidado paga, o casal
precisa checar o extrato do banco e marcar o pedido como pago manualmente
em `/admin`. Só então o presente some da lista para todo mundo.

## Painel administrativo

Acesse `/login` com o e-mail/senha cadastrados. Em `/admin` você:

- edita os dados do próprio casamento (nome, data, local, mensagem, Pix);
- copia o link público da lista para enviar aos convidados;
- adiciona/edita/remove presentes;
- acompanha pedidos e marca como pago.

## Organização do código (MVC)

```
models/            tipos e acesso a dados (SQLite via better-sqlite3),
                    um arquivo por entidade
controllers/        regra de negócio, sem depender de Request/NextResponse
app/api/**/route.ts adaptador HTTP fino: extrai dados da requisição,
                    chama o controller, traduz o resultado
app/**/page.tsx      apresentação (páginas)
app/components/      apresentação (componentes reutilizáveis)
middleware.ts        autenticação por sessão + CSP com nonce por requisição
db/schema.sql        esquema do banco SQLite
```

## Testes

```bash
npm test                       # roda a suíte
npx vitest run --coverage      # roda com checagem de cobertura 100%
```

Cobertura de 100% (statements/branches/functions/lines) é obrigatória —
configurado em `vitest.config.ts`.

## Segurança

- Autenticação por sessão (cookie `sessao` + hash de senha com `scrypt`).
- Isolamento multi-tenant: toda mutação valida `casamento_id` no servidor
  antes de agir (proteção contra IDOR).
- CSP com nonce por requisição em `middleware.ts`.
- Imagens externas de presentes passam pelo `next/image` (mesma origem),
  evitando `img-src` amplo na CSP.
