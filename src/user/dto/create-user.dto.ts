import {
    IsBoolean,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
    ValidateIf,
} from 'class-validator';

import { AuthMethod } from '@/generated/prisma/enums';

const DISPLAY_NAME_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 6;

export class CreateUserDto {
    @IsString({ message: 'Email must be a string.' })
    @IsEmail({}, { message: 'Invalid email format.' })
    @IsNotEmpty({ message: 'Email is required.' })
    email!: string;

    @ValidateIf(
        (dto: CreateUserDto) =>
            dto.method === AuthMethod.CREDENTIALS || dto.password !== undefined,
    )
    @IsString({ message: 'Password must be a string.' })
    @IsNotEmpty({
        message: 'Password is required for credentials authentication.',
    })
    @MinLength(PASSWORD_MIN_LENGTH, {
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    })
    password?: string;

    @IsString({ message: 'Display name must be a string.' })
    @IsNotEmpty({ message: 'Display name is required.' })
    @MaxLength(DISPLAY_NAME_MAX_LENGTH, {
        message: `Display name must not exceed ${DISPLAY_NAME_MAX_LENGTH} characters.`,
    })
    displayName!: string;

    @IsOptional()
    @IsString({ message: 'Picture must be a string.' })
    picture?: string;

    @IsEnum(AuthMethod, {
        message: 'Authentication method must be a valid enum value.',
    })
    method!: AuthMethod;

    @IsOptional()
    @IsBoolean({ message: 'Verification status must be a boolean value.' })
    isVerified?: boolean;
}
