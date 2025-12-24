import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, BadRequestException } from '@nestjs/common';
import { DonationService } from './donation.service';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';

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
  async getReceivedGifts(@Req() req) {
    const token = req.cookies['access_token'];
    if (!token) {
      throw new Error('Authentication required - No access token');
    }

    // Giải mã token để lấy userId
    const payload: any = this.jwtService.verify(token);
    const userId = payload.user_id;
    return this.donationService.getReceivedGifts(userId);
  }

  @Get('sent')
  async getSentGifts(@Req() req) {
    const token = req.cookies['access_token'];
    if (!token) {
      throw new Error('Authentication required - No access token');
    }

    // Giải mã token để lấy userId
    const payload: any = this.jwtService.verify(token);
    const userId = payload.user_id;
    return this.donationService.getSentGifts(userId);
  }

  @Patch('mark-read')
  async markAsRead(@Req() req, @Body() body: { donationIds?: string[]; id?: string }) {
    const token = req.cookies?.['access_token'];
    if (!token) {
      throw new BadRequestException('Authentication required - No access token');
    }

    const payload: any = this.jwtService.verify(token);
    const userId = payload.user_id;

    const ids = body.donationIds || (body.id ? [body.id] : []);
    return this.donationService.markAsRead(userId, ids);
  }

}

