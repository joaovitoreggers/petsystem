import { Module } from '@nestjs/common';
import { WorkPermitsModule } from '../work-permits/work-permits.module';
import { PetAnalysisController } from './pet-analysis.controller';
import { PetAnalysisService } from './pet-analysis.service';

@Module({
  imports: [WorkPermitsModule],
  controllers: [PetAnalysisController],
  providers: [PetAnalysisService],
})
export class PetAnalysisModule {}
