import { Module } from '@nestjs/common';
import { AuthorPayoutProfileService } from './author-payout-profile.service';
import { AuthorPayoutProfileController } from './author-payout-profile.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthorPayoutProfile, AuthorPayoutProfileSchema } from 'src/schemas/author-payout-profile.schema';
import { AuthorPayoutProfileHistory, AuthorPayoutProfileHistorySchema } from 'src/schemas/author-payout-profile-history.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: AuthorPayoutProfile.name, schema: AuthorPayoutProfileSchema },
    { name: AuthorPayoutProfileHistory.name, schema: AuthorPayoutProfileHistorySchema }
  ]
  )],
  controllers: [AuthorPayoutProfileController],
  providers: [AuthorPayoutProfileService],
})
export class AuthorPayoutProfileModule { }
