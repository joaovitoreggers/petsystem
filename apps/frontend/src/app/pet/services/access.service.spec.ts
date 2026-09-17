import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AccessService } from './access.service';

/**
 * O ponto destes testes é uma regra só: quando a resposta não vem, ninguém
 * pode nada. Assumir permissão por causa de um erro de rede abriria abas que
 * a API recusaria — e, pior, daria a impressão de autorização.
 */
describe('AccessService', () => {
  let service: AccessService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AccessService],
    });
    service = TestBed.inject(AccessService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('nega tudo antes de qualquer resposta do servidor', () => {
    expect(service.pode()('visualizar_portas')).toBe(false);
    expect(service.podeAlguma('visualizar_portas', 'visualizar_alertas')).toBe(false);
    expect(service.carregado()).toBe(false);
  });

  it('guarda as permissões que o servidor respondeu', async () => {
    const carregando = service.carregar();
    http.expectOne((r) => r.url.endsWith('/auth/me')).flush({
      user: { id: 'u1', email: 'a@b.c', role: 'porteiro', companyGroupId: 'g', branchId: 'f' },
      permissions: ['visualizar_portas', 'visualizar_alertas'],
      roles: [{ slug: 'porteiro', name: 'Porteiro' }],
    });
    await carregando;

    expect(service.pode()('visualizar_portas')).toBe(true);
    expect(service.pode()('gerenciar_dispositivos')).toBe(false);
    expect(service.cargoPrincipal()).toBe('porteiro');
  });

  it('escolhe o cargo de maior alçada quando há mais de um', async () => {
    const carregando = service.carregar();
    http.expectOne((r) => r.url.endsWith('/auth/me')).flush({
      user: { id: 'u1', email: 'a@b.c', role: 'gestor', companyGroupId: 'g', branchId: null },
      permissions: [],
      roles: [
        { slug: 'porteiro', name: 'Porteiro' },
        { slug: 'gestor', name: 'Gestor' },
      ],
    });
    await carregando;

    expect(service.cargoPrincipal()).toBe('gestor');
  });

  it('falha fechado: erro de rede não libera nada', async () => {
    const carregando = service.carregar();
    http
      .expectOne((r) => r.url.endsWith('/auth/me'))
      .error(new ProgressEvent('erro'), { status: 0 });
    await carregando;

    expect(service.pode()('visualizar_portas')).toBe(false);
    // Marcado como carregado mesmo no erro: a tela precisa saber que a
    // pergunta já foi feita, senão ficaria esperando para sempre.
    expect(service.carregado()).toBe(true);
  });

  it('limpar devolve o serviço ao estado de quem não entrou', async () => {
    const carregando = service.carregar();
    http.expectOne((r) => r.url.endsWith('/auth/me')).flush({
      user: { id: 'u1', email: 'a@b.c', role: 'admin', companyGroupId: 'g', branchId: null },
      permissions: ['gerenciar_dispositivos'],
      roles: [{ slug: 'administrador', name: 'Administrador' }],
    });
    await carregando;
    expect(service.pode()('gerenciar_dispositivos')).toBe(true);

    service.limpar();

    expect(service.pode()('gerenciar_dispositivos')).toBe(false);
    expect(service.cargoPrincipal()).toBeNull();
    expect(service.carregado()).toBe(false);
  });

  it('403 do servidor também deixa tudo fechado', async () => {
    const carregando = service.carregar();
    http
      .expectOne((r) => r.url.endsWith('/auth/me'))
      .flush({ message: 'proibido' }, { status: 403, statusText: 'Forbidden' });
    await carregando;

    expect(service.podeAlguma('visualizar_portas')).toBe(false);
    expect(new HttpErrorResponse({ status: 403 }).status).toBe(403);
  });
});
