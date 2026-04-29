import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmDto {
    @IsString({ message: 'Token must be a string.' })
    @IsNotEmpty({ message: 'Token cannot be empty.' })
    token!: string;
}
