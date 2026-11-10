import { validateSync } from 'class-validator';
import { MonthlyDataDto } from '../admin/admin.dto';
import { currentMonth, isNotFutureMonth } from './first-of-month';

describe('isNotFutureMonth', () => {
  const now = new Date('2026-11-09T12:00:00Z');

  it('allows past months and the current month', () => {
    expect(isNotFutureMonth('2025-12-01', now)).toBe(true);
    expect(isNotFutureMonth('2026-11-01', now)).toBe(true);
  });

  it('rejects later months, such as a mistyped year', () => {
    expect(isNotFutureMonth('2026-12-01', now)).toBe(false);
    expect(isNotFutureMonth('2062-11-01', now)).toBe(false);
  });

  it('uses the Philippine calendar at a month boundary', () => {
    // 00:30 on 1 November in Manila, still 31 October in UTC
    const boundary = new Date('2026-10-31T16:30:00Z');
    expect(currentMonth(boundary)).toBe('2026-11-01');
    expect(isNotFutureMonth('2026-11-01', boundary)).toBe(true);
  });

  it('leaves malformed values to IsFirstOfMonth', () => {
    expect(isNotFutureMonth('2999-13-45', now)).toBe(true);
  });

  it('is enforced on POST /admin/monthly-data', () => {
    const dto = Object.assign(new MonthlyDataDto(), { month: '2999-01-01' });
    const month = validateSync(dto).find((e) => e.property === 'month');
    expect(month?.constraints).toEqual({
      isNotFutureMonth: 'month must not be after the current month',
    });
  });
});
