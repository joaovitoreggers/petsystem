import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../app/app.module';
import { UsersService } from '../app/users/users.service';

/**
 * Teste de integração de verdade: sobe o AppModule inteiro (guards,
 * controllers, services, repositórios) contra um Postgres real e dedicado
 * (ver jest.integration.config.cts / setup-test-database.ts), e bate nas
 * rotas por HTTP via supertest — exatamente como a verificação manual feita
 * por curl durante o desenvolvimento da multi-tenancy, só que automatizada
 * e repetível.
 *
 * Roda com `npm run backend:test:integration` (precisa do Postgres do
 * docker compose de pé em localhost:55432 — `docker compose up -d db`).
 */
describe('Multi-tenancy (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let platformAdminToken: string;

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
    // Banco de teste dedicado (petsystem_test) — zera de propósito para
    // cada execução ser determinística, independente do que sobrou de uma
    // rodada anterior.
    await dataSource.query(
      'TRUNCATE TABLE team_members, work_permits, users, branches, company_groups RESTART IDENTITY CASCADE',
    );

    const usersService = moduleRef.get(UsersService);
    await usersService.create({
      name: 'Root Platform',
      email: email('platform-admin'),
      password: 'senha123',
      role: 'platform-admin',
    });

    const loginResult = await login(email('platform-admin'));
    platformAdminToken = loginResult.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('autenticação e guards', () => {
    it('rejects login with a wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: email('platform-admin'), password: 'senha-errada' })
        .expect(401);
    });

    it('issues a JWT whose claims match the authenticated user (platform-admin has no group)', async () => {
      const result = await login(email('platform-admin'));
      expect(result.user).toMatchObject({ role: 'platform-admin', companyGroupId: null, branchId: null });
    });

    it('rejects GET /work-permits without a token', async () => {
      await request(app.getHttpServer()).get('/api/work-permits').expect(401);
    });

    it('rejects GET /team-members without a token', async () => {
      await request(app.getHttpServer()).get('/api/team-members').expect(401);
    });

    it('rejects GET /company-groups without a token', async () => {
      await request(app.getHttpServer()).get('/api/company-groups').expect(401);
    });

    it('rejects a non-platform-admin trying to create a company group', async () => {
      const groupRes = await request(app.getHttpServer())
        .post('/api/company-groups')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: `Guard Test Group ${uniqueSuffix}` })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          name: 'Mero Tecnico',
          email: email('guard-tecnico'),
          password: 'senha123',
          role: 'tecnico',
          companyGroupId: groupRes.body.id,
        })
        .expect(201);
      const tecnicoLogin = await login(email('guard-tecnico'));

      await request(app.getHttpServer())
        .post('/api/company-groups')
        .set('Authorization', `Bearer ${tecnicoLogin.accessToken}`)
        .send({ name: 'Should Not Be Created' })
        .expect(403);
    });
  });

  describe('isolamento entre tenants', () => {
    let groupA: { id: string; name: string };
    let groupB: { id: string; name: string };
    let branchA1: { id: string; name: string };
    let branchA2: { id: string; name: string };
    let adminAToken: string;
    let userB_Token: string;

    beforeAll(async () => {
      const groupARes = await request(app.getHttpServer())
        .post('/api/company-groups')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: `Tenant A ${uniqueSuffix}` })
        .expect(201);
      groupA = groupARes.body;

      const groupBRes = await request(app.getHttpServer())
        .post('/api/company-groups')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: `Tenant B ${uniqueSuffix}` })
        .expect(201);
      groupB = groupBRes.body;

      const branchA1Res = await request(app.getHttpServer())
        .post(`/api/company-groups/${groupA.id}/branches`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: 'Matelândia' })
        .expect(201);
      branchA1 = branchA1Res.body;

      const branchA2Res = await request(app.getHttpServer())
        .post(`/api/company-groups/${groupA.id}/branches`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: 'Medianeira' })
        .expect(201);
      branchA2 = branchA2Res.body;

      await request(app.getHttpServer())
        .post(`/api/company-groups/${groupB.id}/branches`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: 'Sede B' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          name: 'Admin Tenant A',
          email: email('admin-a'),
          password: 'senha123',
          role: 'admin',
          companyGroupId: groupA.id,
        })
        .expect(201);
      adminAToken = (await login(email('admin-a'))).accessToken;

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          name: 'User Tenant B',
          email: email('user-b'),
          password: 'senha123',
          role: 'gestor',
          companyGroupId: groupB.id,
        })
        .expect(201);
      userB_Token = (await login(email('user-b'))).accessToken;

      // Duas PETs e dois funcionários no grupo A, em filiais diferentes —
      // a base para os testes de isolamento por grupo e por filial abaixo.
      await request(app.getHttpServer())
        .post('/api/team-members')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          registration: `TA-${uniqueSuffix}-1`,
          name: 'Funcionário Matelândia',
          role: 'Técnico',
          company: 'Tenant A',
          unit: 'Matelândia',
          documents: {},
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/team-members')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          registration: `TA-${uniqueSuffix}-2`,
          name: 'Funcionário Medianeira',
          role: 'Técnico',
          company: 'Tenant A',
          unit: 'Medianeira',
          documents: {},
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/work-permits')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          areas: ['confinado'],
          location: 'Silo 1',
          unit: 'Matelândia',
          teamSize: 2,
          date: '2026-09-10',
          start: '09:00',
          technician: 'Admin Tenant A',
        })
        .expect(201);
    });

    it('resolves branchId automatically by matching unit against the branches in the caller group', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/team-members')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);

      const matelandia = res.body.find((m: { unit: string }) => m.unit === 'Matelândia');
      const medianeira = res.body.find((m: { unit: string }) => m.unit === 'Medianeira');
      expect(matelandia.branchId).toBe(branchA1.id);
      expect(medianeira.branchId).toBe(branchA2.id);
    });

    it('lets tenant A see its own team-members and work-permits', async () => {
      const members = await request(app.getHttpServer())
        .get('/api/team-members')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);
      expect(members.body).toHaveLength(2);

      const permits = await request(app.getHttpServer())
        .get('/api/work-permits')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);
      expect(permits.body).toHaveLength(1);
    });

    it('hides tenant A data completely from a tenant B session', async () => {
      const members = await request(app.getHttpServer())
        .get('/api/team-members')
        .set('Authorization', `Bearer ${userB_Token}`)
        .expect(200);
      expect(members.body).toEqual([]);

      const permits = await request(app.getHttpServer())
        .get('/api/work-permits')
        .set('Authorization', `Bearer ${userB_Token}`)
        .expect(200);
      expect(permits.body).toEqual([]);

      const users = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${userB_Token}`)
        .expect(200);
      expect(users.body.every((u: { companyGroupId: string }) => u.companyGroupId === groupB.id)).toBe(
        true,
      );
    });

    it('lets platform-admin see data from every tenant', async () => {
      const members = await request(app.getHttpServer())
        .get('/api/team-members')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);
      expect(members.body.length).toBeGreaterThanOrEqual(2);
    });

    it('rejects tenant B managing tenant A branches (different group, not platform-admin)', async () => {
      await request(app.getHttpServer())
        .get(`/api/company-groups/${groupA.id}/branches`)
        .set('Authorization', `Bearer ${userB_Token}`)
        .expect(403);
    });

    describe('restrição por filial dentro do mesmo grupo', () => {
      let branchRestrictedToken: string;

      beforeAll(async () => {
        await request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({
            name: 'Tecnico Só Matelândia',
            email: email('branch-restricted'),
            password: 'senha123',
            role: 'tecnico',
            branchId: branchA1.id,
          })
          .expect(201);
        branchRestrictedToken = (await login(email('branch-restricted'))).accessToken;
      });

      it('only sees team-members from its own branch, not the sibling branch in the same group', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/team-members')
          .set('Authorization', `Bearer ${branchRestrictedToken}`)
          .expect(200);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].unit).toBe('Matelândia');
      });

      it('only sees work-permits from its own branch', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/work-permits')
          .set('Authorization', `Bearer ${branchRestrictedToken}`)
          .expect(200);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].unit).toBe('Matelândia');
      });
    });
  });

  describe('regressão: limpar a filial de um usuário via PATCH /users/:id', () => {
    let groupId: string;
    let branchId: string;
    let adminToken: string;
    let targetUserId: string;

    beforeAll(async () => {
      const groupRes = await request(app.getHttpServer())
        .post('/api/company-groups')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: `Regression Group ${uniqueSuffix}` })
        .expect(201);
      groupId = groupRes.body.id;

      const branchRes = await request(app.getHttpServer())
        .post(`/api/company-groups/${groupId}/branches`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: 'Filial Única' })
        .expect(201);
      branchId = branchRes.body.id;

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          name: 'Admin Regressão',
          email: email('regression-admin'),
          password: 'senha123',
          role: 'admin',
          companyGroupId: groupId,
        })
        .expect(201);
      adminToken = (await login(email('regression-admin'))).accessToken;

      const userRes = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Usuário Alvo',
          email: email('regression-target'),
          password: 'senha123',
          role: 'tecnico',
          branchId,
        })
        .expect(201);
      targetUserId = userRes.body.id;
      expect(userRes.body.branchId).toBe(branchId);
    });

    it('omitting branchId in a PATCH leaves the current branch unchanged', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Usuário Alvo (renomeado)' })
        .expect(200);

      expect(res.body.branchId).toBe(branchId);
    });

    it('sending an explicit null for branchId clears it back to "whole group"', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ branchId: null })
        .expect(200);

      expect(res.body.branchId).toBeNull();
    });
  });
});
