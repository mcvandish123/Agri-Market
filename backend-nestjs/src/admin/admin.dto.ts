import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsFirstOfMonth } from '../common/first-of-month';

// Upper bounds follow the column precision in the migration (e.g. numeric(8,2)
// holds < 1,000,000), so an out-of-range value is a 400 here, not a database error.
const finite = { allowNaN: false, allowInfinity: false };

/** POST /admin/monthly-data. camelCase of the monthly_data columns. */
export class MonthlyDataDto {
  @IsFirstOfMonth()
  month!: string;

  // Farmgate copra prices, PHP/kg (PCA), numeric(8,2)
  @IsNumber(finite) @IsPositive() @Max(999999.99) farmgateDavaoCity!: number;
  @IsNumber(finite) @IsPositive() @Max(999999.99) farmgateDavaoDeOro!: number;
  @IsNumber(finite)
  @IsPositive()
  @Max(999999.99)
  farmgateDavaoDelNorte!: number;
  @IsNumber(finite) @IsPositive() @Max(999999.99) farmgateDavaoDelSur!: number;
  @IsNumber(finite)
  @IsPositive()
  @Max(999999.99)
  farmgateDavaoOccidental!: number;
  @IsNumber(finite)
  @IsPositive()
  @Max(999999.99)
  farmgateDavaoOriental!: number;

  // Region XI CPI, 2018 = 100, numeric(8,2)
  @IsNumber(finite) @IsPositive() @Max(999999.99) cpiRegion11!: number;

  // Weather (PAGASA). temp numeric(5,2); RH 0-100; rain numeric(7,2) >= 0
  @IsNumber(finite) @Min(-50) @Max(60) tempC!: number;
  @IsNumber(finite) @Min(0) @Max(100) rhPct!: number;
  @IsNumber(finite) @Min(0) @Max(99999.99) rainMm!: number;

  // World Bank Pink Sheet, USD/mt, numeric(10,2)
  @IsNumber(finite) @IsPositive() @Max(99999999.99) coconutOilUsdMt!: number;
  @IsNumber(finite) @IsPositive() @Max(99999999.99) palmOilUsdMt!: number;
  @IsNumber(finite) @IsPositive() @Max(99999999.99) palmKernelOilUsdMt!: number;
  @IsNumber(finite) @IsPositive() @Max(99999999.99) soybeanOilUsdMt!: number;

  // BSP monthly average, PHP per USD, numeric(10,4)
  @IsNumber(finite) @IsPositive() @Max(999999.9999) phpUsd!: number;

  @IsOptional() @IsString() @MaxLength(1000) sourceNote?: string;
}

/** POST /admin/annual-exports */
export class AnnualExportsDto {
  @IsInt() @Min(2000) @Max(2100) year!: number;

  // numeric(12,6), USD/kg (FOB value / gross weight)
  @IsNumber(finite) @IsPositive() @Max(999999.999999) unitValueUsdKg!: number;

  @IsOptional() @IsString() @MaxLength(1000) sourceNote?: string;
}

/** POST /admin/runs, forwarded to the ML runner's POST /runs. */
export class StartRunDto {
  @IsOptional() @IsBoolean() dryRun?: boolean;

  /** Replay with data through this month; the runner allows it only with dryRun. */
  @IsOptional() @IsFirstOfMonth() through?: string;
}
