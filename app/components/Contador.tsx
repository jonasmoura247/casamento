// app/components/Contador.tsx
'use client';

import { useEffect, useState } from 'react';

function calcularRestante(dataAlvo: string) {
  const diffMs = new Date(`${dataAlvo}T00:00:00`).getTime() - Date.now();
  const total = Math.max(0, diffMs);
  return {
    dias: Math.floor(total / 86_400_000),
    horas: Math.floor((total % 86_400_000) / 3_600_000),
    minutos: Math.floor((total % 3_600_000) / 60_000),
    segundos: Math.floor((total % 60_000) / 1000),
  };
}

export default function Contador({ dataCasamento }: { dataCasamento: string }) {
  const [restante, setRestante] = useState(() => calcularRestante(dataCasamento));

  useEffect(() => {
    const intervalo = setInterval(() => setRestante(calcularRestante(dataCasamento)), 1000);
    return () => clearInterval(intervalo);
  }, [dataCasamento]);

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 my-6">
      {(['dias', 'horas', 'minutos', 'segundos'] as const).map((unidade) => (
        <div key={unidade} className="text-center">
          <p className="font-serif text-3xl sm:text-4xl text-accent-dark">{restante[unidade]}</p>
          <p className="text-xs uppercase tracking-widest text-foreground/50">{unidade}</p>
        </div>
      ))}
    </div>
  );
}
