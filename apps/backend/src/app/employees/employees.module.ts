import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EMPLOYEE_REPOSITORY } from './repositories/employee-repository.interface';
import { EmployeeRepository } from './repositories/employee.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Employee])],
  controllers: [EmployeesController],
  providers: [
    { provide: EMPLOYEE_REPOSITORY, useClass: EmployeeRepository },
    EmployeesService,
  ],
  exports: [EmployeesService],
})
export class EmployeesModule {}
