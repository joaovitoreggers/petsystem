import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';

interface EmployeeSummaryDto {
  id: string;
  name: string;
  role: string;
  canAccessRiskAreas: boolean;
  canPerformCorrectiveService: boolean;
}

function toSummary(employee: Employee): EmployeeSummaryDto {
  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    canAccessRiskAreas: employee.canAccessRiskAreas,
    canPerformCorrectiveService: employee.canPerformCorrectiveService,
  };
}

/**
 * CRUD de funcionários — pessoas de campo validadas pelo QrValidationModule.
 * O `id` (uuid) é o conteúdo do QR do crachá, igual ao User.
 */
@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  async findAll(): Promise<EmployeeSummaryDto[]> {
    const employees = await this.employeesService.findAll();
    return employees.map(toSummary);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<EmployeeSummaryDto> {
    const employee = await this.employeesService.findById(id);
    if (!employee) {
      throw new NotFoundException('Funcionário não encontrado');
    }
    return toSummary(employee);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateEmployeeDto): Promise<EmployeeSummaryDto> {
    const employee = await this.employeesService.create(dto);
    return toSummary(employee);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeSummaryDto> {
    const employee = await this.employeesService.update(id, dto);
    return toSummary(employee);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.employeesService.delete(id);
  }
}
