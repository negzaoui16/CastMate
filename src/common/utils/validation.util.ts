import { ValidationError } from 'class-validator';

export const extractValidationErrors = (errors: ValidationError[]): string[] =>
  errors.flatMap((error) => {
    const constraints = error.constraints
      ? Object.values(error.constraints)
      : [];

    if (error.children && error.children.length > 0) {
      return constraints.concat(extractValidationErrors(error.children));
    }

    return constraints;
  });


