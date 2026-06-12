import { IsNotEmpty, IsString, MinLength } from 'class-validator';

const PASSWORD_MIN_LENGTH = 6;

export class NewPasswordDto {
    @IsString({ message: 'Password must be a string.' })
    @MinLength(PASSWORD_MIN_LENGTH, {
        message: `Password must contain at least ${PASSWORD_MIN_LENGTH} characters.`,
    })
    @IsNotEmpty({ message: 'New password field cannot be empty.' })
    password!: string;

    @IsString({ message: 'Token must be a string.' })
    @IsNotEmpty({ message: 'Token is required.' })
    token!: string;
}
