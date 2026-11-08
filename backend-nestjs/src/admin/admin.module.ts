import { Module } from '@nestjs/common';
import { AdminKeyGuard } from '../common/admin-key.guard';
import { AdminDataService } from './admin-data.service';
import { AdminController } from './admin.controller';
import { MlRunnerService } from './ml-runner.service';

@Module({
  controllers: [AdminController],
  providers: [AdminDataService, MlRunnerService, AdminKeyGuard],
})
export class AdminModule {}
