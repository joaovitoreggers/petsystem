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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { scopeFromUser } from '../auth/tenant-scope';
import { WorkPermitSignature } from '../work-permit-signatures/entities/work-permit-signature.entity';
import { WorkPermitSignaturesService } from '../work-permit-signatures/work-permit-signatures.service';
import { AddReadingDto } from './dto/add-reading.dto';
import { CloseWorkPermitDto } from './dto/close-work-permit.dto';
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { WorkPermit } from './entities/work-permit.entity';
import { WorkPermitsService } from './work-permits.service';

/**
 * CRUD de PETs (Permissão de Entrada e Trabalho). Exige login de verdade
 * (JwtAuthGuard) em toda a rota — sem sessão não dá pra saber a qual tenant
 * a PET pertence; sem ela, o front-end cai no fallback local.
 */
@Controller('work-permits')
@UseGuards(JwtAuthGuard)
export class WorkPermitsController {
  constructor(
    private readonly workPermitsService: WorkPermitsService,
    private readonly workPermitSignaturesService: WorkPermitSignaturesService,
  ) {}

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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateWorkPermitDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkPermit> {
    return this.workPermitsService.create(dto, scopeFromUser(currentUser));
  }

  @Patch(':id/close')
  close(
    @Param('id') id: string,
    @Body() dto: CloseWorkPermitDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkPermit> {
    return this.workPermitsService.close(id, dto, scopeFromUser(currentUser));
  }

  @Patch(':id/reading')
  addReading(
    @Param('id') id: string,
    @Body() dto: AddReadingDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkPermit> {
    return this.workPermitsService.addReading(id, dto, scopeFromUser(currentUser));
  }

  // Trilha de auditoria da PET — quem assinou, quando, por qual método,
  // usada pela tela de detalhe.
  @Get(':id/signatures')
  findSignatures(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkPermitSignature[]> {
    return this.workPermitSignaturesService.findByWorkPermitId(id, scopeFromUser(currentUser));
  }
}
