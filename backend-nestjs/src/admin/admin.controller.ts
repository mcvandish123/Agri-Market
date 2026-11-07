import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminKeyGuard } from '../common/admin-key.guard';
import { AdminDataService } from './admin-data.service';
import { AnnualExportsDto, MonthlyDataDto, StartRunDto } from './admin.dto';
import { MlJob, MlRunnerService } from './ml-runner.service';

/** Admin routes; every one needs the `x-admin-key` header (decision D7). */
@Controller('admin')
@UseGuards(AdminKeyGuard)
export class AdminController {
  constructor(
    private readonly data: AdminDataService,
    private readonly runner: MlRunnerService,
  ) {}

  @Post('monthly-data')
  @HttpCode(200)
  upsertMonthlyData(@Body() dto: MonthlyDataDto) {
    return this.data.upsertMonthlyData(dto);
  }

  @Post('annual-exports')
  @HttpCode(200)
  upsertAnnualExports(@Body() dto: AnnualExportsDto) {
    return this.data.upsertAnnualExports(dto);
  }

  @Post('runs')
  @HttpCode(202)
  startRun(@Body() dto: StartRunDto): Promise<MlJob> {
    return this.runner.startRun({
      dryRun: dto.dryRun ?? false,
      through: dto.through ?? null,
    });
  }

  @Get('runs/:jobId')
  getRun(@Param('jobId', ParseUUIDPipe) jobId: string): Promise<MlJob> {
    return this.runner.getRun(jobId);
  }
}
