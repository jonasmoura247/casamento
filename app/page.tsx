// app/page.tsx
import Link from 'next/link';

// CSP usa nonce por requisição (ver middleware.ts) — a pagina precisa ser
// renderizada dinamicamente, senao o build fixaria um <script> sem nonce.
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 text-center">
      <p className="uppercase tracking-[0.3em] text-xs sm:text-sm text-gold font-medium mb-6">
        Listas de presentes de casamento
      </p>
      <h1 className="font-serif italic text-5xl sm:text-6xl text-accent-dark leading-tight mb-6">
        Sua lista, seu link, seu Pix
      </h1>
      <p className="text-foreground/80 max-w-xl mx-auto leading-relaxed mb-10">
        Crie sua lista de presentes em minutos e receba um link só seu. O
        dinheiro dos presentes cai direto na sua conta via Pix — sem
        intermediário, sem taxa.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link
          href="/cadastro"
          className="bg-accent hover:bg-accent-dark text-white rounded-full px-6 py-3 font-medium transition-colors"
        >
          Criar minha lista
        </Link>
        <Link
          href="/login"
          className="text-accent hover:text-accent-dark font-medium px-4 py-3"
        >
          Já tenho conta
        </Link>
      </div>
    </main>
  );
}
