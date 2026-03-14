import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum TaxSubject {
    AUTHOR = 'AUTHOR',
}

@Schema({ timestamps: true })
export class TaxRule {

    @Prop({ required: true })
    code: string;

    @Prop({ required: true, enum: TaxSubject, default: TaxSubject.AUTHOR })
    subject: TaxSubject;

    @Prop({ required: true, type: Number })
    minPayout: number; // >= minPayout -> rate 

    @Prop({ required: true, type: Number })
    rate: number;

    @Prop({ required: true, type: Date })
    effectiveFrom: Date;

    @Prop({ type: Date, default: null })
    effectiveTo: Date | null;

    @Prop({ type: String })
    legalRef: string;

    @Prop({ default: true })
    isActive: boolean;
}

export type TaxRuleDocument = TaxRule & Document;
export const TaxRuleSchema =
    SchemaFactory.createForClass(TaxRule);

// tax-rule.defaults.ts
export const DEFAULT_TAX_RULE: TaxRule = {
    code: 'DEFAULT_PIT_10',
    subject: TaxSubject.AUTHOR,
    minPayout: 2000000,
    rate: 0.1,
    effectiveFrom: new Date('2013-07-01'),
    effectiveTo: null,
    legalRef: 'TT111/2013 + TT92/2015',
    isActive: true,
};
