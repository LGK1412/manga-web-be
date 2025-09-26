import { IsInt, Min } from 'class-validator';

export class CreatePaymentDto {
    @IsInt()
    packageId: number;

    @IsInt()
    @Min(1000)
    amount: number;
}
