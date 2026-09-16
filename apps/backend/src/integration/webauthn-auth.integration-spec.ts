import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../app/app.module';

/**
 * A cerimônia criptográfica completa (assinar um desafio de verdade) só dá
 * para testar com um autenticador real ou virtual — ver
 * e2e/biometria-nativa.spec.ts, que usa o autenticador virtual do
 * Chromium via CDP para exercitar o fluxo inteiro (front-end + back-end).
 * Aqui, o que cabe testar sem isso: as rotas exigem sessão real onde
 * devem, as rotas públicas respondem sem uma, e uma cerimônia inválida
 * (desafio inexistente, credencial desconhecida) é recusada sem derrubar
 * o servidor.
 */
describe('WebAuthn auth — biometria nativa do aparelho (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const uniqueSuffix = Date.now();
  const email = (label: string) => `${label}-${uniqueSuffix}@petsystem.local`;

  async function login(emailAddr: string, password = 'senha123') {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emailAddr, password })
      .expect(200);
    return res.body as { accessToken: string; user: Record<string, unknown> };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleRef.get(DataSource);
    await dataSource.query(
      'TRUNCATE TABLE webauthn_credentials, team_members, work_permits, employees, access_events, users, branches, company_groups RESTART IDENTITY CASCADE',
    );

    const usersModule = await import('../app/users/users.service');
    const usersService = moduleRef.get(usersModule.UsersService);
    await usersService.create({
      name: 'Root Platform',
      email: email('platform-admin'),
      password: 'senha123',
      role: 'platform-admin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('cadastrar uma passkey', () => {
    it('rejects without a real session', async () => {
      await request(app.getHttpServer()).post('/api/auth/webauthn/register/options').expect(401);
    });

    it('returns creation options scoped to a platform authenticator, tied to the logged-in user', async () => {
      const { accessToken } = await login(email('platform-admin'));

      const res = await request(app.getHttpServer())
        .post('/api/auth/webauthn/register/options')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.challenge).toBeTruthy();
      expect(res.body.authenticatorSelection.authenticatorAttachment).toBe('platform');
      expect(res.body.authenticatorSelection.residentKey).toBe('required');
      expect(res.body.user.name).toBe(email('platform-admin'));
    });

    it('rejects a verify call without a real session', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/webauthn/register/verify')
        .send({ id: 'whatever' })
        .expect(401);
    });

    it('rejects a fabricated attestation response instead of crashing', async () => {
      const { accessToken } = await login(email('platform-admin'));
      await request(app.getHttpServer())
        .post('/api/auth/webauthn/register/options')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/webauthn/register/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ id: 'not-a-real-credential', rawId: 'x', type: 'public-key', response: {} })
        .expect(500);
    });
  });

  describe('login por biometria — trocar uma cerimônia assinada por uma sessão real', () => {
    it('issues authentication options publicly, without any session', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/webauthn/login/options')
        .expect(200);

      expect(res.body.challengeId).toBeTruthy();
      expect(res.body.options.challenge).toBeTruthy();
      // Discoverable: nunca restringe de antemão quais credenciais servem —
      // é o autenticador da plataforma quem escolhe, não o servidor.
      expect(res.body.options.allowCredentials ?? []).toHaveLength(0);
    });

    it('rejects an unknown challengeId', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/webauthn/login/verify')
        .send({ challengeId: 'made-up-challenge-id', response: { id: 'whatever' } })
        .expect(401);
    });

    it('rejects a challengeId whose credential was never registered', async () => {
      const optionsRes = await request(app.getHttpServer())
        .post('/api/auth/webauthn/login/options')
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/webauthn/login/verify')
        .send({
          challengeId: optionsRes.body.challengeId,
          response: { id: 'never-registered-credential-id' },
        })
        .expect(401);
    });
  });

  describe('esquecer a biometria deste aparelho', () => {
    it('rejects without a real session', async () => {
      await request(app.getHttpServer())
        .delete('/api/auth/webauthn/credentials/whatever')
        .expect(401);
    });

    it('is a silent no-op for a credential id that does not exist — never leaks which ids are real', async () => {
      const { accessToken } = await login(email('platform-admin'));

      await request(app.getHttpServer())
        .delete('/api/auth/webauthn/credentials/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });
  });
});
