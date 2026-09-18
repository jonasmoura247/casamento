// app/components/GiftGrid.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import CheckoutModal from './CheckoutModal';

interface Presente {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  imagens: string[];
}

export default function GiftGrid({ presentesIniciais }: { presentesIniciais: Presente[] }) {
  const [presentes, setPresentes] = useState(presentesIniciais);
  const [selecionado, setSelecionado] = useState<Presente | null>(null);

  function removerDaGrade(id: number) {
    setPresentes((atual) => atual.filter((p) => p.id !== id));
  }

  if (presentes.length === 0) {
    return (
      <p className="text-center text-foreground/60 py-16">
        Todos os presentes já foram escolhidos. Muito obrigado pelo carinho! 💛
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-7">
      {presentes.map((presente) => (
        <div
          key={presente.id}
          className="group bg-surface rounded-2xl overflow-hidden flex flex-col border border-border-soft shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div className="relative aspect-square overflow-hidden bg-accent-soft">
            {presente.imagens[0] && (
              <Image
                src={presente.imagens[0]}
                alt={presente.nome}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}
          </div>
          <div className="p-4 flex flex-col gap-1.5 flex-1">
            <h3 className="font-serif text-lg text-accent-dark leading-snug">
              {presente.nome}
            </h3>
            <p className="text-sm text-foreground/60 flex-1 leading-relaxed">
              {presente.descricao}
            </p>
            <div className="flex items-center justify-between pt-2">
              <p className="font-semibold text-foreground">
                R$ {presente.preco.toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => setSelecionado(presente)}
              className="mt-2 bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Presentear
            </button>
          </div>
        </div>
      ))}

      {selecionado && (
        <CheckoutModal
          presenteId={selecionado.id}
          nome={selecionado.nome}
          preco={selecionado.preco}
          onFechar={() => setSelecionado(null)}
          onPago={() => removerDaGrade(selecionado.id)}
        />
      )}
    </div>
  );
}
