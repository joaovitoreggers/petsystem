import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../tenancy/tenancy.module';
import { CompanyLocationsController } from './company-locations.controller';
import { CompanyLocationsService } from './company-locations.service';
import { CompanyLocation } from './entities/company-location.entity';
import { COMPANY_LOCATION_REPOSITORY } from './repositories/company-location-repository.interface';
import { CompanyLocationRepository } from './repositories/company-location.repository';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyLocation]), TenancyModule],
  controllers: [CompanyLocationsController],
  providers: [
    { provide: COMPANY_LOCATION_REPOSITORY, useClass: CompanyLocationRepository },
    CompanyLocationsService,
  ],
  exports: [CompanyLocationsService],
})
export class CompanyLocationsModule {}
