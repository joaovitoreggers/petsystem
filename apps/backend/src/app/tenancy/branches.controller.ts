import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { BranchesService } from './branches.service';
import { CompanyGroupsService } from './company-groups.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { Branch } from './entities/branch.entity';

// Ler a lista de filiais é liberado também para o gestor do próprio grupo —
// ele precisa saber quais filiais existem para restringir um usuário a uma
// delas na tela Usuários, mesmo sem poder criar/editar filiais.
function assertCanReadGroup(user: AuthenticatedUser, groupId: string): void {
  if (user.role === 'platform-admin') return;
  if ((user.role === 'admin' || user.role === 'gestor') && user.companyGroupId === groupId) return;
  throw new ForbiddenException('Você não pode ver as filiais deste grupo de empresas');
}

// Criar filial já é mais restrito: só o platform-admin (qualquer grupo) ou
// o admin do próprio grupo — gestor não gerencia a estrutura do tenant.
function assertCanManageGroup(user: AuthenticatedUser, groupId: string): void {
  if (user.role === 'platform-admin') return;
  if (user.role === 'admin' && user.companyGroupId === groupId) return;
  throw new ForbiddenException('Você não pode gerenciar filiais deste grupo de empresas');
}

/**
 * Cadastro de filiais dentro de um grupo de empresas.
 */
@Controller('company-groups/:groupId/branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly companyGroupsService: CompanyGroupsService,
  ) {}

  @Get()
  @Roles('platform-admin', 'admin', 'gestor')
  async findAll(
    @Param('groupId') groupId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Branch[]> {
    assertCanReadGroup(user, groupId);
    await this.companyGroupsService.getByIdOrFail(groupId);
    return this.branchesService.findByCompanyGroup(groupId);
  }

  @Post()
  @Roles('platform-admin', 'admin')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('groupId') groupId: string,
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Branch> {
    assertCanManageGroup(user, groupId);
    await this.companyGroupsService.getByIdOrFail(groupId);
    return this.branchesService.create({ companyGroupId: groupId, name: dto.name });
  }
}
