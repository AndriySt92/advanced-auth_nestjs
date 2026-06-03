import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { createUserWithAccounts } from '@test/factories';

import { AuthMethod, UserRole } from '@/generated/prisma/enums';

import { UpdateUserDto } from './dto';
import { UserController } from './user.controller';
import { UserService } from './user.service';

type UpdatedUser = Awaited<ReturnType<UserService['update']>>;

describe('UserController', () => {
    let controller: UserController;
    let userService: jest.Mocked<Pick<UserService, 'findById' | 'update'>>;

    beforeEach(async () => {
        userService = {
            findById: jest.fn(),
            update: jest.fn(),
        };

        const moduleRef = await Test.createTestingModule({
            controllers: [UserController],
            providers: [
                {
                    provide: UserService,
                    useValue: userService,
                },
            ],
        }).compile();

        controller = moduleRef.get(UserController);
    });

    it('returns the current user profile', async () => {
        const user = createUserWithAccounts();
        userService.findById.mockResolvedValue(user);

        await expect(controller.findProfile('user-id')).resolves.toBe(user);
        expect(userService.findById).toHaveBeenCalledWith('user-id');
    });

    it('updates the current user profile', async () => {
        const dto: UpdateUserDto = {
            email: 'updated@example.com',
            name: 'Updated User',
            isTwoFactorEnabled: true,
        };
        const updatedUser: UpdatedUser = {
            id: 'user-id',
            email: dto.email,
            password: 'hashed-password',
            displayName: dto.name,
            picture: null,
            role: UserRole.REGULAR,
            isVerified: false,
            isTwoFactorEnabled: dto.isTwoFactorEnabled,
            method: AuthMethod.CREDENTIALS,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        };
        userService.update.mockResolvedValue(updatedUser);

        await expect(controller.updateProfile('user-id', dto)).resolves.toBe(
            updatedUser,
        );
        expect(userService.update).toHaveBeenCalledWith('user-id', dto);
    });

    it('returns a user by id for admin routes', async () => {
        const user = createUserWithAccounts({ id: 'requested-user-id' });
        userService.findById.mockResolvedValue(user);

        await expect(controller.findById('requested-user-id')).resolves.toBe(
            user,
        );
        expect(userService.findById).toHaveBeenCalledWith('requested-user-id');
    });
});
