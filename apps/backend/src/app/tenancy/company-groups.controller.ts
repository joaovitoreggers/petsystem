import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CompanyGroupsService } from './company-groups.service';
import { CreateCompanyGroupDto } from './dto/create-company-group.dto';
import { UpdateCompanyGroupDto } from './dto/update-company-group.dto';
import { CompanyGroup } from './entities/company-group.entity';

/**
 * Cadastro de grupos de empresas (tenants) — só o platform-admin cria,
 * lista, renomeia ou exclui grupos. Um admin comum não enxerga outros
 * grupos além do seu (ver UsersController/TeamMembersController para o
 * filtro por tenant).
 */
@Controller('company-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform-admin')
export class CompanyGroupsController {
  constructor(private readonly companyGroupsService: CompanyGroupsService) {}

  @Get()
  findAll(): Promise<CompanyGroup[]> {
    return this.companyGroupsService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCompanyGroupDto): Promise<CompanyGroup> {
    return this.companyGroupsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyGroupDto): Promise<CompanyGroup> {
    return this.companyGroupsService.update(id, dto);
  }

  // 409 se ainda houver filial, usuário, PET ou funcionário vinculado —
  // ver CompanyGroupsService.delete.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.companyGroupsService.delete(id);
  }
}
