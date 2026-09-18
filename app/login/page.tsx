// app/login/page.tsx
import LoginForm from './LoginForm';

// CSP usa nonce por requisição (ver middleware.ts) — precisa renderizar
// dinamicamente. 'force-dynamic' só funciona em Server Component, por isso
// o formulário fica num arquivo 'use client' à parte (LoginForm.tsx).
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <LoginForm />;
}
