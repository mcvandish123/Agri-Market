import { Controller, Get } from '@nestjs/common';
import { ForecastsService } from './forecasts.service';
import {
  BacktestResponse,
  LatestForecastResponse,
  MetricRow,
  RegimePoint,
} from './forecasts.types';

@Controller()
export class ForecastsController {
  constructor(private readonly forecasts: ForecastsService) {}

  @Get('forecast/latest')
  latest(): Promise<LatestForecastResponse> {
    return this.forecasts.latest();
  }

  @Get('regime/history')
  regimeHistory(): Promise<RegimePoint[]> {
    return this.forecasts.regimeHistory();
  }

  @Get('metrics')
  metrics(): Promise<MetricRow[]> {
    return this.forecasts.metrics();
  }

  @Get('backtest')
  backtest(): Promise<BacktestResponse> {
    return this.forecasts.backtest();
  }
}
