import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserTransaction, UserTransactionDocument } from 'src/schemas/User-transaction.schema';
import { User, UserDocument } from 'src/schemas/User.schema';

export const PACKAGES = [
    { id: 1, price: 11000, points: 60 },
    { id: 2, price: 33000, points: 180 },
    { id: 3, price: 55000, points: 300 },
    { id: 4, price: 165000, points: 980 },
    { id: 5, price: 250000, points: 1380 },
    { id: 6, price: 350000, points: 1980 },
    { id: 7, price: 550000, points: 3280 },
    { id: 8, price: 1100000, points: 6480 },
];

@Injectable()
export class TopupService {
    constructor(
        @InjectModel(UserTransaction.name) private transactionModel: Model<UserTransactionDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) { }

    async getEffectivePoints(userId: string, packageId: number) {
        const now = new Date();

        // Lấy user để check lastBonus
        const user = await this.userModel.findById(userId).select('lastBonus').lean();
        if (!user) throw new NotFoundException('User not found');

        const lastBonus = user.lastBonus ? new Date(user.lastBonus) : null;

        // Nếu lastBonus là tháng hiện tại => không được bonus
        const isBonus = !lastBonus || lastBonus.getFullYear() !== now.getFullYear() || lastBonus.getMonth() !== now.getMonth();

        const pkg = PACKAGES.find(p => p.id === packageId);
        if (!pkg) throw new NotFoundException('Package not found');

        const points = isBonus ? pkg.points * 2 : pkg.points;

        return { points, isDouble: isBonus };
    }

    async createTransaction(
        userId: string,
        packageId: number,
        price: number,
        points: number,
        paymentUrl?: string,
        txnRef?: string,
    ) {
        if (!Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid userId');
        }

        const tx = await this.transactionModel.create({
            userId: new Types.ObjectId(userId),
            packageId,
            price,
            pointReceived: points,
            status: 'pending',
            paymentUrl,
            txnRef,
        });

        return tx;
    }

    async handlePaymentSuccess(txnRef: string) {
        const transaction = await this.transactionModel.findOne({ txnRef }).populate('userId');
        if (!transaction) throw new NotFoundException('Transaction not found');

        if (transaction.status === 'success') return transaction; // tránh cộng nhiều lần

        // Cập nhật trạng thái transaction
        transaction.status = 'success';
        await transaction.save();

        // Cập nhật point và lastBonus luôn
        await this.userModel.findByIdAndUpdate(transaction.userId, {
            $inc: { point: transaction.pointReceived },
            $set: { lastBonus: new Date() }, // đặt luôn lastBonus = now
        });

        return transaction;
    }

    // ---------------- Bonus tháng ----------------
    async hasMonthlyBonus(userId: string): Promise<{ hasBonus: boolean; lastBonus: Date | null }> {
        if (!Types.ObjectId.isValid(userId)) return { hasBonus: false, lastBonus: null };

        const user = await this.userModel.findById(userId).select('lastBonus').lean();
        if (!user) return { hasBonus: false, lastBonus: null };

        const now = new Date();
        const lastBonus = user.lastBonus ? new Date(user.lastBonus) : null;

        // Nếu lastBonus là tháng hiện tại => đã dùng bonus rồi
        const hasBonus = lastBonus
            ? lastBonus.getFullYear() === now.getFullYear() && lastBonus.getMonth() === now.getMonth()
            : false;

        return { hasBonus, lastBonus };
    }

    // Trả packages + thông tin bonus
    async getPackagesWithBonus(userId: string) {
        const bonusInfo = await this.hasMonthlyBonus(userId);

        const userTransactions = await this.transactionModel.find({
            userId,
            status: 'success',
            createdAt: {
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                $lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59),
            },
        }).lean();

        const hasBonusThisMonth = bonusInfo.hasBonus; // true = đã dùng bonus tháng này

        const packages = PACKAGES.map(pkg => {
            const alreadyBought = userTransactions.some(tx => tx.packageId === pkg.id);
            // còn bonus nếu chưa mua gói nào trong tháng và chưa dùng bonus
            const effectivePoints = !hasBonusThisMonth && !alreadyBought ? pkg.points * 2 : pkg.points;

            return { ...pkg, effectivePoints, alreadyBought };
        });

        return { packages, bonus: bonusInfo };
    }

    async findByTxnRef(txnRef: string): Promise<UserTransactionDocument | null> {
        return this.transactionModel.findOne({ txnRef }).exec();
    }

    async updateStatus(
        id: string,
        status: 'success' | 'failed',
    ): Promise<UserTransactionDocument | null> {
        return this.transactionModel
            .findByIdAndUpdate(
                new Types.ObjectId(id),
                { status, updatedAt: new Date() },
                { new: true },
            )
            .exec();
    }

    async getUserTransactions(userId: string) {
        if (!Types.ObjectId.isValid(userId)) return [];

        return this.transactionModel
            .find({ userId: new Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .select('packageId price pointReceived status txnRef createdAt')
            .lean();
    }
}
