import { Role } from '../enums/role.enum';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}