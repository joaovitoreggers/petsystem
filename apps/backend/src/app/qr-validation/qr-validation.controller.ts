import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecordReadDto } from './dto/record-read.dto';
import { StartDetectionDto } from './dto/start-detection.dto';
import { QrValidationService } from './qr-validation.service';
import { AccessAttempt } from './access-attempt';

interface AttemptResponseDto {
  id: string;
  status: string;
  expectedCount: number;
  reads: { qrCode: string; employeeId: string | null; result: string }[];
  finalResult: string | null;
}

function toResponse(attempt: AccessAttempt): AttemptResponseDto {
  return {
    id: attempt.id,
    status: attempt.status,
    expectedCount: attempt.expectedCount,
    reads: attempt.reads,
    finalResult: attempt.finalResult,
  };
}

@Controller('qr-validation/attempts')
@UseGuards(JwtAuthGuard)
export class QrValidationController {
  constructor(private readonly qrValidationService: QrValidationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  start(): AttemptResponseDto {
    return toResponse(this.qrValidationService.startAttempt());
  }

  @Get(':id')
  get(@Param('id') id: string): AttemptResponseDto {
    return toResponse(this.qrValidationService.getAttempt(id));
  }

  @Post(':id/detection')
  startDetection(
    @Param('id') id: string,
    @Body() dto: StartDetectionDto,
  ): AttemptResponseDto {
    return toResponse(
      this.qrValidationService.startDetection(id, dto.personCount),
    );
  }

  @Post(':id/reads')
  async recordRead(
    @Param('id') id: string,
    @Body() dto: RecordReadDto,
  ): Promise<AttemptResponseDto> {
    const { attempt } = await this.qrValidationService.recordRead(
      id,
      dto.qrCode,
    );
    return toResponse(attempt);
  }
}
