import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { AddReadingDto } from './dto/add-reading.dto';
import { CloseWorkPermitDto } from './dto/close-work-permit.dto';
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { WorkPermit } from './entities/work-permit.entity';
import { WorkPermitsService } from './work-permits.service';

/**
 * CRUD de PETs (Permissão de Entrada e Trabalho). Sem @UseGuards(JwtAuthGuard)
 * de propósito: o front-end do PET Digital não tem mais uma tela de login
 * real (o reconhecimento facial é só uma simulação de UI), então não há
 * token JWT disponível para autenticar essas chamadas neste MVP.
 */
@Controller('work-permits')
export class WorkPermitsController {
  constructor(private readonly workPermitsService: WorkPermitsService) {}

  @Get()
  findAll(): Promise<WorkPermit[]> {
    return this.workPermitsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WorkPermit> {
    const permit = await this.workPermitsService.findById(id);
    if (!permit) {
      throw new NotFoundException('PET não encontrada');
    }
    return permit;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateWorkPermitDto): Promise<WorkPermit> {
    return this.workPermitsService.create(dto);
  }

  @Patch(':id/close')
  close(@Param('id') id: string, @Body() dto: CloseWorkPermitDto): Promise<WorkPermit> {
    return this.workPermitsService.close(id, dto);
  }

  @Patch(':id/reading')
  addReading(@Param('id') id: string, @Body() dto: AddReadingDto): Promise<WorkPermit> {
    return this.workPermitsService.addReading(id, dto);
  }
}
