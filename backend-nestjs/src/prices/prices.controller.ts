import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional } from 'class-validator';
import { IsFirstOfMonth } from '../common/first-of-month';
import {
  AreaPricesResponse,
  LatestPriceResponse,
  PricePoint,
  PricesService,
} from './prices.service';

export class PriceHistoryQuery {
  @IsOptional()
  @IsFirstOfMonth()
  from?: string;

  @IsOptional()
  @IsFirstOfMonth()
  to?: string;
}

@Controller('prices')
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Get('latest')
  latest(): Promise<LatestPriceResponse> {
    return this.prices.latest();
  }

  @Get('areas')
  areas(): Promise<AreaPricesResponse> {
    return this.prices.areas();
  }

  @Get('history')
  history(@Query() query: PriceHistoryQuery): Promise<PricePoint[]> {
    return this.prices.history(query.from, query.to);
  }
}
