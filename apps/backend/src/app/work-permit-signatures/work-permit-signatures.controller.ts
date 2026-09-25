import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { scopeFromUser } from '../auth/tenant-scope';
import { RequestBiometricSignatureOptionsDto } from './dto/request-biometric-signature-options.dto';
import { VerifyBiometricSignatureDto } from './dto/verify-biometric-signature.dto';
import { WorkPermitSignature } from './entities/work-permit-signature.entity';
import { WorkPermitSignaturesService } from './work-permit-signatures.service';

/**
 * Assinatura eletrônica de PET (abertura/encerramento) — nenhuma rota aqui
 * ainda é chamada pelo assistente "Nova PET" (isso é um PR seguinte); por
 * enquanto os 3 métodos vão sendo construídos e testados diretamente.
 * `JwtAuthGuard` a nível de classe: quem chama é sempre a sessão do
 * técnico/gestor já logado — um membro da escala (TeamMember) nunca loga
 * separadamente, se identifica por crachá+PIN ou OTP no mesmo aparelho.
 */
@Controller('work-permit-signatures')
@UseGuards(JwtAuthGuard)
export class WorkPermitSignaturesController {
  constructor(private readonly signaturesService: WorkPermitSignaturesService) {}

  @Post('biometria/options')
  @HttpCode(HttpStatus.OK)
  requestBiometricOptions(
    @Body() dto: RequestBiometricSignatureOptionsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }> {
    return this.signaturesService.requestBiometricSignatureOptions({
      userId: currentUser.id,
      petRole: dto.petRole,
      lifecycleEvent: dto.lifecycleEvent,
      draftId: dto.draftId,
      workPermitId: dto.workPermitId,
      contentSnapshot: dto.contentSnapshot,
    });
  }

  @Post('biometria/verify')
  @HttpCode(HttpStatus.CREATED)
  verifyBiometric(
    @Body() dto: VerifyBiometricSignatureDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<WorkPermitSignature> {
    return this.signaturesService.verifyBiometricSignature({
      userId: currentUser.id,
      challengeId: dto.challengeId,
      response: dto.response,
      geolocation: dto.geolocation ?? null,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      scope: scopeFromUser(currentUser),
    });
  }

  // Reexibe assinaturas de abertura já coletadas para um draftId — usado
  // pelo assistente se a pessoa voltar/avançar no passo de assinatura sem
  // perder o que já foi assinado.
  @Get('draft/:draftId')
  findByDraftId(
    @Param('draftId') draftId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkPermitSignature[]> {
    return this.signaturesService.findByDraftId(draftId, scopeFromUser(currentUser));
  }
}
