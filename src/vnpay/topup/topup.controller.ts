import { Controller, Get, Query } from '@nestjs/common';
import { TopupService } from './topup.service';

@Controller('api/topup')
export class TopupController {
    constructor(private readonly topupService: TopupService) { }

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
}
