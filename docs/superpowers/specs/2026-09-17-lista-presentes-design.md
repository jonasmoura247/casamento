# Lista de Presentes de Casamento — Design

## Visão geral

Site de lista de presentes de casamento, similar ao modelo Havan/Amazon: os convidados escolhem um presente, pagam via Pix diretamente para o casal (sem intermediário), e o item some da lista para todos assim que é reservado. Roda localmente (`npm run dev`).

## Stack

- **Next.js** — frontend e backend no mesmo projeto.
- **SQLite** — banco de dados em arquivo local, sem necessidade de instalar servidor de banco separado.
- **Geração de Pix local (BR Code / EMV)** — o QR code e o código "copia e cola" são montados no próprio projeto a partir da sua chave Pix, seguindo o padrão aberto do Banco Central. Não depende de nenhum gateway de pagamento (Mercado Pago, PagSeguro etc), não tem conta externa, não tem taxa.

Roda em `localhost:3000`. Como não há gateway intermediário, o **dinheiro cai direto na sua conta** (é um Pix normal, só que com valor e mensagem já preenchidos no QR code). Por isso a confirmação de pagamento **não é automática**: você confere no extrato do seu banco e marca o pedido como pago manualmente no painel `/admin`. Não há webhook nem integração de gateway a substituir depois — esse já é o modelo final, não um estágio de protótipo.

## Modelo de dados

### `presentes`
| Campo | Tipo | Descrição |
|---|---|---|
| id | integer (PK) | |
| nome | string | |
| descricao | string | |
| preco | decimal | |
| imagem_url | string | |
| status | enum | `disponivel` \| `reservado` \| `pago` |

### `pedidos`
| Campo | Tipo | Descrição |
|---|---|---|
| id | integer (PK) | |
| presente_id | integer (FK) | |
| nome_convidado | string | |
| mensagem | string (opcional) | Mensagem para os noivos |
| status | enum | `aguardando_pagamento` \| `pago` \| `cancelado` |
| criado_em | datetime | |

Regra de expiração: um pedido em `aguardando_pagamento` que passa **1 hora** sem confirmação de pagamento é marcado `cancelado`, e o presente correspondente volta a `disponivel`.

## Fluxo do convidado

1. Acessa a home: nomes do casal, data do casamento, mensagem curta, e a grade de presentes disponíveis (foto, nome, preço).
2. Clica em "Presentear" em um item → modal pede nome do convidado e mensagem opcional.
3. Sistema cria o `pedido` (status `aguardando_pagamento`), marca o `presente` como `reservado`, e gera localmente o Pix "Copia e Cola" (QR code + código) usando a chave Pix do casal, com o valor do presente já preenchido.
4. Tela de checkout mostra o QR code, o código copia-e-cola, e avisa que a confirmação é manual — os noivos verificam o pagamento e liberam.
5. Quando os noivos marcam o pedido como pago no painel `/admin` (após conferir o extrato), o pedido vira `pago`, o presente vira `pago`, e o item some da grade para todos os visitantes.
6. Se passar 1h sem os noivos marcarem como pago, o pedido vira `cancelado` e o presente volta a `disponivel` na grade.

## Painel administrativo (`/admin`)

Protegido por senha simples (variável de ambiente, sem sistema de login/usuários). Permite:
- Ver todos os presentes e seus status.
- Ver todos os pedidos (convidado, mensagem, status do pagamento).
- Adicionar, editar e remover presentes (nome, preço, foto, descrição).
- Marcar manualmente um pedido como pago (essa é a única forma de confirmar pagamento, já que não há gateway/webhook).

## Visual

Estilo moderno e romântico discreto:
- Tipografia serifada elegante para o nome do casal, sans-serif limpa para o restante.
- Fundo claro, paleta neutra com uma cor de destaque (ex: terracota ou verde-oliva) a ajustar depois com fotos reais.
- Grade de cards com foto grande, preço, e botão de destaque "Presentear".
- Home com nomes do casal, data do casamento e mensagem curta antes da grade.

## Conteúdo do protótipo

Para o protótipo inicial, a grade é populada com 6–8 presentes fictícios (nomes, preços e imagens placeholder), a serem substituídos pelos produtos reais depois.

## Fora de escopo (por ora)

- Login/autenticação de convidados.
- Confirmação automática de pagamento (exigiria um gateway/banco com API, o que tira o dinheiro do caminho direto até a conta do casal).
- Múltiplos métodos de pagamento além de Pix.
- Envio de notificações (e-mail/WhatsApp) aos noivos quando um presente é pago.
