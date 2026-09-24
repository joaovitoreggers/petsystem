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
import { ChecklistItemsService } from './checklist-items.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { ChecklistItem } from './entities/checklist-item.entity';

/**
 * Itens de checklist adicionais que a empresa cadastra por NR, somados aos
 * itens fixos do assistente (ver buildChecklistGroups no front-end). Toda
 * a rota exige login de verdade (JwtAuthGuard), mesma exigência de
 * CompanyLocationsModule/EmergencyContactsModule. Edição e exclusão
 * exigem papel de admin ou gestor.
 */
@Controller('checklist-items')
@UseGuards(JwtAuthGuard)
export class ChecklistItemsController {
  constructor(private readonly checklistItemsService: ChecklistItemsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser): Promise<ChecklistItem[]> {
    return this.checklistItemsService.findAll(scopeFromUser(currentUser));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateChecklistItemDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ChecklistItem> {
    return this.checklistItemsService.create(dto, scopeFromUser(currentUser));
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ChecklistItem> {
    return this.checklistItemsService.update(id, dto, scopeFromUser(currentUser));
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.checklistItemsService.delete(id, scopeFromUser(currentUser));
  }
}
