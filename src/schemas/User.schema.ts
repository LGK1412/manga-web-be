import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'

export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    AUTHOR = 'author',
}

export enum UserStatus {
    BAN = 'ban',
    NORMAL = 'normal',
    MUTE = 'mute',
}

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true })
    username: string

    @Prop({ unique: true, required: true })
    email: string

    @Prop({ required: false, select: false })
    password: string

    @Prop({ require: false, select: false })
    google_id: string

    @Prop({ require: false })
    date_of_birth: string

    @Prop({
        type: String,
        enum: UserRole,
        default: UserRole.USER
    })
    role: UserRole

    @Prop({
        type: String,
        enum: UserStatus,
        default: UserStatus.NORMAL
    })
    status: UserStatus

    @Prop({ default: false })
    verified: boolean

    @Prop({ required: false })
    verify_email_code: string

    @Prop({ required: false })
    verify_forgot_password_code: string

    @Prop({ required: false, default: 'avatar-default.webp' })
    avatar: string

    @Prop({ type: String, required: false, default: "" })
    bio: string

    @Prop({ type: [{ type: Types.ObjectId, ref: "Manga" }], default: [] })
    favourites: Types.ObjectId[];

    @Prop({ type: [{ type: Types.ObjectId, ref: "User"}], default: []})
    following_authors: Types.ObjectId[];

    @Prop({ required: false, default: 0 })
    point: number;

    @Prop({ required: false, default: 0 })
    author_point: number;

    @Prop({ required: false, default: 0 })
    game_point: number;

    @Prop({
        required: false,
        default: () => {
            const d = new Date();
            d.setMonth(d.getMonth() - 1); // lùi 1 tháng
            return d;
        }
    })
    lastBonus: Date;

    @Prop({ type: [String], required: false })
    device_id: string[]

    @Prop({type: [Types.ObjectId], ref: 'EmojiPack', required: false})
    emoji_packs: Types.ObjectId[]
}

export const UserSchema = SchemaFactory.createForClass(User)

