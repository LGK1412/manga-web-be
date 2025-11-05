import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { sendNotificationDto } from 'src/comment/dto/sendNoti.dto';

@Injectable()
export class NotificationClient {
    constructor(@Inject('NOTI_SERVICE') private readonly notiClient: ClientProxy) { }

    async sendNotification(pushNotification: sendNotificationDto) {
        return await firstValueFrom(this.notiClient.send({ cmd: 'push-noti' }, pushNotification));
    }

    async sendGetNotiForUser(id: string) {
        return await firstValueFrom(this.notiClient.send({ cmd: 'get-all-noti-for-user' }, id));
    }

    async sendGetNotiForSender(id: string) {
        return await firstValueFrom(this.notiClient.send({ cmd: 'get-all-noti-for-sender' }, id));
    }// bữa mới thêm vô

    async sendMarkAsRead(id: string, user_id: string) {
        return await firstValueFrom(this.notiClient.send({ cmd: 'mark-as-read' }, { id, user_id }));
    }

    async sendAllMarkAsRead(user_id: string) {
        return await firstValueFrom(this.notiClient.send({ cmd: 'mark-all-as-read' }, { user_id }));
    }

    async deleteNoti(id: string, user_id: string) {
        return await firstValueFrom(this.notiClient.send({ cmd: 'delete-noti' }, { id, user_id }))
    }

    async sendSaveNoti(id: string, user_id: string) {
        return await firstValueFrom(this.notiClient.send({ cmd: 'save-noti' }, { id, user_id }));
    }
}
