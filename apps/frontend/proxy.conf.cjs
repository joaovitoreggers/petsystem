/**
 * Proxy do servidor de desenvolvimento do Angular.
 *
 * Em produção o nginx do contêiner já encaminha `/api` para o back-end
 * (ver apps/frontend/nginx.conf), e por isso `environment.prod.ts` usa o
 * caminho relativo `/api`. Sem este proxy, o modo de desenvolvimento era o
 * único lugar onde o endereço da API ficava escrito na mão — e quebrava
 * assim que o back-end subia numa porta diferente (3000 rodando direto,
 * 53001 pelo docker compose).
 *
 * Com o proxy, a tela fala sempre com a própria origem, igual em produção,
 * e quem muda de porta muda só a variável de ambiente:
 *
 *   API_TARGET=http://localhost:53001 npx nx serve frontend
 */
const target = process.env.API_TARGET || 'http://localhost:3000';

module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    // Sem rede, o proxy responde erro em vez de derrubar o servidor de
    // desenvolvimento — a tela trata a queda e segue com os dados locais.
    logLevel: 'warn',
  },
};
