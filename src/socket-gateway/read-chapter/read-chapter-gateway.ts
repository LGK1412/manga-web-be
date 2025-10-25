import { MessagePattern } from '@nestjs/microservices';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway(4001, { cors: { origin: '*' } })
export class ReadChapterGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;

    // // Lưu danh sách group + danh sách client ID
    private groups: Record<string, Set<string>> = {};

    // handleConnection(client: Socket) {
    //     console.log('New User Connection', client.id);
    //     client.emit('connected', { message: 'Connected to WebSocket Server' });
    // }

    handleDisconnect(client: Socket) {
        console.log('User Disconnected', client.id);

        // Xóa client khỏi tất cả group nó đang ở
        for (const [groupName, members] of Object.entries(this.groups)) {
            if (members.has(client.id)) {
                members.delete(client.id);
                // this.server.to(groupName).emit('user-left', {
                //     message: `User left ${groupName}`,
                //     userId: client.id,
                // });

                // Nếu group trống → xóa group
                if (members.size === 0) {
                    delete this.groups[groupName];
                    // console.log(`Group ${groupName} deleted (empty)`);
                }
            }
        }
        // console.log(this.groups);
    }

    // @SubscribeMessage('newMessage')
    // handleNewMessage(@MessageBody() message: any) {
    //     const { text, sender, group } = message;
    //     if (!group) {
    //         // nếu không có group thì gửi broadcast toàn server
    //         this.server.emit('message', message);
    //     } else {
    //         // gửi trong group
    //         this.server.to(group).emit('message', {
    //             text, sender
    //         });
    //     }
    // }

    @SubscribeMessage('join-group')
    handleJoinGroup(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
        // console.log('Join group payload:', payload);

        const { url } = payload;

        // tách group từ url — ví dụ http://localhost:3001/chapter/100 → chapter-100
        const match = url.match(/chapter\/([A-Za-z0-9]+)/);
        if (!match) return;

        const groupName = `chapter-${match[1]}`;

        // nếu group chưa có thì tạo mới
        if (!this.groups[groupName]) {
            this.groups[groupName] = new Set();
        }

        // thêm user vào group
        this.groups[groupName].add(client.id);
        client.join(groupName);

        // console.log(
        //     `User ${client.id} joined ${groupName} (${this.groups[groupName].size} users)`
        // );

        this.server.to(groupName).emit('user-joined', {
            groupName: groupName,
        });

        // gửi danh sách group hiện có (debug)
        // client.emit('groups-list', this.getGroupInfo());
        // console.log(this.getGroupInfo());
        // console.log(this.groups);
    }

    // // Hàm helper: trả về danh sách group + số lượng người
    private getGroupInfo() {
        return Object.entries(this.groups).map(([name, members]) => ({
            name,
            count: members.size,
        }));
    }

    handleConnection(client: Socket) {
        console.log('New User Connection', client.id);
        // client.emit('connected', { message: 'Connected to WebSocket Server' });
    }

    // handleDisconnect(client: Socket) {
    //     console.log('User Disconnection', client.id);
    //     client.emit('disconnected', { message: 'Disconnected to WebSocket Server' });
    // }

    @SubscribeMessage('new-reply')
    handleNewReply(@MessageBody() data: { chapterId: string, commentId: string, groupName: string }) {
        // Emit tới tất cả client trong group (chapter) ngoại trừ người gửi
        // console.log(data);
        this.server.to(data.groupName).emit('refresh-reply', data);
        this.server.emit('refresh-reply1', data);
        // console.log(data);
    }

    @SubscribeMessage('new-comment')
    handleNewComment(@MessageBody() data: { groupName: string }){
        this.server.to(data.groupName).emit('refresh-comment')
    }
}
