import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { scopeFromUser } from '../auth/tenant-scope';
import { TriggerEvacuationDto } from './dto/trigger-evacuation.dto';
import { EvacuationService } from './evacuation.service';
import { PublicEvacuationStatus, TriggerEvacuationResult } from './evacuation.types';

@Controller('evacuation')
export class EvacuationController {
  constructor(private readonly evacuationService: EvacuationService) {}

  // Acionar/encerrar exige login — qualquer papel autenticado pode, igual
  // ao botão de evacuação no shell (não é uma ação de administração).
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  trigger(
    @Body() dto: TriggerEvacuationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TriggerEvacuationResult> {
    return this.evacuationService.trigger(dto.workPermitId ?? null, scopeFromUser(currentUser));
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  resolve(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.evacuationService.resolve(id, scopeFromUser(currentUser));
  }

  // Rota pública de propósito — é o link que vai no SMS/WhatsApp, aberto
  // por alguém da brigada que não necessariamente tem login no sistema. O
  // token (o id do alerta, um uuid) é a própria autorização — ver
  // EvacuationService.getPublicStatus.
  @Get('public/:id')
  async publicStatus(@Param('id') id: string): Promise<PublicEvacuationStatus> {
    const status = await this.evacuationService.getPublicStatus(id);
    if (!status) {
      throw new NotFoundException('Alerta de evacuação não encontrado');
    }
    return status;
  }
}
