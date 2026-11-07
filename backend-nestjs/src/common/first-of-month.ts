import { registerDecorator, ValidationOptions } from 'class-validator';

/** True for a real calendar date written as `YYYY-MM-01` (CLAUDE.md conventions). */
export function isFirstOfMonth(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
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
