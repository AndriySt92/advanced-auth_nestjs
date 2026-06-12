import {
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

// Custom validator that checks whether two fields have the same value
// Commonly used for password confirmation fields
@ValidatorConstraint({ name: 'match', async: false })
export class MatchConstraint implements ValidatorConstraintInterface {
    validate(value: unknown, args: ValidationArguments) {
        const [relatedProperty] = args.constraints as [string];
        const relatedValue = (args.object as Record<string, unknown>)[
            relatedProperty
        ];
        return value === relatedValue;
    }

    defaultMessage(args: ValidationArguments) {
        const [relatedProperty] = args.constraints as [string];
        return `${args.property} must match ${relatedProperty}`;
    }
}
