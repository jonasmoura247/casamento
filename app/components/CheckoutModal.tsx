// app/components/CheckoutModal.tsx
'use client';

import { useEffect, useState } from 'react';

interface Props {
  presenteId: number;
  nome: string;
  preco: number;
  onFechar: () => void;
  onPago: () => void;
}

type Etapa = 'formulario' | 'aguardando' | 'confirmado';

export default function CheckoutModal({ presenteId, nome, preco, onFechar, onPago }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('formulario');
  const [nomeConvidado, setNomeConvidado] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copiaCola, setCopiaCola] = useState('');
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  async function confirmarReserva(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify({ presenteId, nomeConvidado, mensagem }),
      });
      if (!response.ok) {
        setErro('Não foi possível gerar o Pix. Tente novamente.');
        return;
      }
      const body = await response.json();
      setPedidoId(body.pedido.id);
      setCopiaCola(body.pedido.pix_copia_cola);
      setQrCodeDataUrl(body.pedido.pix_qr_code_data_url);
      setErro('');
      setEtapa('aguardando');
    } catch {
      setErro('Não foi possível gerar o Pix. Tente novamente.');
    }
  }

  useEffect(() => {
    if (etapa !== 'aguardando' || !pedidoId) return;
    const intervalo = setInterval(async () => {
      try {
        const response = await fetch(`/api/pedidos/${pedidoId}`);
        const body = await response.json();
        if (body.pedido.status === 'pago') {
          setEtapa('confirmado');
          onPago();
        }
      } catch {
        // falha temporária no polling: ignora e tenta novamente no próximo intervalo
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [etapa, pedidoId, onPago]);

  function copiarCodigo() {
    navigator.clipboard.writeText(copiaCola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 bg-accent-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onFechar}
    >
      <div
        className="bg-surface rounded-3xl p-7 max-w-sm w-full shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-foreground/50 hover:bg-accent-soft hover:text-accent-dark transition-colors"
        >
          ×
        </button>

        <p className="uppercase tracking-widest text-xs text-gold font-medium mb-1">
          Presentear
        </p>
        <h2 className="font-serif text-2xl text-accent-dark mb-1 pr-6">{nome}</h2>
        <p className="text-foreground/60 font-medium mb-5">R$ {preco.toFixed(2)}</p>

        {etapa === 'formulario' && (
          <form onSubmit={confirmarReserva} className="flex flex-col gap-3">
            <input
              required
              placeholder="Seu nome"
              value={nomeConvidado}
              onChange={(e) => setNomeConvidado(e.target.value)}
              className="border border-border-soft rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow"
            />
            <textarea
              placeholder="Mensagem para os noivos (opcional)"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={3}
              className="border border-border-soft rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow resize-none"
            />
            {erro && <p className="text-red-600 text-sm">{erro}</p>}
            <button
              type="submit"
              className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-3 font-medium transition-colors mt-1"
            >
              Gerar Pix
            </button>
          </form>
        )}

        {etapa === 'aguardando' && (
          <div className="flex flex-col items-center gap-4">
            {qrCodeDataUrl && (
              <div className="p-3 bg-white rounded-2xl border border-border-soft">
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code Pix"
                  className="w-44 h-44 object-contain"
                />
              </div>
            )}
            <button
              onClick={copiarCodigo}
              className="text-sm font-medium text-accent hover:text-accent-dark transition-colors underline underline-offset-4 decoration-accent-soft"
            >
              {copiado ? 'Código copiado!' : 'Copiar código Pix'}
            </button>
            <p className="text-sm text-foreground/60 text-center leading-relaxed">
              Pague com o app do seu banco. Os noivos confirmam o recebimento
              manualmente assim que o Pix cair na conta — pode levar algumas horas.
            </p>
          </div>
        )}

        {etapa === 'confirmado' && (
          <div className="text-center py-4">
            <p className="text-3xl mb-3">💛</p>
            <p className="text-accent-dark font-serif text-xl">
              Presente confirmado, muito obrigado!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
