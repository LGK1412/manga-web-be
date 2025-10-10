// src/game/catch-game.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CatchGameHistory, CatchGameHistoryDocument } from 'src/schemas/catch-game-history.schema';
import { User, UserDocument } from 'src/schemas/User.schema';
import { UserService } from 'src/user/user.service';

@Injectable()
export class CatchGameService {
  constructor(
    @InjectModel(CatchGameHistory.name)
    private gameModel: Model<CatchGameHistoryDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) { }

  async saveScore(userId: string, score: number) {
    const newRecord = new this.gameModel({
      userId: new Types.ObjectId(userId),
      score,
    });
    await newRecord.save();
    await this.userModel.updateOne(
      { _id: userId },
      { $inc: { game_point: score } }
    );

    return newRecord;
  }

  async getHistory(userId: string) {
    const [history, best] = await Promise.all([
      this.gameModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(100),
      this.gameModel
        .findOne({ userId: new Types.ObjectId(userId) })
        .sort({ score: -1 })
        .select('score'),
    ]);

    return {
      history,
      bestScore: best ? best.score : 0,
    };
  }

  async getLeaderboard(limit = 10) {
    // Dùng aggregation để nhóm theo user và lấy điểm cao nhất
    const result = await this.gameModel.aggregate([
      {
        $group: {
          _id: "$userId",
          bestScore: { $max: "$score" },
          lastPlayed: { $max: "$createdAt" },
        },
      },
      {
        $sort: { bestScore: -1, lastPlayed: 1 },
      },
      {
        $limit: limit,
      },
      {
        // Join sang bảng users để lấy tên
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          bestScore: 1,
          username: "$user.username",
          lastPlayed: 1,
        },
      },
    ]);

    return result;
  }

  async transferPoint(userId: string, game_pointToConvert: number) {
    // Lấy user hiện tại
    const user = await this.userModel.findById(new Types.ObjectId(userId));
    if (!user) throw new Error("Người dùng không tồn tại");

    // Kiểm tra game_point đủ để chuyển
    if (user.game_point < game_pointToConvert) {
      throw new Error("Không đủ game_point để chuyển đổi");
    }

    // Tính số point sẽ cộng
    const pointsToAdd = game_pointToConvert / 1000;

    // Thực hiện cập nhật
    user.game_point -= game_pointToConvert;
    user.point += pointsToAdd;

    await user.save();

    return {
      game_point: user.game_point,
      point: user.point,
    };
  }



}
