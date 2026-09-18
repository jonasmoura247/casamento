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
