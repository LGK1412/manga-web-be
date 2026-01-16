import { IsEnum, IsMongoId } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';

export class AdminSetRoleDto {
  @IsMongoId()
  userId: string;

  @IsEnum(Role)
  role: Role;
}
