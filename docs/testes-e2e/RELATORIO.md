# Relatório de testes de ponta a ponta

- **Data:** 23/09/2026
- **Ferramenta:** Playwright (navegador real) contra o servidor `next dev` em `http://localhost:3000`
- **Viewports:** Mobile 375×812 · Desktop 1440×900
- **Dados usados:** contas de teste criadas e **excluídas ao final** de cada bateria (pelo botão "Excluir minha conta"). Nada de teste ficou no banco.
- **Ordem:** primeiro todos os testes de **mobile** (M01–M20), depois todos os de **desktop** (D01–D20). Os prints estão em `mobile/` e `desktop/`.

Legenda: ✅ passou · 🐞 bug encontrado e **corrigido** durante os testes · ⚠️ observação (não corrigida)

---

## Bugs encontrados e corrigidos nesta rodada

| # | Onde | Problema | Correção |
|---|------|----------|----------|
| 1 | Página pública do casal | Contador regressivo causava erro de hidratação (servidor e navegador mostravam segundos diferentes) e acendia o aviso "1 Issue" | `Contador.tsx` só calcula o tempo depois de carregar no navegador |
| 2 | Checkout (convidado) | Nome vazio mostrava só "Não foi possível gerar o Pix" | Modal agora mostra a mensagem do servidor: `Preencha o campo "Seu nome"` |
| 3 | API `POST /api/pedidos` | **Aceitava pedido de casamento que já aconteceu** (a página escondia os presentes, mas a API criava o pedido, 201) | `pedidosController.criar` recusa com "Presente indisponível" (404). Teste automatizado adicionado |
| 4 | Painel `Salvar` (dados do casamento) | Mostrava "Salvo!" mesmo quando o servidor rejeitava | Mostra o erro real (corrigido na rodada anterior e reconfirmado M08/D08) |
| 5 | Texto colado nos campos | `<script>` e HTML eram guardados | Tags são removidas de todos os campos de texto (confirmado em D14) |

---

# PARTE 1 — MOBILE (375×812)

## M01 — Página inicial
- **Passos:** abrir `/`.
- **Esperado:** título, texto de apresentação e botões "Criar minha lista" / "Já tenho conta"; sem rolagem horizontal.
- **Resultado:** ✅ Sem rolagem horizontal, botões levam a `/cadastro` e `/login`, botão "N" do Next.js não aparece mais.
- ![](mobile/01-home.png)

## M02 — Tela de cadastro
- **Passos:** abrir `/cadastro`.
- **Esperado:** formulário completo (e-mail, senha, link, nome do casal, data, local, mensagem, Pix) e aceite da política de privacidade.
- **Resultado:** ✅ Todos os campos visíveis e utilizáveis no celular.
- ⚠️ O navegador de teste preencheu e-mail e senha sozinho (autofill); não é falha do site.
- ![](mobile/02-cadastro.png)

## M03 — Tela de login
- **Passos:** abrir `/login`.
- **Resultado:** ✅ Campos e botão "Entrar" ok.
- ![](mobile/03-login.png)

## M04 — Política de privacidade
- **Passos:** abrir `/privacidade`.
- **Resultado:** ✅ Texto legível, sem estouro de largura.
- ⚠️ O e-mail de contato aparece como `contato@exemplo.com` (valor padrão). É preciso definir `PRIVACY_CONTACT_EMAIL` antes de publicar.
- ![](mobile/04-privacidade.png)

## M05 — Página inexistente (404)
- **Passos:** abrir `/nao-existe-xyz`.
- **Resultado:** ✅ Retorna 404.
- ⚠️ A página 404 é a padrão do Next.js: fundo preto e em inglês ("This page could not be found"), fora do visual do site.
- ![](mobile/05-pagina-404.png)

## M06 — Cadastro com erro (link curto)
- **Passos:** preencher tudo com link `ab` e enviar.
- **Esperado:** mensagem clara em português.
- **Resultado:** ✅ "Link inválido — use apenas letras minúsculas, números e hífen (3 a 50 caracteres)".
- ![](mobile/06-cadastro-erro-link-curto.png)

## M07 — Cadastro válido → painel vazio
- **Passos:** link `carla-e-diego`, enviar.
- **Resultado:** ✅ Conta criada, redireciona para `/admin`, painel sem presentes e sem pedidos.
- ![](mobile/07-admin-vazio.png)

## M08 — Painel: erro de foto (http)
- **Passos:** adicionar presente com foto `http://...`.
- **Resultado:** ✅ Mensagem: "O link da foto precisa começar com https:// (copie o endereço da imagem completo)".
- ⚠️ O erro aparece no **topo** da página; quem está no formulário lá embaixo pode não ver.
- ![](mobile/08-admin-erro-foto-http.png)

## M09 — Painel com presentes
- **Passos:** adicionar "Jogo de panelas" (com foto https) e "Cafeteira" (sem foto).
- **Resultado:** ✅ Os dois aparecem em cartões, sem rolagem horizontal.
- ⚠️ Preços aparecem como `R$ 250.00` (ponto). O padrão brasileiro seria `R$ 250,00`.
- ![](mobile/09-admin-com-presentes.png)

## M10 — Página pública do casal
- **Passos:** abrir `/carla-e-diego`.
- **Resultado:** ✅ Nome, data, contador, mensagem e cartões de presentes; título da aba "Carla e Diego — Lista de Presentes"; sem erros no console (após correção do bug 1).
- ![](mobile/10-pagina-publica-casal.png)

## M11 — Checkout: formulário
- **Passos:** tocar em "Presentear".
- **Resultado:** ✅ Modal com nome do presente, preço, campos "Seu nome" e mensagem.
- ![](mobile/11-checkout-formulario.png)

## M12 — Checkout: nome vazio
- **Passos:** nome só com espaços → "Gerar Pix".
- **Resultado:** 🐞→✅ Agora mostra `Preencha o campo "Seu nome"`.
- ![](mobile/12-checkout-erro-nome-vazio.png)

## M13 — Checkout: QR Code Pix
- **Passos:** nome "Tia Marta", mensagem, "Gerar Pix".
- **Resultado:** ✅ QR Code e botão "Copiar código Pix" (a cópia funciona sem erro).
- ![](mobile/13-checkout-qr-pix.png)

## M14 — Painel: pedido aguardando pagamento
- **Resultado:** ✅ Pedido de "Tia Marta" aparece com status "Aguardando pagamento" e botão "Marcar como pago".
- ![](mobile/14-admin-pedido-aguardando.png)

## M15 — Painel: pedido pago
- **Passos:** "Marcar como pago".
- **Resultado:** ✅ Pedido e presente passam para "Pago".
- ![](mobile/15-admin-pedido-pago.png)

## M16 — Página pública após pagamento
- **Resultado:** ✅ O presente pago some da lista; só a Cafeteira continua.
- ![](mobile/16-pagina-publica-apos-pagamento.png)

## M17 — Editar presente
- **Passos:** "Editar" na Cafeteira, preço 95.5, "Salvar alterações".
- **Resultado:** ✅ Formulário vem preenchido, botões "Salvar alterações"/"Cancelar", novo preço `R$ 95.50` aparece na lista.
- ![](mobile/17-admin-editando-presente.png)

## M18 — Casamento que já aconteceu
- **Passos:** mudar a data para 2024 e abrir a página pública; tentar criar pedido pela API.
- **Resultado:** ✅ Página: "Este casamento já aconteceu, obrigado a todos! 💛".
- 🐞→✅ A API aceitava pedido (201); após a correção responde 404. A data foi restaurada depois.
- ![](mobile/18-pagina-casamento-ja-aconteceu.png)

## M19 — Login com senha errada / logout / acesso sem sessão
- **Passos:** "Sair" → login com senha errada → login correto → abrir `/admin` sem sessão.
- **Resultado:** ✅ "Sair" volta ao `/login`; senha errada mostra "E-mail ou senha incorretos"; login correto vai ao painel; `/admin` sem sessão redireciona ao login sem mostrar dados.
- ![](mobile/19-login-senha-errada.png)

## M20 — Excluir conta
- **Passos:** "Excluir minha conta" → **Cancelar** → conta continua; de novo → **Confirmar**.
- **Resultado:** ✅ Cancelar não apaga nada. Confirmar leva à home; depois disso a API admin dá 401, a página do casal dá 404 e o login da conta dá 401.
- ![](mobile/20-apos-excluir-conta-home.png)

### Verificações extras no mobile
- Sem rolagem horizontal na home, no painel e na página pública (375 px).
- Segurança testada durante o fluxo (mesmas respostas no desktop): JSON quebrado → 400; tipo errado → 400; preço negativo/enorme → 400; foto `javascript:` → 400; ID de outro casamento → 404; rotas `/api/admin/*` sem sessão → 401; `/api/pedidos/{id}` devolve só o status.

---

# PARTE 2 — DESKTOP (1440×900)

## D01 — Página inicial
- **Resultado:** ✅ Layout centralizado, botões funcionam.
- ![](desktop/01-home.png)

## D02 — Tela de cadastro
- **Resultado:** ✅ Formulário centralizado, todos os campos.
- ![](desktop/02-cadastro.png)

## D03 — Tela de login
- **Resultado:** ✅
- ![](desktop/03-login.png)

## D04 — Política de privacidade
- **Resultado:** ✅ Mesma observação do contato `contato@exemplo.com` (M04).
- ![](desktop/04-privacidade.png)

## D05 — Página inexistente (404)
- **Resultado:** ✅ Retorna 404. ⚠️ Mesma página padrão preta em inglês (M05).
- ![](desktop/05-pagina-404.png)

## D06 — Cadastro com erro (link curto)
- **Resultado:** ✅ Mensagem de link inválido em português.
- ![](desktop/06-cadastro-erro-link-curto.png)

## D07 — Cadastro válido → painel vazio
- **Passos:** link digitado como `AB C`.
- **Resultado:** ✅ O sistema normalizou o link para `ab-c` e criou a conta.
- ![](desktop/07-admin-vazio.png)

## D08 — Painel: erro de foto inválida
- **Passos:** foto `ftp://...`.
- **Resultado:** ✅ Mesma mensagem clara sobre `https://`.
- ![](desktop/08-admin-erro-foto-invalida.png)

## D09 — Painel com presentes
- **Passos:** "Aspirador robô" (com foto) e "Liquidificador" (sem foto).
- **Resultado:** ✅ Tabela com miniatura, nome, preço, status e ações; sem rolagem horizontal. ⚠️ Preço com ponto (`R$ 179.90`).
- ![](desktop/09-admin-com-presentes.png)

## D10 — Página pública do casal
- **Resultado:** ✅ Título "Ana e Bruno — Lista de Presentes", contador, mensagem, cartões. ⚠️ Com poucos presentes os cartões ficam alinhados à esquerda em vez de centralizados.
- ![](desktop/10-pagina-publica-casal.png)

## D11 — Checkout: formulário
- **Resultado:** ✅ Modal centralizado.
- ![](desktop/11-checkout-formulario.png)

## D12 — Checkout: nome vazio
- **Resultado:** ✅ `Preencha o campo "Seu nome"`.
- ![](desktop/12-checkout-erro-nome-vazio.png)

## D13 — Checkout: QR Code Pix
- **Passos:** nome "Tio Carlos", mensagem com HTML (`<b>Muita saúde</b>`).
- **Resultado:** ✅ QR Code gerado.
- ![](desktop/13-checkout-qr-pix.png)

## D14 — Painel: pedido aguardando pagamento
- **Resultado:** ✅ Mensagem aparece como `Parabéns aos noivos! Muita saúde`: as tags HTML foram removidas e nada foi executado.
- ![](desktop/14-admin-pedido-aguardando.png)

## D15 — Painel: pedido pago
- **Resultado:** ✅ Status vira "Pago".
- ![](desktop/15-admin-pedido-pago.png)

## D16 — Página pública após pagamento
- **Resultado:** ✅ O presente pago sai da lista.
- ![](desktop/16-pagina-publica-apos-pagamento.png)

## D17 — Editar presente
- **Passos:** Liquidificador, preço 199.
- **Resultado:** ✅ Preço atualizado para 199.
- ![](desktop/17-admin-editando-presente.png)

## D18 — Casamento que já aconteceu
- **Resultado:** ✅ Página "Este casamento já aconteceu…"; pedido pela API é recusado com 404 ("Presente indisponível"). Data restaurada depois.
- ![](desktop/18-pagina-casamento-ja-aconteceu.png)

## D19 — Login com senha errada / logout / login correto
- **Resultado:** ✅ Mesmo comportamento do mobile.
- ![](desktop/19-login-senha-errada.png)

## D20 — Excluir conta
- **Passos:** confirmar exclusão.
- **Resultado:** ✅ Redireciona para a home; API admin 401, página do casal 404, login da conta 401.
- ![](desktop/20-apos-excluir-conta-home.png)

---

# Pendências (não corrigidas, para decidir)

1. **404 padrão do Next.js** (preto, em inglês). Sugestão: página `not-found` em português com o visual do site.
2. **E-mail de contato da privacidade** ainda é `contato@exemplo.com`; definir `PRIVACY_CONTACT_EMAIL`.
3. **Formato de preço** `R$ 250.00` → usar vírgula (`R$ 250,00`).
4. **Erro do painel no topo da página** — aproximar da seção onde o erro aconteceu.
5. **Cartões alinhados à esquerda** na página pública quando há poucos presentes.
6. **Aviso "1 Issue" do modo de desenvolvimento:** vem de uma extensão do navegador que injeta o atributo `wfd-id` nos campos. Não aparece para os usuários e não vem do código do site.
7. **Aviso do Next.js 16:** a convenção `middleware.ts` está descontinuada em favor de `proxy.ts`; funciona hoje, mas convém migrar.
8. **Teste `models/db.test.ts`** falha só enquanto o servidor de desenvolvimento estiver com `lista-presentes.db` aberto (não é falha do código).
9. **Rate limit em memória** vale só para 1 instância do servidor.

## Resultado dos testes automatizados após as correções
196 de 197 passam (a exceção é o item 8).
