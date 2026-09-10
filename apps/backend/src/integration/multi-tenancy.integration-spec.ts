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
      'TRUNCATE TABLE team_members, work_permits, employees, access_events, users, branches, company_groups RESTART IDENTITY CASCADE',
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

    describe('proteção de escrita entre tenants (PATCH/DELETE)', () => {
      // Um cadastro isolado nesta suíte — os outros testes acima não podem
      // ficar sujeitos a este aqui deletar algo que eles ainda usam.
      let writeTestRegistration: string;
      let writeTestPermitId: string;
      let writeTestUserId: string;

      beforeAll(async () => {
        writeTestRegistration = `TA-${uniqueSuffix}-write`;
        await request(app.getHttpServer())
          .post('/api/team-members')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({
            registration: writeTestRegistration,
            name: 'Funcionário Alvo de Escrita',
            role: 'Técnico',
            company: 'Tenant A',
            unit: 'Matelândia',
            documents: {},
          })
          .expect(201);

        const permitRes = await request(app.getHttpServer())
          .post('/api/work-permits')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({
            areas: ['confinado'],
            location: 'Silo alvo de escrita',
            unit: 'Matelândia',
            teamSize: 1,
            date: '2026-09-10',
            start: '10:00',
            technician: 'Admin Tenant A',
          })
          .expect(201);
        writeTestPermitId = permitRes.body.id;

        const userRes = await request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({
            name: 'Usuário Alvo de Escrita',
            email: email('write-target'),
            password: 'senha123',
            role: 'tecnico',
          })
          .expect(201);
        writeTestUserId = userRes.body.id;
      });

      it('rejects tenant B editing/deleting a tenant A team member, as if it did not exist', async () => {
        await request(app.getHttpServer())
          .patch(`/api/team-members/${writeTestRegistration}`)
          .set('Authorization', `Bearer ${userB_Token}`)
          .send({ role: 'Hackeado' })
          .expect(404);

        await request(app.getHttpServer())
          .delete(`/api/team-members/${writeTestRegistration}`)
          .set('Authorization', `Bearer ${userB_Token}`)
          .expect(404);

        // Continua lá, do jeito que estava — nada foi de fato alterado.
        const res = await request(app.getHttpServer())
          .get('/api/team-members')
          .set('Authorization', `Bearer ${adminAToken}`)
          .expect(200);
        const stillThere = res.body.find(
          (m: { registration: string }) => m.registration === writeTestRegistration,
        );
        expect(stillThere?.role).toBe('Técnico');
      });

      it('rejects tenant B closing or adding a reading to a tenant A PET, as if it did not exist', async () => {
        await request(app.getHttpServer())
          .patch(`/api/work-permits/${writeTestPermitId}/close`)
          .set('Authorization', `Bearer ${userB_Token}`)
          .send({ end: '11:00', durationMinutes: 60 })
          .expect(404);

        await request(app.getHttpServer())
          .patch(`/api/work-permits/${writeTestPermitId}/reading`)
          .set('Authorization', `Bearer ${userB_Token}`)
          .send({ gas: { o2: 20.9, co: 0, h2s: 0, lel: 0 } })
          .expect(404);

        await request(app.getHttpServer())
          .get(`/api/work-permits/${writeTestPermitId}`)
          .set('Authorization', `Bearer ${userB_Token}`)
          .expect(404);
      });

      it('rejects tenant B editing/deleting a tenant A user, as if it did not exist', async () => {
        await request(app.getHttpServer())
          .patch(`/api/users/${writeTestUserId}`)
          .set('Authorization', `Bearer ${userB_Token}`)
          .send({ name: 'Hackeado' })
          .expect(404);

        await request(app.getHttpServer())
          .delete(`/api/users/${writeTestUserId}`)
          .set('Authorization', `Bearer ${userB_Token}`)
          .expect(404);
      });

      it('still lets tenant A itself edit/close its own records normally', async () => {
        await request(app.getHttpServer())
          .patch(`/api/team-members/${writeTestRegistration}`)
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ role: 'Técnico Sênior' })
          .expect(200);

        await request(app.getHttpServer())
          .patch(`/api/work-permits/${writeTestPermitId}/close`)
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ end: '11:00', durationMinutes: 60 })
          .expect(200);
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

  describe('Employees e QR do crachá (isolamento entre tenants)', () => {
    let groupA: { id: string };
    let groupB: { id: string };
    let adminAToken: string;
    let userB_Token: string;
    let employeeAId: string;

    beforeAll(async () => {
      const groupARes = await request(app.getHttpServer())
        .post('/api/company-groups')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: `Employees Tenant A ${uniqueSuffix}` })
        .expect(201);
      groupA = groupARes.body;

      const groupBRes = await request(app.getHttpServer())
        .post('/api/company-groups')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ name: `Employees Tenant B ${uniqueSuffix}` })
        .expect(201);
      groupB = groupBRes.body;

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          name: 'Admin Employees A',
          email: email('employees-admin-a'),
          password: 'senha123',
          role: 'admin',
          companyGroupId: groupA.id,
        })
        .expect(201);
      adminAToken = (await login(email('employees-admin-a'))).accessToken;

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          name: 'User Employees B',
          email: email('employees-user-b'),
          password: 'senha123',
          role: 'porteiro',
          companyGroupId: groupB.id,
        })
        .expect(201);
      userB_Token = (await login(email('employees-user-b'))).accessToken;

      const employeeRes = await request(app.getHttpServer())
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ name: 'Funcionário Crachá A', role: 'tecnico', canAccessRiskAreas: true })
        .expect(201);
      employeeAId = employeeRes.body.id;
    });

    it('creates the employee already scoped to the caller company group', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/employees/${employeeAId}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);
      expect(res.body.companyGroupId).toBe(groupA.id);
    });

    it('hides the employee from a different tenant on every read/write route', async () => {
      await request(app.getHttpServer())
        .get(`/api/employees/${employeeAId}`)
        .set('Authorization', `Bearer ${userB_Token}`)
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/api/employees/${employeeAId}`)
        .set('Authorization', `Bearer ${userB_Token}`)
        .send({ name: 'Hackeado' })
        .expect(404);

      const list = await request(app.getHttpServer())
        .get('/api/employees')
        .set('Authorization', `Bearer ${userB_Token}`)
        .expect(200);
      expect(list.body.find((e: { id: string }) => e.id === employeeAId)).toBeUndefined();
    });

    it('treats a QR badge from a different tenant as invalid, without leaking that it exists', async () => {
      const attemptRes = await request(app.getHttpServer())
        .post('/api/qr-validation/attempts')
        .set('Authorization', `Bearer ${userB_Token}`)
        .expect(201);
      const attemptId = attemptRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/qr-validation/attempts/${attemptId}/detection`)
        .set('Authorization', `Bearer ${userB_Token}`)
        .send({ personCount: 1 })
        .expect(201);

      const readRes = await request(app.getHttpServer())
        .post(`/api/qr-validation/attempts/${attemptId}/reads`)
        .set('Authorization', `Bearer ${userB_Token}`)
        .send({ qrCode: employeeAId })
        .expect(201);

      const read = readRes.body.reads[0];
      expect(read.result).toBe('INVALID_QR');
      expect(read.employeeId).toBeNull();
    });

    it('validates the same QR badge normally from within its own tenant', async () => {
      const attemptRes = await request(app.getHttpServer())
        .post('/api/qr-validation/attempts')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(201);
      const attemptId = attemptRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/qr-validation/attempts/${attemptId}/detection`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ personCount: 1 })
        .expect(201);

      const readRes = await request(app.getHttpServer())
        .post(`/api/qr-validation/attempts/${attemptId}/reads`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ qrCode: employeeAId })
        .expect(201);

      expect(readRes.body.reads[0].result).toBe('AUTHORIZED');
    });
  });

  describe('PetAnalysis exige login', () => {
    it('rejects POST /pet-analysis without a token', async () => {
      await request(app.getHttpServer()).post('/api/pet-analysis').expect(401);
    });
  });
});
