export const environment = {
  production: false,
  /**
   * Caminho relativo, igual ao de produção.
   *
   * O servidor de desenvolvimento encaminha `/api` para o back-end via
   * apps/frontend/proxy.conf.cjs, e em produção quem encaminha é o nginx do
   * contêiner. Assim a tela nunca conhece a porta do back-end — trocar de
   * 3000 (nx serve backend) para 53001 (docker compose) não exige tocar em
   * código, e o navegador sempre fala com a própria origem, sem CORS.
   */
  apiUrl: '/api',
};
