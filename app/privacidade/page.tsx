// app/privacidade/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
};

const CONTATO = process.env.PRIVACY_CONTACT_EMAIL ?? 'contato@exemplo.com';

export default function PaginaPrivacidade() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 flex flex-col gap-6 text-foreground/80 leading-relaxed">
      <h1 className="font-serif text-3xl text-accent-dark mb-2">Política de Privacidade</h1>

      <section>
        <h2 className="font-serif text-xl text-accent-dark mb-2">Quem trata seus dados</h2>
        <p>
          Cada lista de presentes (<code>/&lt;link&gt;</code>) é administrada pelo casal que a
          criou em <code>/cadastro</code> — é o casal quem decide o que fazer com os dados
          coletados na própria lista (controlador). A infraestrutura do site é operada pelo
          responsável técnico do produto.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl text-accent-dark mb-2">Quais dados coletamos e por quê</h2>
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>
            <strong>Do casal que cria a lista:</strong> e-mail e senha (guardada apenas como
            hash, nunca em texto puro), nome do casal, data e local do casamento, mensagem aos
            convidados, e os dados da chave Pix (chave, nome do titular, cidade) — necessários
            para gerar o QR Code de pagamento.
          </li>
          <li>
            <strong>De quem presenteia:</strong> nome e uma mensagem opcional, informados ao
            reservar um presente, sem necessidade de criar conta — usados apenas para o casal
            saber quem presenteou e poder agradecer.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl text-accent-dark mb-2">Base legal</h2>
        <p>
          Todo o tratamento é feito para viabilizar a execução do serviço que você pediu —
          gerar a lista de presentes e o pagamento via Pix (execução de contrato, art. 7º, V da
          LGPD). Nenhum dado é usado para finalidade diferente dessa, como publicidade ou venda
          a terceiros.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl text-accent-dark mb-2">Por quanto tempo guardamos</h2>
        <p>
          Os dados de quem presenteia (nome e mensagem) são removidos automaticamente 90 dias
          depois que a lista do casamento expira. Os dados do casal (conta, lista, Pix) ficam
          guardados enquanto a conta existir — o casal pode excluir a própria conta a qualquer
          momento em <code>/admin</code>, o que apaga tudo (lista, presentes e pedidos
          recebidos) imediatamente.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl text-accent-dark mb-2">Seus direitos</h2>
        <p>
          Você pode pedir a qualquer momento confirmação, acesso, correção ou eliminação dos
          seus dados, nos termos do art. 18 da LGPD. Para exercer esse direito, ou tirar
          qualquer dúvida sobre como seus dados são tratados, escreva para{' '}
          <a href={`mailto:${CONTATO}`} className="text-accent hover:text-accent-dark underline">
            {CONTATO}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl text-accent-dark mb-2">Encarregado</h2>
        <p>
          Dúvidas ou reclamações sobre o tratamento de dados pessoais neste site podem ser
          enviadas ao mesmo contato acima:{' '}
          <a href={`mailto:${CONTATO}`} className="text-accent hover:text-accent-dark underline">
            {CONTATO}
          </a>
          .
        </p>
      </section>
    </main>
  );
}
