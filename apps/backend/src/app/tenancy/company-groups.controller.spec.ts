import { CompanyGroupsController } from './company-groups.controller';
import { CompanyGroupsService } from './company-groups.service';

describe('CompanyGroupsController', () => {
  let controller: CompanyGroupsController;
  let service: jest.Mocked<Pick<CompanyGroupsService, 'findAll' | 'create' | 'update' | 'delete'>>;

  beforeEach(() => {
    service = { findAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
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

  it('delegates renaming to the service', async () => {
    const updated = { id: 'g1', name: 'Renomeado', createdAt: new Date() };
    service.update.mockResolvedValue(updated);

    await expect(controller.update('g1', { name: 'Renomeado' })).resolves.toBe(updated);
    expect(service.update).toHaveBeenCalledWith('g1', { name: 'Renomeado' });
  });

  it('delegates deletion to the service', async () => {
    await controller.remove('g1');

    expect(service.delete).toHaveBeenCalledWith('g1');
  });
});
