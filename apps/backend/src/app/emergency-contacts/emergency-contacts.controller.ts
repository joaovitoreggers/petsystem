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
import { EmergencyContactsService } from './emergency-contacts.service';
import { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';
import { EmergencyContact } from './entities/emergency-contact.entity';

/**
 * Cadastro da brigada de emergência — quem recebe SMS/WhatsApp quando uma
 * evacuação é acionada (ver EvacuationModule). Toda a rota exige login de
 * verdade (JwtAuthGuard), mesma exigência de CompanyLocationsModule. Edição
 * e exclusão exigem papel de admin ou gestor.
 */
@Controller('emergency-contacts')
@UseGuards(JwtAuthGuard)
export class EmergencyContactsController {
  constructor(private readonly emergencyContactsService: EmergencyContactsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser): Promise<EmergencyContact[]> {
    return this.emergencyContactsService.findAll(scopeFromUser(currentUser));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateEmergencyContactDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<EmergencyContact> {
    return this.emergencyContactsService.create(dto, scopeFromUser(currentUser));
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyContactDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<EmergencyContact> {
    return this.emergencyContactsService.update(id, dto, scopeFromUser(currentUser));
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.emergencyContactsService.delete(id, scopeFromUser(currentUser));
  }
}
