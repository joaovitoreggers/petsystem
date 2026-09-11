import { CompanyGroupsController } from './company-groups.controller';
import { CompanyGroupsService } from './company-groups.service';

describe('CompanyGroupsController', () => {
  let controller: CompanyGroupsController;
  let service: jest.Mocked<Pick<CompanyGroupsService, 'findAll' | 'create'>>;

  beforeEach(() => {
    service = { findAll: jest.fn(), create: jest.fn() };
    controller = new CompanyGroupsController(service as unknown as CompanyGroupsService);
  });

  it('delegates listing to the service', async () => {
    const groups = [{ id: 'g1', name: 'Lar', createdAt: new Date() }];
    service.findAll.mockResolvedValue(groups);

    await expect(controller.findAll()).resolves.toBe(groups);
  });

  it('delegates creation to the service', async () => {
    const created = { id: 'g1', name: 'Novo Grupo', createdAt: new Date() };
    service.create.mockResolvedValue(created);

    await expect(controller.create({ name: 'Novo Grupo' })).resolves.toBe(created);
    expect(service.create).toHaveBeenCalledWith({ name: 'Novo Grupo' });
  });
});
