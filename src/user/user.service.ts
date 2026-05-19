import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { hash } from 'argon2';

import { PrismaService } from '@/prisma/prisma.service';

import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UserService {
    public constructor(private readonly prismaService: PrismaService) {}
    private readonly logger = new Logger(UserService.name);

    public async findById(id: string) {
        this.logger.debug(`Finding user by ID: ${id}`);

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
        this.logger.log(`User found: ${user.email} (ID: ${user.id})`);

        return user;
    }

    public async findByEmail(email: string) {
        this.logger.debug(`Finding user by email: ${email}`);

        const user = await this.prismaService.user.findUnique({
            where: {
                email,
            },
            include: {
                accounts: true,
            },
        });

        if (!user)
            throw new NotFoundException(
                'User not found. Please check the provided data.',
            );
        this.logger.log(`User found: ${user?.email} (ID: ${user?.id})`);

        return user;
    }

    public async create(dto: CreateUserDto) {
        this.logger.debug(`Creating user with email: ${dto.email}`);

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
        this.logger.log(`User created: ${user.email} (ID: ${user.id})`);

        return user;
    }

    public async update(userId: string, dto: UpdateUserDto) {
        this.logger.debug(`Updating user with ID: ${userId}`);

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
        this.logger.log(
            `User updated: ${updatedUser.email} (ID: ${updatedUser.id})`,
        );

        return updatedUser;
    }
}
