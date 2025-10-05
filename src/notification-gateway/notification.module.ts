import { Module } from '@nestjs/common';
import { NotificationClient } from './notification.client';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTI_SERVICE',
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3001 },
      },
    ]),
  ],
  providers: [NotificationClient],
  exports: [NotificationClient]
})
export class NotificationModule { }
