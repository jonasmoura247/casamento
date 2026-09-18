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
    throw new Error('Link inválido — use apenas letras minúsculas, números e hífen (3 a 50 caracteres)');
  }
  if (buscarContaPorEmail(dados.email)) {
    throw new Error('E-mail já cadastrado');
  }

  let conta;
  try {
    conta = criarConta({ email: dados.email, senha: dados.senha });
  } catch {
    throw new Error('E-mail já cadastrado');
  }

  let casamento;
  try {
    casamento = criarCasamento({ contaId: conta.id, ...dados, slug });
  } catch {
    throw new Error('Esse link já está em uso, escolha outro');
  }

  const token = criarSessao(conta.id);
  return { token, casamento };
}

export function login(dados: { email: string; senha: string }): { token: string } {
  const conta = buscarContaPorEmail(dados.email);
  if (!conta || !verificarSenha(conta.senha_hash, dados.senha)) {
    throw new Error('E-mail ou senha incorretos');
  }
  return { token: criarSessao(conta.id) };
}

export function logout(token: string): void {
  apagarSessao(token);
}
