import { Module } from '@nestjs/common';
import { TopupController } from './topup.controller';
import { TopupService } from './topup.service';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UserTransaction, UserTransactionSchema } from 'src/schemas/User-transaction.schema';
import { UserModule } from 'src/user/user.module';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: '7d' },
        }),
        MongooseModule.forFeature([
            { name: UserTransaction.name, schema: UserTransactionSchema },
        ]),
        UserModule
    ],
    controllers: [TopupController],
    providers: [TopupService],
    exports: [TopupService]
})
export class TopupModule { }
