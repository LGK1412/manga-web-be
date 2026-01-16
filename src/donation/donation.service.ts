import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DonationItem, DonationItemDocument } from "src/schemas/donation-item.schema";
import { Donation, DonationDocument } from "src/schemas/donation.shema";
import { User, UserDocument } from "src/schemas/User.schema";

@Injectable()
export class DonationService {
  constructor(
    @InjectModel(DonationItem.name)
    private readonly donationItemModel: Model<DonationItemDocument>,

    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    private eventEmitter: EventEmitter2
  ) { }

  private async checkUser(id: string) {
    const existingUser = await this.userModel.findOne({ _id: id });
    if (!existingUser) {
      throw new BadRequestException('User does not exist');
    }
    if (existingUser.role != "user" && existingUser.role != "author") {
      throw new BadRequestException('User does not have permission');
    }
    if (existingUser.status == "ban") {
      throw new BadRequestException('User does not have permission');
    }
    return existingUser;
  }

  async getItemById(itemId: string) {
    return this.donationItemModel.findById(itemId);
  }

  async getAllDonationItems(options?: {
    onlyAvailable?: boolean;
    rarity?: string;
  }) {
    const filter: Record<string, any> = {};

    if (options?.onlyAvailable) filter.isAvailable = true;
    if (options?.rarity) filter.rarity = options.rarity;

    const items: DonationItem[] = await this.donationItemModel
      .find(filter)
      .sort({ price: 1 })
      .lean()
      .exec();

    if (!items || items.length === 0) {
      throw new NotFoundException("No donation items found");
    }

    return items;
  }

  async donate(
    senderId: string,
    receiverId: string,
    itemId: string,
    quantity: number,
    message?: string,
  ) {
    if (senderId === receiverId)
      throw new BadRequestException('Cannot send gift to yourself');

    const item = await this.donationItemModel.findById(itemId);
    if (!item || !item.isAvailable)
      throw new NotFoundException('Item is not available');

    if (quantity < 1) throw new BadRequestException('Invalid quantity');

    const sender = await this.checkUser(senderId);
    const receiver = await this.userModel.findById(receiverId);
    if (!receiver) throw new NotFoundException('Receiver not found');

    const totalPrice = item.price * quantity;

    if (sender.point < totalPrice)
      throw new ForbiddenException('Insufficient points to send gift');

    sender.point -= totalPrice;
    await sender.save();

    const platformFeeRate = 0.2;
    const platformFee = Math.floor(totalPrice * platformFeeRate);
    const receivedAuthorPoint = totalPrice - platformFee;

    receiver.author_point = (receiver.author_point || 0) + receivedAuthorPoint;
    await receiver.save();

    const donation = await this.donationModel.create({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      itemId: new Types.ObjectId(itemId),
      quantity,
      totalPrice,
      message,
      isRead: false,
    });

    // Emit
    this.eventEmitter.emit("donation_spend_count", { userId: senderId, amount: totalPrice })

    return {
      success: true,
      message: `Sent ${quantity}x ${item.name} to ${receiver.username}. Receiver received ${receivedAuthorPoint.toLocaleString()} points.`,
      data: donation,
    };
  }

  async getReceivedGifts(receiverId: string) {
    await this.checkUser(receiverId);
    const receiverObjectId = new Types.ObjectId(receiverId);

    const donations = await this.donationModel
      .find({ receiverId: receiverObjectId })
      .populate('senderId', 'username avatar')
      .populate('itemId', 'name price image rarity')
      .sort({ createdAt: -1 })
      .lean();

    return donations.map((donation) => ({
      _id: donation._id,
      sender: donation.senderId,
      item: donation.itemId,
      quantity: donation.quantity,
      message: donation.message,
      isRead: donation.isRead,
      sendAt: donation.createdAt,
      totalPrice: donation.totalPrice,
    }));
  }

  async getSentGifts(senderId: string) {
    await this.checkUser(senderId);
    const senderObjectId = new Types.ObjectId(senderId);

    const donations = await this.donationModel
      .find({ senderId: senderObjectId })
      .populate({
        path: 'receiverId',
        select: 'username avatar',
      })
      .populate({
        path: 'itemId',
        select: 'name price image rarity',
        model: 'DonationItem',
      })
      .sort({ createdAt: -1 })
      .lean();

    return donations.map((donation) => {
      const item: any = donation.itemId || {};

      return {
        _id: donation._id,
        receiver: donation.receiverId,
        item,
        quantity: donation.quantity,
        totalPrice: donation.quantity * item.price,
        sendAt: donation.createdAt,
        message: donation.message,
        isRead: donation.isRead,
      };
    });
  }

  async markAsRead(receiverId: string, donationIds?: string[]) {
    await this.checkUser(receiverId);
    const filter: any = { receiverId: new Types.ObjectId(receiverId), isRead: false };
    if (donationIds && donationIds.length > 0) {
      filter._id = { $in: donationIds.map((id) => new Types.ObjectId(id)) };
    }

    const result = await this.donationModel.updateMany(filter, { $set: { isRead: true } });

    return {
      updated: result.modifiedCount,
      message: result.modifiedCount > 0 ? 'Gifts marked as read' : 'No new gifts to mark',
    };
  }

}
