import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { UpdateUserDto } from './dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get('profile')
    public async findProfile(userId: string) {
        return this.userService.findById(userId);
    }

    @Patch('profile')
    public async updateProfile(userId: string, @Body() dto: UpdateUserDto) {
        return this.userService.update(userId, dto);
    }

    @Get('by-id/:id')
    public async findById(@Param('id') id: string) {
        return this.userService.findById(id);
    }
}
