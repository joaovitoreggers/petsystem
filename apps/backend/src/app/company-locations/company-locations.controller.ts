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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { scopeFromUser } from '../auth/tenant-scope';
import { CompanyLocationsService } from './company-locations.service';
import { CreateCompanyLocationDto } from './dto/create-company-location.dto';
import { UpdateCompanyLocationDto } from './dto/update-company-location.dto';
import { CompanyLocation } from './entities/company-location.entity';

/**
 * Cadastro de locais da empresa, cada um já com a área de risco padrão —
 * usado pelo assistente "Nova PET" para pré-preencher área, nome e
 * unidade ao escolher um local já conhecido. Toda a rota exige login de
 * verdade (JwtAuthGuard), mesma exigência de TeamMembersModule. Edição e
 * exclusão exigem papel de admin ou gestor.
 */
@Controller('company-locations')
@UseGuards(JwtAuthGuard)
export class CompanyLocationsController {
  constructor(private readonly companyLocationsService: CompanyLocationsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser): Promise<CompanyLocation[]> {
    return this.companyLocationsService.findAll(scopeFromUser(currentUser));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateCompanyLocationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CompanyLocation> {
    return this.companyLocationsService.create(dto, scopeFromUser(currentUser));
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyLocationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CompanyLocation> {
    return this.companyLocationsService.update(id, dto, scopeFromUser(currentUser));
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.companyLocationsService.delete(id, scopeFromUser(currentUser));
  }
}
