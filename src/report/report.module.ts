// report.module.ts
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ReportController } from './report.controller'
import { ReportService } from './report.service'
import { Report, ReportSchema } from '../schemas/Report.schema'
import { UserModule } from '../user/user.module'  // Import UserModule to provide UserModel

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
    UserModule,  // Import UserModule here to provide UserModel
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
