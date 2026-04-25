import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { Authorization, CurrentUser } from '@/common/decorators';
import { UserRole } from '@/generated/prisma/browser';

import { UpdateUserDto } from './dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Authorization()
    @Get('profile')
    findProfile(@CurrentUser('id') userId: string) {
        return this.userService.findById(userId);
    }

    @Authorization()
    @Patch('profile')
    updateProfile(
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateUserDto,
    ) {
        return this.userService.update(userId, dto);
    }

    @Authorization(UserRole.ADMIN)
    @Get(':id')
    findById(@Param('id') id: string) {
        return this.userService.findById(id);
    }
}
