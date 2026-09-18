// app/login/LoginForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    if (!response.ok) {
      setErro('E-mail ou senha incorretos');
      return;
    }
    router.push('/admin');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={enviar}
        className="max-w-sm w-full flex flex-col gap-3 bg-surface border border-border-soft rounded-2xl p-8 shadow-sm"
      >
        <h1 className="font-serif text-2xl text-accent-dark mb-2">Entrar</h1>
        <input
          type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)}
          className="border border-border-soft rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow"
        />
        <input
          type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)}
          className="border border-border-soft rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-shadow"
        />
        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        <button type="submit" className="bg-accent hover:bg-accent-dark text-white rounded-full px-4 py-2.5 font-medium transition-colors mt-1">
          Entrar
        </button>
        <p className="text-center text-sm text-foreground/60">
          Ainda não tem conta?{' '}
          <Link href="/cadastro" className="text-accent hover:text-accent-dark font-medium">
            Criar minha lista
          </Link>
        </p>
      </form>
    </main>
  );
}
