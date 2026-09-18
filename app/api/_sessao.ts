// app/api/_sessao.ts
import { cookies } from 'next/headers';
import { resolverContaIdPorToken } from '@/models/sessoes';
import { buscarPorContaId } from '@/models/casamentos';

export async function resolverCasamentoIdDaSessao(): Promise<number | undefined> {
  const token = (await cookies()).get('sessao')?.value;
  if (!token) return undefined;
  const contaId = resolverContaIdPorToken(token);
  if (!contaId) return undefined;
  return buscarPorContaId(contaId)?.id;
}
