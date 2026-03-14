import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsMinimumAge', async: false })
export class IsMinimumAge implements ValidatorConstraintInterface {
    validate(value: string, args: ValidationArguments) {
        const minAge = args.constraints[0];

        const birth = new Date(value);
        const today = new Date();

        let age = today.getFullYear() - birth.getFullYear();

        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        return age >= minAge;
    }

    defaultMessage() {
        return 'Author must be at least 16 years old';
    }
}