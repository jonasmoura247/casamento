# Registro das Operações de Tratamento (LGPD art. 37)

Documento interno, não voltado ao usuário final — satisfaz a obrigação do
art. 37 de manter registro das operações de tratamento de dados pessoais.
Ver também a política pública em `/privacidade` e o plano/spec que
originaram estas medidas: `docs/superpowers/plans/2026-09-21-lgpd-compliance.md`.

| Dado pessoal | Tabela/coluna | Titular | Finalidade | Base legal | Retenção | Compartilhado com terceiros |
|---|---|---|---|---|---|---|
| E-mail | `contas.email` | Casal | Login, identificação da conta | Execução de contrato (art. 7º V) | Enquanto a conta existir; excluível a qualquer momento em `/admin` | Não |
| Senha (hash scrypt) | `contas.senha_hash` | Casal | Autenticação | Execução de contrato (art. 7º V) | Idem acima | Não |
| Nome do casal, data, local, mensagem | `casamentos.*` | Casal | Exibição pública na lista de presentes | Execução de contrato (art. 7º V) | Idem acima | Não |
| Chave Pix, nome do titular, cidade | `casamentos.pix_*` | Casal | Gerar QR Code Pix para recebimento dos presentes | Execução de contrato (art. 7º V) | Idem acima | Não (Pix gerado localmente, sem gateway/processador externo) |
| Nome e mensagem do convidado | `pedidos.nome_convidado`, `pedidos.mensagem` | Convidado | Identificar quem presenteou, permitir agradecimento pelo casal | Execução de contrato (art. 7º V) | 90 dias após o casamento expirar, depois anonimizado automaticamente (`anonimizarPedidosAntigos`) | Não |
| Endereço IP (transitório) | Não persistido — usado só em memória para limitar tentativas de login/cadastro | Qualquer visitante | Prevenção de força bruta / abuso | Legítimo interesse — segurança (art. 7º IX, art. 46) | Não persistido; descartado ao reiniciar o processo | Não |

## Mecanismos automáticos de retenção/eliminação

- `models/pedidos.ts` → `anonimizarPedidosAntigos()`: roda a cada carregamento do painel `/admin` (via `pedidosController.listar()`), substituindo nome e mensagem do convidado por `[removido]`/vazio quando o casamento expirou há mais de 90 dias.
- `models/pedidos.ts` → `expirarPedidosAntigos()`: roda a cada acesso à página pública `/[slug]`, cancelando pedidos com Pix não pago há mais de 1h (não é uma medida de LGPD, é liberação de estoque do presente).
- `DELETE /api/admin/conta` (`controllers/authController.ts` → `excluirConta`): exclusão sob demanda do titular (casal), em cascata — pedidos, presentes, casamento, sessões e conta.

## Canal de exercício de direitos do titular

E-mail configurado em `PRIVACY_CONTACT_EMAIL` (`.env.local`), exibido em `/privacidade`.
