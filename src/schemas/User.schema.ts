import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    AUTHOR = 'author',
}

export enum UserStatus {
    BAN = 'ban',
    NORMAL = 'normal'
}

@Schema({ timestamps: true })
export class User {
    @Prop({ unique: true, required: true })
    username: string

    @Prop({ unique: true, required: true })
    email: string

    @Prop({ required: false })
    password?: string

    @Prop({ require: false })
    google_id?: string

    @Prop({ require: false })
    date_of_birth?: string

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
}

export const UserSchema = SchemaFactory.createForClass(User)