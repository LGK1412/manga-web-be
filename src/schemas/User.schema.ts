import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

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
}

export const UserSchema = SchemaFactory.createForClass(User)