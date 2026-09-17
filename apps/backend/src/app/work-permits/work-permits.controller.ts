import {
  Body,
  Controller,
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
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { scopeFromUser } from '../auth/tenant-scope';
import { AddReadingDto } from './dto/add-reading.dto';
import { CloseWorkPermitDto } from './dto/close-work-permit.dto';
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { WorkPermit } from './entities/work-permit.entity';
import { WorkPermitsService } from './work-permits.service';

/**
 * CRUD de PETs (Permissão de Entrada e Trabalho). Exige login de verdade
 * (JwtAuthGuard) em toda a rota — sem sessão não dá pra saber a qual tenant
 * a PET pertence. O caminho de reconhecimento facial (sem token) cai no
 * fallback local do front-end nesse caso.
 */
@Controller('work-permits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkPermitsController {
  constructor(private readonly workPermitsService: WorkPermitsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser): Promise<WorkPermit[]> {
    return this.workPermitsService.findAll(scopeFromUser(currentUser));
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkPermit> {
    const permit = await this.workPermitsService.findById(id, scopeFromUser(currentUser));
    if (!permit) {
      throw new NotFoundException('PET não encontrada');
    }
    return permit;
  }

  /**
   * Abre uma PET.
   *
   * Emitir e trabalho do tecnico de seguranca, nao de quem administra o
   * sistema: e ele que vistoria a frente, mede a atmosfera e assina. Por
   * isso a rota exige `emitir_pet`, permissao que so o cargo operador
   * recebe (ver migration 007). Esconder o botao na tela nao bastaria —
   * quem souber o endereco chama a API direto, e e aqui que a recusa
   * acontece.
   */
  @Post()
  @RequirePermissions('emitir_pet')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateWorkPermitDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkPermit> {
    return this.workPermitsService.create(dto, scopeFromUser(currentUser));
  }

  /**
   * Encerra a PET.
   *
   * Encerrar e dizer que a frente foi desmobilizada em seguranca — ato de
   * campo, do mesmo tipo da emissao, e nao acompanhamento gerencial.
   */
  @Patch(':id/close')
  @RequirePermissions('operar_pet')
  close(
    @Param('id') id: string,
    @Body() dto: CloseWorkPermitDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkPermit> {
    return this.workPermitsService.close(id, dto, scopeFromUser(currentUser));
  }

  /**
   * Registra uma medicao atmosferica.
   *
   * Quem mede esta com o detector na mao, dentro do espaco confinado. O
   * numero que entra aqui e o que libera ou bloqueia a entrada de gente.
   */
  @Patch(':id/reading')
  @RequirePermissions('operar_pet')
  addReading(
    @Param('id') id: string,
    @Body() dto: AddReadingDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkPermit> {
    return this.workPermitsService.addReading(id, dto, scopeFromUser(currentUser));
  }
}
