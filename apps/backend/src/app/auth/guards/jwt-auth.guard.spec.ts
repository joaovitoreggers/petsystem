import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

const JWT_SECRET = 'test-secret';

@Controller('protected')
class ProtectedRouteController {
  @Get()
  @UseGuards(JwtAuthGuard)
  access() {
    return { ok: true };
  }
}

describe('JwtAuthGuard', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [ProtectedRouteController],
      providers: [
        {
          provide: 'ConfigService',
          useValue: { get: () => JWT_SECRET },
        },
        {
          provide: JwtStrategy,
          useFactory: () =>
            new JwtStrategy({ get: () => JWT_SECRET } as never),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects the request without a token with 401', async () => {
    await request(app.getHttpServer()).get('/protected').expect(401);
  });

  it('rejects the request with an invalid token with 401', async () => {
    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('allows the request with a valid JWT token', async () => {
    const token = jwtService.sign({
      sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: 'porteiro@petsystem.local',
      role: 'porteiro',
      accessLevel: 5,
    });

    const response = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ ok: true });
  });
});
