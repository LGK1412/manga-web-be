import { Role } from '../enums/role.enum';

export interface JwtPayload {
  userId?: string;
  user_id?: string;
  email: string;
  role: Role;
  username?: string;
  avatar?: string;
  bio?: string;
  point?: number;
  author_point?: number;
  locked_point?: number;
  game_point?: number;
  lastBonus?: Date | string | null;
}
