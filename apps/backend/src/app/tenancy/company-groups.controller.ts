import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CompanyGroupsService } from './company-groups.service';
import { CreateCompanyGroupDto } from './dto/create-company-group.dto';
import { CompanyGroup } from './entities/company-group.entity';

/**
 * Cadastro de grupos de empresas (tenants) — só o platform-admin cria ou
 * lista grupos. Sem tela própria nesta fase (back-end primeiro); um admin
 * comum não enxerga outros grupos além do seu (ver UsersController/
 * TeamMembersController para o filtro por tenant).
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
}
