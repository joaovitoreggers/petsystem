import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../app/app.module';
import { UsersService } from '../app/users/users.service';

/**
 * Reconhecimento facial "facilita acesso de quem já tem conta": o rosto em
 * si é casado no navegador (face-api.js, fora do escopo do back-end); o
 * que este teste cobre é a metade que o back-end sustenta — o token de
 * "lembrar este aparelho" (nunca a senha) que o front-end troca por uma
 * sessão de verdade depois que o rosto casou localmente. Ver
 * AuthService.issueDeviceToken/loginWithDeviceToken/revokeDeviceToken.
 */
describe('Device auth — "lembrar este aparelho" (integration)', () => {
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
      'TRUNCATE TABLE device_credentials, team_members, work_permits, employees, access_events, users, branches, company_groups RESTART IDENTITY CASCADE',
    );

    const usersService = moduleRef.get(UsersService);
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

  describe('emitir um token de aparelho', () => {
    it('rejects without a real session', async () => {
      await request(app.getHttpServer()).post('/api/auth/device-token').expect(401);
    });

    it('issues an opaque token (id.secret) for the authenticated user', async () => {
      const { accessToken } = await login(email('platform-admin'));

      const res = await request(app.getHttpServer())
        .post('/api/auth/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body.deviceToken).toMatch(/^[0-9a-f-]{36}\.\S+$/);
    });
  });

  describe('device-login — trocar o token por uma sessão real', () => {
    it('rejects a malformed token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/device-login')
        .send({ deviceToken: 'not-a-valid-token' })
        .expect(401);
    });

    it('rejects a token that was never issued', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/device-login')
        .send({ deviceToken: '00000000-0000-0000-0000-000000000000.made-up-secret' })
        .expect(401);
    });

    it('issues a fresh real session — same shape and claims as a normal login', async () => {
      const { accessToken } = await login(email('platform-admin'));
      const issueRes = await request(app.getHttpServer())
        .post('/api/auth/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const deviceLoginRes = await request(app.getHttpServer())
        .post('/api/auth/device-login')
        .send({ deviceToken: issueRes.body.deviceToken })
        .expect(200);

      expect(deviceLoginRes.body.accessToken).toBeTruthy();
      expect(deviceLoginRes.body.user.role).toBe('platform-admin');

      // A sessão devolvida é de verdade: dá pra usá-la em qualquer rota
      // protegida normalmente, como qualquer outro JWT emitido por login.
      await request(app.getHttpServer())
        .get('/api/company-groups')
        .set('Authorization', `Bearer ${deviceLoginRes.body.accessToken}`)
        .expect(200);
    });

    it('lets the same device token be used more than once (stays remembered until logout)', async () => {
      const { accessToken } = await login(email('platform-admin'));
      const issueRes = await request(app.getHttpServer())
        .post('/api/auth/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/device-login')
        .send({ deviceToken: issueRes.body.deviceToken })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/device-login')
        .send({ deviceToken: issueRes.body.deviceToken })
        .expect(200);
    });
  });

  describe('revogar (logout)', () => {
    it('rejects without a real session', async () => {
      await request(app.getHttpServer())
        .delete('/api/auth/device-token')
        .send({ deviceToken: 'whatever.whatever' })
        .expect(401);
    });

    it('makes the token unusable for future device-login calls once revoked', async () => {
      const { accessToken } = await login(email('platform-admin'));
      const issueRes = await request(app.getHttpServer())
        .post('/api/auth/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
      const deviceToken = issueRes.body.deviceToken;

      await request(app.getHttpServer())
        .delete('/api/auth/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deviceToken })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/auth/device-login')
        .send({ deviceToken })
        .expect(401);
    });

    it("does not let one user revoke another user's device token", async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${(await login(email('platform-admin'))).accessToken}`)
        .send({
          name: 'Outro Usuário',
          email: email('other-user'),
          password: 'senha123',
          role: 'platform-admin',
        })
        .expect(201);

      const ownerToken = (await login(email('platform-admin'))).accessToken;
      const issueRes = await request(app.getHttpServer())
        .post('/api/auth/device-token')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);
      const deviceToken = issueRes.body.deviceToken;

      const otherUserToken = (await login(email('other-user'))).accessToken;
      // "Sucesso" silencioso de propósito (204) — só não revoga nada, pra
      // não vazar se o token pertence a outra conta. O token continua
      // funcionando depois.
      await request(app.getHttpServer())
        .delete('/api/auth/device-token')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ deviceToken })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/auth/device-login')
        .send({ deviceToken })
        .expect(200);
    });
  });
});
