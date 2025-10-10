import { PartialType } from '@nestjs/mapped-types';
import { CreateWithdrawDto } from './create-withdraw.dto';

export class UpdateWithdrawDto extends PartialType(CreateWithdrawDto) {}
