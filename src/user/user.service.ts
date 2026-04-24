import { Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'argon2';

import { PrismaService } from '@/prisma/prisma.service';

import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UserService {
    public constructor(private readonly prismaService: PrismaService) {}

    public async getAllUsers() {
        return this.prismaService.user.findMany({
            include: {
                accounts: true,
            },
        });
    }

    public async findById(id: string) {
        const user = await this.prismaService.user.findUnique({
            where: {
                id,
            },
            include: {
                accounts: true,
            },
        });

        if (!user)
            throw new NotFoundException(
                'User not found. Please check the provided data.',
            );

        return user;
    }

    public async findByEmail(email: string) {
        const user = await this.prismaService.user.findUnique({
            where: {
                email,
            },
            include: {
                accounts: true,
            },
        });

        return user;
    }

    public async create(dto: CreateUserDto) {
        const { email, password, displayName, picture, method, isVerified } =
            dto;

        const user = await this.prismaService.user.create({
            data: {
                email,
                password: password ? await hash(password) : '',
                displayName,
                picture,
                method,
                isVerified,
            },
            include: {
                accounts: true,
            },
        });

        return user;
    }

    public async update(userId: string, dto: UpdateUserDto) {
        const { email, name: displayName, isTwoFactorEnabled } = dto;

        const updatedUser = await this.prismaService.user.update({
            where: {
                id: userId,
            },
            data: {
                email,
                displayName,
                isTwoFactorEnabled,
            },
        });
        return updatedUser;
    }
}
