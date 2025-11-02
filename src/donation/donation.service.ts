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
      throw new NotFoundException("Không tìm thấy quà tặng nào");
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
      throw new BadRequestException('Không thể tự tặng quà cho chính mình');

    const item = await this.donationItemModel.findById(itemId);
    if (!item || !item.isAvailable)
      throw new NotFoundException('Vật phẩm không khả dụng');

    if (quantity < 1) throw new BadRequestException('Số lượng không hợp lệ');

    const sender = await this.userModel.findById(senderId);
    const receiver = await this.userModel.findById(receiverId);

    const totalPrice = item.price * quantity;

    if (!sender) throw new NotFoundException('Không tìm thấy người gửi');
    if (!receiver) throw new NotFoundException('Không tìm thấy người nhận');

    if (sender.point < totalPrice)
      throw new ForbiddenException('Không đủ xu để tặng quà');

    sender.point -= totalPrice;
    await sender.save();

    const platformFeeRate = 0.2;
    const platformFee = Math.floor(totalPrice * platformFeeRate);
    const receivedAuthorPoint = totalPrice - platformFee;

    // Cộng điểm cho người nhận
    receiver.author_point = (receiver.author_point || 0) + receivedAuthorPoint;
    await receiver.save();

    // Lưu bản ghi donation
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
      message: `Đã tặng ${quantity}x ${item.name} cho ${receiver.username}. Người nhận nhận được ${receivedAuthorPoint.toLocaleString()} xu.`,
      data: donation,
    };
  }

  async getReceivedGifts(receiverId: string) {
    const receiverObjectId = new Types.ObjectId(receiverId);

    const donations = await this.donationModel
      .find({ receiverId: receiverObjectId })
      .populate('senderId', 'username avatar') // Ai tặng
      .populate('itemId', 'name price image rarity') // Quà gì
      .sort({ createdAt: -1 }) // Mới nhất trước
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
    const filter: any = { receiverId: new Types.ObjectId(receiverId), isRead: false };
    if (donationIds && donationIds.length > 0) {
      filter._id = { $in: donationIds.map((id) => new Types.ObjectId(id)) };
    }

    const result = await this.donationModel.updateMany(filter, { $set: { isRead: true } });

    return {
      updated: result.modifiedCount,
      message: result.modifiedCount > 0 ? 'Đã đánh dấu quà là đã đọc' : 'Không có quà mới để đánh dấu',
    };
  }

}
