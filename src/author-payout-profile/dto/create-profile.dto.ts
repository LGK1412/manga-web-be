import {
    IsString,
    IsNotEmpty,
    Length,
    IsDateString,
    IsOptional,
    IsArray,
    ArrayMinSize,
    Matches,
    Validate,
} from 'class-validator';
import { IsMinimumAge } from '../validators/min-age.validator';

export class CreateAuthorPayoutProfileDto {
    @IsString()
    @IsNotEmpty()
    @Length(3, 100)
    fullName: string;

    // CCCD VN: 12 số
    @IsString()
    @Matches(/^\d{12}$/)
    citizenId: string;

    @IsDateString()
    @Validate(IsMinimumAge, [16])
    dateOfBirth: string;

    @IsString()
    @IsNotEmpty()
    @Length(5, 255)
    address: string;

    @IsString()
    @IsNotEmpty()
    bankName: string;

    @IsString()
    @Matches(/^\d{6,20}$/)
    bankAccount: string;

    @IsString()
    @IsNotEmpty()
    bankAccountName: string;

    // CCCD front/back → bắt buộc
    // @IsArray()
    // @ArrayMinSize(2)
    // @IsString({ each: true })
    identityImages: string[];
}