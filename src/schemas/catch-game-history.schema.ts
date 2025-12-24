// src/game/schemas/catch-game-history.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CatchGameHistoryDocument = CatchGameHistory & Document;

@Schema({ timestamps: true })
export class CatchGameHistory {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true })
    score: number;
}

export const CatchGameHistorySchema = SchemaFactory.createForClass(CatchGameHistory);
