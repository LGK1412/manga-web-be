import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min } from 'class-validator';

enum KycStatus {
    PENDING = 'pending',
    VERIFIED = 'verified',
    REJECTED = 'rejected',
}

export class ListProfileQueryDto {
    @IsOptional()
    kycStatus?: KycStatus;

    @IsOptional()
    keyword?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}