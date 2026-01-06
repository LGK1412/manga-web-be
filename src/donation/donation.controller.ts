import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, BadRequestException, UseGuards } from '@nestjs/common';
import { DonationService } from './donation.service';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenGuard } from 'Guards/access-token.guard';

@Controller('api/donation')
export class DonationController {
  constructor(
    private readonly donationService: DonationService,
    private readonly jwtService: JwtService
  ) { }

  @Get('items')
  async getAllDonationItems(
    @Query("onlyAvailable") onlyAvailable?: string,
    @Query("rarity") rarity?: string,
  ) {
    const items = await this.donationService.getAllDonationItems({
      onlyAvailable: onlyAvailable === "true",
      rarity,
    });

    return {
      success: true,
      total: items.length,
      data: items,
    };
  }

  @Post('send')
  async sendGift(
    @Body()
    body: {
      senderId: string,
      receiverId: string;
      itemId: string;
      quantity: number;
      message?: string;
    }
  ) {
    if (!Types.ObjectId.isValid(body.receiverId))
      throw new BadRequestException('receiverId không hợp lệ');
    if (!Types.ObjectId.isValid(body.itemId))
      throw new BadRequestException('itemId không hợp lệ');

    const { senderId, receiverId, itemId, quantity, message } = body;

    // Tính tổng tiền dựa theo item
    const item = await this.donationService.getItemById(itemId);
    if (!item) throw new BadRequestException('Không tìm thấy vật phẩm');

    return this.donationService.donate(
      senderId,
      receiverId,
      itemId,
      quantity,
      message,
    );
  }

  @Get('received')
  @UseGuards(AccessTokenGuard)
  async getReceivedGifts(@Req() req) {
    const payload = (req as any).user;
    return this.donationService.getReceivedGifts(payload.user_id);
  }

  @Get('sent')
  @UseGuards(AccessTokenGuard)
  async getSentGifts(@Req() req) {
    const payload = (req as any).user;
    return this.donationService.getSentGifts(payload.user_id);
  }

  @Patch('mark-read')
  @UseGuards(AccessTokenGuard)
  async markAsRead(@Req() req, @Body() body: { donationIds?: string[]; id?: string }) {
    const payload = (req as any).user;
    const ids = body.donationIds || (body.id ? [body.id] : []);
    return this.donationService.markAsRead(payload.user_id, ids);
  }

}

