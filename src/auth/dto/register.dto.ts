import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MaxLength,
    MinLength,
    Validate,
} from 'class-validator';

import { MatchConstraint } from '@/common/validators';

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 100;

export class RegisterDto {
    @IsString({ message: 'Name must be a string.' })
    @IsNotEmpty({ message: 'Name is required.' })
    @MaxLength(50, { message: 'Name must not exceed 50 characters.' })
    name!: string;

    @IsString({ message: 'Email must be a string.' })
    @IsEmail({}, { message: 'Invalid email format.' })
    @IsNotEmpty({ message: 'Email is required.' })
    email!: string;

    @IsString({ message: 'Password must be a string.' })
    @IsNotEmpty({ message: 'Password is required.' })
    @MinLength(PASSWORD_MIN_LENGTH, {
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    })
    @MaxLength(PASSWORD_MAX_LENGTH, {
        message: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`,
    })
    password!: string;

    @IsString({ message: 'Password confirmation must be a string.' })
    @IsNotEmpty({ message: 'Password confirmation cannot be empty.' })
    @Validate(MatchConstraint, ['password'], {
        message: 'Passwords do not match.',
    })
    passwordRepeat!: string;
}
