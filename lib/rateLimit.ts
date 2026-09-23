// lib/rateLimit.ts
// ponytail: contador em memória por instância — se o app escalar para múltiplos
// processos, trocar por um contador compartilhado (Redis, etc).
const contagens = new Map<string, { restantes: number; resetaEm: number }>();

const MAX_CHAVES = 10_000;

export function excedeuLimite(chave: string, max: number, janelaMs: number): boolean {
  const agora = Date.now();
  if (contagens.size > MAX_CHAVES) {
    for (const [k, v] of contagens) if (v.resetaEm <= agora) contagens.delete(k);
  }
  const atual = contagens.get(chave);
  if (!atual || atual.resetaEm <= agora) {
    contagens.set(chave, { restantes: max - 1, resetaEm: agora + janelaMs });
    return false;
  }
  if (atual.restantes <= 0) return true;
  atual.restantes -= 1;
  return false;
}

export function obterIp(request: Request): string {
  // O último item é o que o nosso proxy acrescentou; o primeiro o cliente forja à vontade.
  return request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'desconhecido';
}
