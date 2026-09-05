import { ConflictException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

function currentUser(id: string): AuthenticatedUser {
  return { id, email: 'porteiro@petsystem.local', role: 'porteiro', accessLevel: 5 };
}

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<Pick<UsersService, 'delete'>>;

  beforeEach(() => {
    usersService = { delete: jest.fn().mockResolvedValue(undefined) };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  it('rejects deleting your own account', async () => {
    const me = currentUser('same-id');

    await expect(controller.remove('same-id', me)).rejects.toThrow(ConflictException);
    expect(usersService.delete).not.toHaveBeenCalled();
  });

  it('allows deleting another account', async () => {
    const me = currentUser('my-id');

    await controller.remove('someone-else-id', me);

    expect(usersService.delete).toHaveBeenCalledWith('someone-else-id');
  });
});
