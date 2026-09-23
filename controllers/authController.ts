// controllers/authController.ts
import { criarConta, buscarContaPorEmail, verificarSenha, removerConta } from '../models/contas';
import { criarCasamento, slugValido, normalizarSlug, removerCasamento, type Casamento } from '../models/casamentos';
import { criarSessao, apagarSessao, apagarSessoesDaConta } from '../models/sessoes';
import { removerPedidosDoCasamento } from '../models/pedidos';
import { removerTodosDoCasamento } from '../models/presentes';
import { ErroValidacao, texto, dataIso } from '../lib/validacao';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENHA_MIN_LENGTH = 8;
const SENHA_MAX_LENGTH = 128;

// Hash descartável: login com e-mail inexistente gasta o mesmo tempo de scrypt (evita enumeração por timing).
const HASH_FALSO = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

export function cadastrar(entrada: Record<string, unknown>): { token: string; casamento: Casamento } {
  const slug = normalizarSlug(texto(entrada.slug, 'link', 50));
  if (!slugValido(slug)) {
    throw new ErroValidacao('Link inválido — use apenas letras minúsculas, números e hífen (3 a 50 caracteres)');
  }
  const email = texto(entrada.email, 'e-mail', 254).toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new ErroValidacao('E-mail inválido');
  }
  const senha = entrada.senha;
  if (typeof senha !== 'string' || senha.length < SENHA_MIN_LENGTH) {
    throw new ErroValidacao(`Senha deve ter pelo menos ${SENHA_MIN_LENGTH} caracteres`);
  }
  if (senha.length > SENHA_MAX_LENGTH) {
    throw new ErroValidacao(`Senha deve ter no máximo ${SENHA_MAX_LENGTH} caracteres`);
  }
  const dados = {
    nomeCasal: texto(entrada.nomeCasal, 'nome do casal', 100, { obrigatorio: true }),
    dataCasamento: dataIso(entrada.dataCasamento, 'data do casamento'),
    local: texto(entrada.local, 'local', 200),
    mensagem: texto(entrada.mensagem, 'mensagem', 500),
    pixKey: texto(entrada.pixKey, 'chave Pix', 77, { obrigatorio: true }),
    pixNomeRecebedor: texto(entrada.pixNomeRecebedor, 'nome do recebedor', 25, { obrigatorio: true }),
    pixCidade: texto(entrada.pixCidade, 'cidade', 15, { obrigatorio: true }),
  };
  if (buscarContaPorEmail(email)) {
    throw new ErroValidacao('E-mail já cadastrado');
  }

  let conta;
  try {
    conta = criarConta({ email, senha });
  } catch {
    throw new ErroValidacao('E-mail já cadastrado');
  }

  let casamento;
  try {
    casamento = criarCasamento({ contaId: conta.id, ...dados, slug });
  } catch {
    throw new ErroValidacao('Esse link já está em uso, escolha outro');
  }

  const token = criarSessao(conta.id);
  return { token, casamento };
}

export function login(dados: { email: unknown; senha: unknown }): { token: string } {
  const email = typeof dados.email === 'string' ? dados.email.trim().toLowerCase() : '';
  const senha = typeof dados.senha === 'string' && dados.senha.length <= SENHA_MAX_LENGTH ? dados.senha : '';
  const conta = buscarContaPorEmail(email);
  const senhaOk = verificarSenha(conta?.senha_hash ?? HASH_FALSO, senha);
  if (!conta || !senhaOk) {
    throw new ErroValidacao('E-mail ou senha incorretos');
  }
  return { token: criarSessao(conta.id) };
}

export function logout(token: string): void {
  apagarSessao(token);
}

// LGPD art. 18 VI: exclusao de conta em cascata, a pedido do titular.
export function excluirConta(contaId: number, casamentoId: number): void {
  removerPedidosDoCasamento(casamentoId);
  removerTodosDoCasamento(casamentoId);
  removerCasamento(casamentoId);
  apagarSessoesDaConta(contaId);
  removerConta(contaId);
}
