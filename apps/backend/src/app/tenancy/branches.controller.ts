import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
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
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Branch } from './entities/branch.entity';

// Ler a lista de filiais é liberado pra qualquer sessão autenticada do
// próprio grupo, não só admin/gestor — até um técnico precisa saber quais
// filiais existem pra escolher uma ao emitir uma PET ou cadastrar um
// funcionário (ver PetWizardComponent/PetTeamComponent no front-end).
function assertCanReadGroup(user: AuthenticatedUser, groupId: string): void {
  if (user.role === 'platform-admin') return;
  if (user.companyGroupId === groupId) return;
  throw new ForbiddenException('Você não pode ver as filiais deste grupo de empresas');
}

// Criar/renomear/excluir filial já é mais restrito: só o platform-admin
// (qualquer grupo) ou o admin do próprio grupo — gestor/técnico não
// gerenciam a estrutura do tenant, só a leem.
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

  @Patch(':branchId')
  @Roles('platform-admin', 'admin')
  async update(
    @Param('groupId') groupId: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Branch> {
    assertCanManageGroup(user, groupId);
    const branch = await this.branchesService.getByIdOrFail(branchId);
    if (branch.companyGroupId !== groupId) {
      throw new NotFoundException('Filial não encontrada neste grupo');
    }
    return this.branchesService.update(branchId, dto);
  }

  // 409 se ainda houver usuário, PET ou funcionário vinculado — ver
  // BranchesService.delete.
  @Delete(':branchId')
  @Roles('platform-admin', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('groupId') groupId: string,
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    assertCanManageGroup(user, groupId);
    const branch = await this.branchesService.getByIdOrFail(branchId);
    if (branch.companyGroupId !== groupId) {
      throw new NotFoundException('Filial não encontrada neste grupo');
    }
    await this.branchesService.delete(branchId);
  }
}
