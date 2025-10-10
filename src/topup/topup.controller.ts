import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import { TopupService } from './topup.service';
import { JwtService } from '@nestjs/jwt';

@Controller('api/topup')
export class TopupController {
    constructor(
        private readonly topupService: TopupService,
        private readonly jwtService: JwtService,
    ) { }
    // Lấy danh sách package + bonus info
    @Get('packages')
    async getPackages(@Query('userId') userId: string) {
        if (!userId) {
            return { packages: [], bonus: { hasBonus: false, lastBonus: null } };
        }
        return this.topupService.getPackagesWithBonus(userId);
    }

    // Kiểm tra riêng trạng thái bonus
    @Get('bonus-status')
    async checkBonus(@Query('userId') userId: string) {
        if (!userId) return { hasBonus: false, lastBonus: null };
        return this.topupService.hasMonthlyBonus(userId);
    }

    @Get('transactions')
    async getUserTransactions(@Query('userId') userId: string) {
        if (!userId) throw new BadRequestException('Thiếu userId');
        const transactions = await this.topupService.getUserTransactions(userId);
        return { transactions };
    }

}
