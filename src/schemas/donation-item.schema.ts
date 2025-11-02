import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ timestamps: true })
export class DonationItem {
    @Prop({ type: String, required: true, unique: true })
    name: string;

    @Prop({ type: String })
    description?: string;

    @Prop({ type: String, required: true })
    image: string;

    @Prop({ type: Number, required: true, min: 0 })
    price: number;

    @Prop({ type: String, enum: ["common", "rare", "epic", "legendary"], default: "common" })
    rarity: string;

    @Prop({ type: Boolean, default: true })
    isAvailable: boolean;

}

export type DonationItemDocument = DonationItem & Document;
export const DonationItemSchema = SchemaFactory.createForClass(DonationItem)