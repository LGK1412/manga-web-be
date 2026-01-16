import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Types } from 'mongoose';

import { DonationService } from './donation.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/donation')
export class DonationController {
  constructor(private readonly donationService: DonationService) {}

  @Get('items')
  async getAllDonationItems(
    @Query('onlyAvailable') onlyAvailable?: string,
    @Query('rarity') rarity?: string,
  ) {
    const items = await this.donationService.getAllDonationItems({
      onlyAvailable: onlyAvailable === 'true',
      rarity,
    });

    return {
      success: true,
      total: items.length,
      data: items,
    };
  }

  /**
   * Logged-in: gửi quà/donation
   * NOTE: KHÔNG nhận senderId từ body (tránh giả mạo).
   */
  @Post('send')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async sendGift(
    @Req() req: Request,
    @Body()
    body: {
      receiverId: string;
      itemId: string;
      quantity: number;
      message?: string;
    },
  ) {
    const payload = (req as any).user as JwtPayload;
    const senderId = payload.userId;

    if (!Types.ObjectId.isValid(senderId)) {
      throw new BadRequestException('Invalid senderId');
    }
    if (!Types.ObjectId.isValid(body.receiverId)) {
      throw new BadRequestException('Invalid receiverId');
    }
    if (!Types.ObjectId.isValid(body.itemId)) {
      throw new BadRequestException('Invalid itemId');
    }
    if (!body.quantity || body.quantity <= 0) {
      throw new BadRequestException('Invalid quantity');
    }

    const { receiverId, itemId, quantity, message } = body;

    // check item exists
    const item = await this.donationService.getItemById(itemId);
    if (!item) throw new BadRequestException('Item not found');

    return this.donationService.donate(
      senderId,
      receiverId,
      itemId,
      quantity,
      message,
    );
  }

  @Get('received')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getReceivedGifts(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.donationService.getReceivedGifts(payload.userId);
  }

  @Get('sent')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getSentGifts(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.donationService.getSentGifts(payload.userId);
  }

  @Patch('mark-read')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async markAsRead(
    @Req() req: Request,
    @Body() body: { donationIds?: string[]; id?: string },
  ) {
    const payload = (req as any).user as JwtPayload;

    const ids = body.donationIds || (body.id ? [body.id] : []);
    if (!ids.length) throw new BadRequestException('donationIds is required');

    // optional: validate ids format
    const invalid = ids.find((x) => !Types.ObjectId.isValid(x));
    if (invalid) throw new BadRequestException('Invalid donationId');

    return this.donationService.markAsRead(payload.userId, ids);
  }
}
