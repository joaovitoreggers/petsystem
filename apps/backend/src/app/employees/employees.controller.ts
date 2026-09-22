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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { scopeFromUser } from '../auth/tenant-scope';
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
  companyGroupId: string | null;
  branchId: string | null;
}

function toSummary(employee: Employee): EmployeeSummaryDto {
  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    canAccessRiskAreas: employee.canAccessRiskAreas,
    canPerformCorrectiveService: employee.canPerformCorrectiveService,
    companyGroupId: employee.companyGroupId,
    branchId: employee.branchId,
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
  async findAll(@CurrentUser() currentUser: AuthenticatedUser): Promise<EmployeeSummaryDto[]> {
    const employees = await this.employeesService.findAll(scopeFromUser(currentUser));
    return employees.map(toSummary);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<EmployeeSummaryDto> {
    const employee = await this.employeesService.findById(id, scopeFromUser(currentUser));
    if (!employee) {
      throw new NotFoundException('Funcionário não encontrado');
    }
    return toSummary(employee);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<EmployeeSummaryDto> {
    const employee = await this.employeesService.create(dto, scopeFromUser(currentUser));
    return toSummary(employee);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<EmployeeSummaryDto> {
    const employee = await this.employeesService.update(id, dto, scopeFromUser(currentUser));
    return toSummary(employee);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.employeesService.delete(id, scopeFromUser(currentUser));
  }
}
