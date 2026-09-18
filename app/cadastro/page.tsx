// app/cadastro/page.tsx
import CadastroForm from './CadastroForm';

// CSP usa nonce por requisição (ver middleware.ts) — precisa renderizar
// dinamicamente. 'force-dynamic' só funciona em Server Component, por isso
// o formulário fica num arquivo 'use client' à parte (CadastroForm.tsx).
export const dynamic = 'force-dynamic';

export default function CadastroPage() {
  return <CadastroForm />;
}
