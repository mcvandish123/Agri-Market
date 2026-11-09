import { registerDecorator, ValidationOptions } from 'class-validator';

/** True for a real calendar date written as `YYYY-MM-01` (CLAUDE.md conventions). */
export function isFirstOfMonth(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** First day of the current month on the Philippine calendar (UTC+8, no DST). */
export function currentMonth(now = new Date()): string {
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return `${manila.toISOString().slice(0, 7)}-01`;
}

/** False only for a valid `YYYY-MM-01` after the current month. */
export function isNotFutureMonth(value: unknown, now = new Date()): boolean {
  return !isFirstOfMonth(value) || value <= currentMonth(now);
}

/** class-validator decorator: observed data cannot be for a month still to come. */
export function IsNotFutureMonth(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isNotFutureMonth',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: `${String(propertyName)} must not be after the current month`,
        ...options,
      },
      validator: { validate: (value: unknown) => isNotFutureMonth(value) },
    });
  };
}

/** class-validator decorator: the value must be a `YYYY-MM-01` date string. */
export function IsFirstOfMonth(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isFirstOfMonth',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: `${String(propertyName)} must be the first day of a month (YYYY-MM-01)`,
        ...options,
      },
      validator: { validate: isFirstOfMonth },
    });
  };
}
