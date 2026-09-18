// app/cadastro/CadastroForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const FORM_VAZIO = {
  email: '', senha: '', slug: '', nomeCasal: '', dataCasamento: '',
  local: '', mensagem: '', pixKey: '', pixNomeRecebedor: '', pixCidade: '',
};

export default function CadastroForm() {
  const router = useRouter();
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');

  function campo(nome: keyof typeof FORM_VAZIO) {
    return {
      value: form[nome],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm({ ...form, [nome]: e.target.value }),
    };
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch('/api/cadastro', { method: 'POST', body: JSON.stringify(form) });
    if (!response.ok) {
      const body = await response.json();
      setErro(body.erro ?? 'Não foi possível criar a conta.');
      return;
    }
    router.push('/admin');
  }

  const inputClass =
    'border border-border-soft rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow';

  return (
    <main className="max-w-lg mx-auto px-6 py-16">
      <h1 className="font-serif text-3xl text-accent-dark mb-6">Criar minha lista</h1>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <input placeholder="Seu e-mail" type="email" required {...campo('email')} className={inputClass} />
        <input placeholder="Senha" type="password" required minLength={8} {...campo('senha')} className={inputClass} />
        <input placeholder="Link desejado (ex: jonasenatalia)" required {...campo('slug')} className={inputClass} />
        <input placeholder="Nome do casal" required {...campo('nomeCasal')} className={inputClass} />
        <input placeholder="Data do casamento" type="date" required {...campo('dataCasamento')} className={inputClass} />
        <input placeholder="Local (opcional)" {...campo('local')} className={inputClass} />
        <textarea placeholder="Mensagem para os convidados (opcional)" rows={3} {...campo('mensagem')} className={inputClass} />
        <input placeholder="Sua chave Pix" required {...campo('pixKey')} className={inputClass} />
        <input placeholder="Nome do titular da chave Pix" required {...campo('pixNomeRecebedor')} className={inputClass} />
        <input placeholder="Cidade do titular" required {...campo('pixCidade')} className={inputClass} />
        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        <button type="submit" className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-3 font-medium transition-colors mt-2">
          Criar conta e lista
        </button>
        <p className="text-center text-sm text-foreground/60">
          Já tem conta?{' '}
          <Link href="/login" className="text-accent hover:text-accent-dark font-medium">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
