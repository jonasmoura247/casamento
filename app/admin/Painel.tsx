// app/admin/Painel.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Presente {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  imagens: string[];
  status: string;
}

interface Pedido {
  id: number;
  presente_id: number;
  nome_convidado: string;
  mensagem: string;
  status: string;
}

interface Casamento {
  id: number;
  slug: string;
  nome_casal: string;
  data_casamento: string;
  local: string;
  mensagem: string;
  pix_key: string;
  pix_nome_recebedor: string;
  pix_cidade: string;
  mostrar_contador: 0 | 1;
}

const STATUS_STYLE: Record<string, string> = {
  disponivel: 'bg-green-50 text-green-700',
  reservado: 'bg-amber-50 text-amber-700',
  pago: 'bg-accent-soft text-accent-dark',
  aguardando_pagamento: 'bg-amber-50 text-amber-700',
  cancelado: 'bg-neutral-100 text-neutral-500',
};

const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  pago: 'Pago',
  aguardando_pagamento: 'Aguardando pagamento',
  cancelado: 'Cancelado',
};

function Selo({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-neutral-100 text-neutral-600'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const FORM_VAZIO = { nome: '', descricao: '', preco: '', fotos: ['', '', '', '', ''] };
const inputClass =
  'border border-border-soft rounded-lg px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow';

function SecaoCasamento() {
  const [casamento, setCasamento] = useState<Casamento | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const [copiado, setCopiado] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/casamento').then((r) => r.json()).then((body) => setCasamento(body.casamento));
  }, []);

  const excluirConta = async () => {
    if (!window.confirm('Isso vai apagar sua conta, sua lista e todos os pedidos recebidos. Essa ação não pode ser desfeita. Continuar?')) {
      return;
    }
    await fetch('/api/admin/conta', { method: 'DELETE' });
    router.push('/');
  };

  if (!casamento) return null;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/admin/casamento', {
      method: 'PATCH',
      body: JSON.stringify({
        nomeCasal: casamento.nome_casal,
        dataCasamento: casamento.data_casamento,
        local: casamento.local,
        mensagem: casamento.mensagem,
        pixKey: casamento.pix_key,
        pixNomeRecebedor: casamento.pix_nome_recebedor,
        pixCidade: casamento.pix_cidade,
        mostrarContador: Boolean(casamento.mostrar_contador),
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setErroSalvar(body.erro ?? 'Não foi possível salvar. Tente novamente.');
      return;
    }
    setErroSalvar('');
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  };

  const linkPublico = `${window.location.origin}/${casamento.slug}`;

  const copiarLink = async () => {
    await navigator.clipboard.writeText(linkPublico);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <>
      <section className="bg-surface border border-border-soft rounded-2xl p-6 shadow-sm">
        <h2 className="font-serif text-xl text-accent-dark mb-4">Sua página de presentes</h2>
        <p className="text-sm text-foreground/70 mb-3 break-all">{linkPublico}</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/${casamento.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            Ver página
          </a>
          <button
            onClick={copiarLink}
            className="border border-border-soft hover:border-accent text-accent-dark rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            {copiado ? 'Link copiado!' : 'Copiar link'}
          </button>
        </div>
      </section>

      <section className="bg-surface border border-border-soft rounded-2xl p-6 shadow-sm">
      <h2 className="font-serif text-xl text-accent-dark mb-4">Dados do casamento</h2>
      <form onSubmit={salvar} className="flex flex-col gap-3 max-w-lg">
        <label className="flex flex-col gap-1 text-sm text-foreground/70">Nome do casal
          <input className={inputClass} value={casamento.nome_casal} onChange={(e) => setCasamento({ ...casamento, nome_casal: e.target.value })} placeholder="Nome do casal" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground/70">Data do casamento
          <input className={inputClass} type="date" value={casamento.data_casamento} onChange={(e) => setCasamento({ ...casamento, data_casamento: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground/70">Local
          <input className={inputClass} value={casamento.local} onChange={(e) => setCasamento({ ...casamento, local: e.target.value })} placeholder="Local" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground/70">Mensagem para os convidados
          <textarea className={inputClass} value={casamento.mensagem} onChange={(e) => setCasamento({ ...casamento, mensagem: e.target.value })} placeholder="Mensagem" rows={3} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground/70">Chave Pix
          <input className={inputClass} value={casamento.pix_key} onChange={(e) => setCasamento({ ...casamento, pix_key: e.target.value })} placeholder="Chave Pix" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground/70">Nome do titular da chave Pix
          <input className={inputClass} value={casamento.pix_nome_recebedor} onChange={(e) => setCasamento({ ...casamento, pix_nome_recebedor: e.target.value })} placeholder="Nome do titular" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground/70">Cidade do titular
          <input className={inputClass} value={casamento.pix_cidade} onChange={(e) => setCasamento({ ...casamento, pix_cidade: e.target.value })} placeholder="Cidade" />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground/70">
          <input type="checkbox" checked={Boolean(casamento.mostrar_contador)} onChange={(e) => setCasamento({ ...casamento, mostrar_contador: e.target.checked ? 1 : 0 })} />
          Mostrar contador regressivo
        </label>
        <button type="submit" className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-2 text-sm font-medium transition-colors self-start">
          {salvo ? 'Salvo!' : 'Salvar'}
        </button>
        {erroSalvar && <p role="alert" className="text-sm text-red-600">{erroSalvar}</p>}
      </form>
      </section>

      <section className="bg-surface border border-red-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-serif text-xl text-red-700 mb-2">Zona de risco</h2>
        <p className="text-sm text-foreground/70 mb-3">
          Exclui sua conta, sua lista de presentes e todos os pedidos recebidos. Não pode ser desfeito.
        </p>
        <button onClick={excluirConta} className="text-red-600 hover:text-red-700 font-medium text-sm border border-red-200 hover:border-red-300 rounded-full px-4 py-2 transition-colors">
          Excluir minha conta
        </button>
      </section>
    </>
  );
}

export default function Painel() {
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const router = useRouter();

  async function carregar() {
    const [prRes, pdRes] = await Promise.all([
      fetch('/api/admin/presentes'),
      fetch('/api/admin/pedidos'),
    ]);
    if (prRes.status === 401 || pdRes.status === 401) {
      router.push('/login');
      return;
    }
    if (!prRes.ok || !pdRes.ok) {
      setErro('Não foi possível carregar os dados.');
      return;
    }
    const [pr, pd] = await Promise.all([prRes.json(), pdRes.json()]);
    setPresentes(pr.presentes);
    setPedidos(pd.pedidos);
  }

  useEffect(() => {
    carregar();
  }, []);

  function editar(p: Presente) {
    setEditandoId(p.id);
    const fotos = [...p.imagens, '', '', '', '', ''].slice(0, 5);
    setForm({ nome: p.nome, descricao: p.descricao, preco: String(p.preco), fotos });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
  }

  async function salvarPresente(e: React.FormEvent) {
    e.preventDefault();
    const corpo = { nome: form.nome, descricao: form.descricao, preco: form.preco, imagens: form.fotos.filter(Boolean) };
    const response = await fetch(
      editandoId ? `/api/admin/presentes/${editandoId}` : '/api/admin/presentes',
      { method: editandoId ? 'PATCH' : 'POST', body: JSON.stringify(corpo) }
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setErro(body.erro ?? (editandoId ? 'Não foi possível salvar o presente.' : 'Não foi possível adicionar o presente.'));
      return;
    }
    setErro('');
    cancelarEdicao();
    carregar();
  }

  async function removerPresenteItem(id: number) {
    const response = await fetch(`/api/admin/presentes/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setErro('Não foi possível remover o presente.');
      return;
    }
    setErro('');
    if (editandoId === id) cancelarEdicao();
    carregar();
  }

  async function marcarPago(id: number) {
    const response = await fetch(`/api/admin/pedidos/${id}/marcar-pago`, { method: 'POST' });
    if (!response.ok) {
      setErro('Não foi possível marcar o pedido como pago.');
      return;
    }
    setErro('');
    carregar();
  }

  async function sair() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8 sm:gap-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="uppercase tracking-widest text-xs text-gold font-medium mb-1">Bastidores</p>
          <h1 className="font-serif text-3xl text-accent-dark">Painel administrativo</h1>
        </div>
        <button onClick={sair} className="text-sm text-foreground/60 hover:text-foreground px-2 py-1">
          Sair
        </button>
      </header>

      {erro && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-2">{erro}</p>
      )}

      <SecaoCasamento />

      <section className="bg-surface border border-border-soft rounded-2xl p-6 shadow-sm min-w-0">
        <h2 className="font-serif text-xl text-accent-dark mb-4">
          {editandoId ? 'Editar presente' : 'Novo presente'}
        </h2>
        <form onSubmit={salvarPresente} className="flex flex-col gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputClass} required />
            <input placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={`${inputClass} flex-1 min-w-[10rem]`} />
            <input placeholder="Preço" type="number" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} className={`${inputClass} w-28`} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {form.fotos.map((url, i) => (
              <input
                key={i}
                placeholder={`URL da foto ${i + 1}`}
                value={url}
                onChange={(e) => {
                  const fotos = [...form.fotos];
                  fotos[i] = e.target.value;
                  setForm({ ...form, fotos });
                }}
                className={inputClass}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-2 text-sm font-medium transition-colors">
              {editandoId ? 'Salvar alterações' : 'Adicionar'}
            </button>
            {editandoId && (
              <button type="button" onClick={cancelarEdicao} className="text-sm text-foreground/60 hover:text-foreground px-2">
                Cancelar
              </button>
            )}
          </div>
        </form>
        <div className="flex flex-col gap-3 sm:hidden">
          {presentes.map((p) => (
            <div key={p.id} className="flex gap-3 border border-border-soft rounded-xl p-3">
              {p.imagens[0] && (
                <Image src={p.imagens[0]} alt="" width={56} height={56} className="w-14 h-14 rounded-md object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.nome}</p>
                <p className="text-foreground/70">R$ {p.preco.toFixed(2)}</p>
                <div className="mt-1 mb-2"><Selo status={p.status} /></div>
                <div className="flex gap-3">
                  <button onClick={() => editar(p)} className="text-accent hover:text-accent-dark font-medium text-sm">Editar</button>
                  <button onClick={() => removerPresenteItem(p.id)} className="text-red-600 hover:text-red-700 font-medium text-sm">Remover</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border-soft text-foreground/50">
                <th className="pb-2 font-medium"></th>
                <th className="pb-2 font-medium">Nome</th>
                <th className="pb-2 font-medium">Preço</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {presentes.map((p) => (
                <tr key={p.id} className="border-b border-border-soft last:border-0">
                  <td className="py-2.5">
                    {p.imagens[0] && (
                      <Image src={p.imagens[0]} alt="" width={40} height={40} className="w-10 h-10 rounded-md object-cover" />
                    )}
                  </td>
                  <td className="py-2.5">{p.nome}</td>
                  <td className="py-2.5">R$ {p.preco.toFixed(2)}</td>
                  <td className="py-2.5"><Selo status={p.status} /></td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => editar(p)} className="text-accent hover:text-accent-dark font-medium mr-3">Editar</button>
                    <button onClick={() => removerPresenteItem(p.id)} className="text-red-600 hover:text-red-700 font-medium">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-surface border border-border-soft rounded-2xl p-6 shadow-sm min-w-0">
        <h2 className="font-serif text-xl text-accent-dark mb-4">Pedidos</h2>
        <div className="flex flex-col gap-3 sm:hidden">
          {pedidos.map((p) => (
            <div key={p.id} className="border border-border-soft rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium truncate">{p.nome_convidado}</p>
                <Selo status={p.status} />
              </div>
              {p.mensagem && <p className="text-foreground/70 mt-1">{p.mensagem}</p>}
              {p.status !== 'pago' && (
                <button onClick={() => marcarPago(p.id)} className="text-accent hover:text-accent-dark font-medium text-sm mt-2">
                  Marcar como pago
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border-soft text-foreground/50">
                <th className="pb-2 font-medium">Convidado</th>
                <th className="pb-2 font-medium">Mensagem</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-b border-border-soft last:border-0">
                  <td className="py-2.5">{p.nome_convidado}</td>
                  <td className="py-2.5 text-foreground/70">{p.mensagem}</td>
                  <td className="py-2.5"><Selo status={p.status} /></td>
                  <td className="py-2.5 text-right">
                    {p.status !== 'pago' && (
                      <button onClick={() => marcarPago(p.id)} className="text-accent hover:text-accent-dark font-medium">Marcar como pago</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
