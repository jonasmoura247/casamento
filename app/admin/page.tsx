// app/admin/page.tsx
import Painel from './Painel';

// CSP usa nonce por requisição (ver middleware.ts) — precisa renderizar
// dinamicamente. 'force-dynamic' só funciona em Server Component, por isso
// o painel fica num arquivo 'use client' à parte (Painel.tsx).
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return <Painel />;
}
