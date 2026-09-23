// app/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { obterEstadoPublico } from '@/controllers/casamentosController';
import { listarDisponiveis } from '@/models/presentes';
import { expirarPedidosAntigos } from '@/models/pedidos';
import GiftGrid from '../components/GiftGrid';
import Contador from '../components/Contador';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const estado = obterEstadoPublico((await params).slug);
  return estado ? { title: `${estado.casamento.nome_casal} — Lista de Presentes` } : {};
}

export default async function PaginaCasamento({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const estado = obterEstadoPublico(slug);
  if (!estado) notFound();

  const { casamento, expirado } = estado;

  const dataFormatada = new Date(`${casamento.data_casamento}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  if (expirado) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif italic text-4xl text-accent-dark mb-4">{casamento.nome_casal}</h1>
        <p className="text-foreground/70">Este casamento já aconteceu, obrigado a todos! 💛</p>
      </main>
    );
  }

  expirarPedidosAntigos();
  const presentes = listarDisponiveis(casamento.id);

  return (
    <main>
      <header className="relative overflow-hidden border-b border-border-soft">
        <div className="max-w-4xl mx-auto px-6 py-20 sm:py-28 text-center">
          <p className="uppercase tracking-[0.3em] text-xs sm:text-sm text-gold font-medium mb-6">
            Lista de presentes
          </p>
          <h1 className="font-serif italic text-5xl sm:text-7xl text-accent-dark leading-tight">
            {casamento.nome_casal}
          </h1>
          <div className="flex items-center justify-center gap-3 my-6">
            <span className="h-px w-10 bg-gold/60" />
            <span className="text-gold text-lg">❦</span>
            <span className="h-px w-10 bg-gold/60" />
          </div>
          <p className="text-foreground/70 tracking-wide">{dataFormatada}</p>
          {Boolean(casamento.mostrar_contador) && <Contador dataCasamento={casamento.data_casamento} />}
          {casamento.mensagem && (
            <p className="mt-6 text-foreground/80 max-w-xl mx-auto leading-relaxed">{casamento.mensagem}</p>
          )}
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <GiftGrid presentesIniciais={presentes} />
      </section>
    </main>
  );
}
