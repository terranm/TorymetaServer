import { Room, Client, ServerError, matchMaker } from 'colyseus';
import { ChatMessage, ChatRoomState, ChatQueue, InteractableState, NetworkedEntityState, ActionState, RoomState } from './schema/RoomState';
import * as interactableObjectFactory from '../helpers/interactableObjectFactory';
import { Vector, Vector2, Vector3 } from '../helpers/Vectors';
import { AvatarState } from './schema/AvatarState';
import { DBManager } from '../database/DBManager';

const logger = require('../helpers/logger');

export class MMORoom extends Room<RoomState> {

    progress: string;
    defaultObjectReset: number = 5000;
    messageLifetime: number = 5000;
    serverTime: number = 0;
    title: string;
    description: string;
    image: string;
    chatGroup: string;
    tableId: string;
    creatorName: string;
    password: string;
    privateRoom: boolean = false;
    roomMakerId: string;
    readyClients: Client[] = [];
    service: DBManager;
    chatRoomInsertId: number = 0;
    memberId: number = 0;

    async onCreate(options: any) {
        if( options.mode !== '' ){ this.roomId = options.mode; }
        this.maxClients = options.maxClients;
        this.autoDispose = true;
        this.title = options.title;
        this.description = options.description;
        this.image = options.image;
        this.chatGroup = options.chatGroup;
        this.tableId = options.tableId;
        this.creatorName = options.creatorName;
        this.privateRoom = options.privateRoom;
        this.password = options.password;
        this.memberId = options.memberId;

        this.service = new DBManager();
        let param = {
            roomId:this.roomId, title:this.title, countMaxJoin:this.maxClients, creatorNick:this.creatorName,
            privateRoom:this.privateRoom ? 1 : 0, chatGroup:this.chatGroup, tableId:this.tableId,
            memberIdCreator:this.memberId, description:this.description
        };
        console.log('onCreate param = ', param);
        const res = await this.service.iCreateRoom(param);
        logger.info(res);
        console.log('onCreate res = ', res.insertId);

        if( res ){
            this.chatRoomInsertId = res.insertId;
        }

        logger.info('*********************** MMO ROOM CREATED ***********************');
        console.log('this.title =', this.title);
        console.log('this.description =', this.description);
        console.log('this.image =', this.image);
        console.log('this.chatGroup =', this.chatGroup);
        console.log('this.creatorName =', this.creatorName);
        console.log('this.privateRoom =', this.privateRoom);
        console.log('this.chatRoomInsertId =', this.chatRoomInsertId);
        console.log(options);
        logger.info('***********************');

        if(options['roomId'] != null){ this.roomId = options['roomId']; }
        if(options['messageLifetime']){ this.messageLifetime = options['messageLifetime']; }

        this.progress = options['progress'] || '0,0';

        this.setState(new RoomState());
        this.registerForMessages();
        this.setPatchRate(50);

        // Set the Simulation Interval callback
        /*this.setSimulationInterval(dt => {
            this.state.serverTime += dt;
            this.checkObjectReset();
        });*/
    }

    async onJoin(client: Client, characterInfo: any, auth: any) {
        logger.info('>>>>>>>>>> onJoin - ');
        console.log('client.sessionId =', client.sessionId);
        console.log(characterInfo.data);
        console.log('this.roomId =', this.roomId);
        console.log('this.title =', this.title);
        console.log('this.description =', this.description);
        console.log('this.image =', this.image);
        console.log('this.chatGroup =', this.chatGroup);
        console.log('this.creatorName =', this.creatorName);
        console.log('this.privateRoom =', this.privateRoom);
        console.log('this.roomMakerId =', this.roomMakerId);

        let emptyChatQueue = new ChatQueue();
        this.state.chatQueue.set(client.sessionId, emptyChatQueue);
        this.state.action.set(client.sessionId, new ActionState());
        this.handleNewPosition(client, characterInfo);

        let data = JSON.parse(characterInfo.data);

        //privateRoom이 true 일 때만 roomMaker인지 아닌지 구분. 수락/거절을 구현해야하므로
        if( this.privateRoom == true ){
            console.log('this.privateRoom data = ', data);
            if( data.roomMaker === true ){
                this.roomMakerId = client.id;
            }else{
                //비밀방일 경우 방장에게 수락 요청 메세지를 보냄.
                for (let i = 0; i < this.clients.length; i++) {
                    if( this.clients[i].id == this.roomMakerId ) {
                        this.clients[i].send('invite', {reqClientId:client.id, reqUsername:data.username});
                        this.readyClients.push(client);
                    }
                }

                console.log('readyClients.length = ', this.readyClients);

            }
        }

        //채팅라운지에 입장할 경우 : acceptStatus를 수락전에는 0 으로 설정.
        let param = {
            chatRoomId:this.chatRoomInsertId, memberId:parseInt(data.memberId), memberNick:data.username,
            acceptStatus:this.privateRoom == true && data.roomMaker == false ? 0 : 1, roomMaker:data.roomMaker ? 1: 0,
            clientId:client.sessionId
        };

        const res = await this.service.iJoinRoom(param);

        //res값이 있고 채팅라운지가 아니라면
        if( res ){
            let ChatRoomRes = null;

            //채팅라운지라면 CHAT_ROOM.count_join 값 업데이트.
            if( this.privateRoom == false || (this.privateRoom == true && data.roomMaker == true) ){
                ChatRoomRes = await this.service.uJoinUserAddCount(param);
            }

            let newNetworkedUser = this.state.networkedUsers.get(client.id);
            newNetworkedUser.chatRoomHistoryId = res.insertId;
            this.state.networkedUsers.set(client.id, newNetworkedUser);
        }

    }

    async onLeave(client: Client, consented: boolean) {
        logger.info('-------- onLeave - ');
        console.log('onLeave - ',client.sessionId);
        console.log('this.roomId =', this.roomId);

        for (let i = 0; i < this.readyClients.length; i++) {
            if( this.readyClients[i].id == client.id ) {
                console.log('delete this.readyClients[i] =', this.readyClients[i]);
                console.log('delete client.id =', client.id);
                delete this.readyClients[i];
                break;
            }
        }

        let newAction = this.state.action.get(client.id);
        let newNetworkedUser = this.state.networkedUsers.get(client.id);

        if( newAction != undefined ){ this.state.action.delete(client.sessionId); }
        if( newNetworkedUser != undefined ){
            let param = {
                chatRoomHistoryId:newNetworkedUser.chatRoomHistoryId,
                chatRoomId:this.chatRoomInsertId
            };
            let ChatRoomHistoryRes = await this.service.uLeaveRoom(param);
            let ChatRoomRes = await this.service.uJoinUserSubtractCount(param);
            this.state.networkedUsers.delete(client.sessionId);
        }
    }

    async onDispose() {
        logger.info('######## onDispose - ');
        console.log('this.roomId =', this.roomId);
        let param = {
                chatRoomId:this.chatRoomInsertId
            };
        const res = await this.service.uDisposeRoom(param);
        console.log('room', this.roomId, 'disposing...');
    }

    onEntityUpdate(clientID: string, data: any) {

        if (this.state.networkedUsers.has(`${data[0]}`) === false) {
            logger.info(`Attempted to update client with id ${data[0]} but room state has no record of it`);
            return;
        }

        let stateToUpdate = this.state.networkedUsers.get(data[0]);
        let startIndex = 1;

        for (let i = startIndex; i < data.length; i += 2) {
            const property = data[i];
            let updateValue = data[i + 1];
            if (updateValue === 'inc') {
                updateValue = data[i + 2];
                i++; // inc i once more since we had a inc;
            }

            (stateToUpdate as any)[property] = updateValue;
        }

        stateToUpdate.timestamp = parseFloat(this.state.serverTime.toString());
    }

    registerForMessages() {
        this.onMessage('entityUpdate', (client, entityUpdateArray) => {
            if (this.state.networkedUsers.has(`${entityUpdateArray[0]}`) === false) return;
            this.onEntityUpdate(client.id, entityUpdateArray);
        });

        this.onMessage('objectInteracted', (client, objectInfoArray) => {
            logger.info('######### objectInteracted onMessage #########');
        });

        this.onMessage('transitionArea', (client: Client, transitionData: Vector[]) => {
            logger.info('######### transitionArea onMessage #########');
        });

        this.onMessage('avatarUpdate', (client: Client, state: any) => {
            logger.info('######### avatarUpdate onMessage #########');
            this.handleAvatarUpdate(client, state);
        });

        this.onMessage('sendChat', (client: Client, message: any) =>{
            logger.info('######### sendChat onMessage #########');
            console.log('this.roomId =', this.roomId);
            //console.log(message);
            this.handleNewMessage(client,message);
        });

        this.onMessage('action', (client : Client, message: any) => {
            logger.info('######### action onMessage #########');
            console.log('this.roomId =', this.roomId);
            this.handleNewAction(client, message);
        });

        this.onMessage('entrance', (client: Client, message: any) =>{
            logger.info('######### entrance onMessage #########');
            console.log('this.roomId =', this.roomId);
            this.handleEntrance(client,message);
        });

        this.onMessage('kick', (client : Client, message: any) => {
            logger.info('######### kick onMessage #########');
            console.log('this.roomId =', this.roomId);
            this.handleKick(client, message);
        });
    }

    async handleKick(client: Client, message : any){
        let character = JSON.parse(message.data);
        console.log('handleKick = ', character);

        for (let i = 0; i < this.clients.length; i++) {
            if( this.clients[i].id == character.clientId ) {
                this.clients[i].send('kick', {status:'kick'});
                break;
            }
        }

    }

    async handleEntrance(client: Client, message : any){
        let character = JSON.parse(message.data);
        console.log('handleEntrance = ', character);
        console.log(this.readyClients.length);
        console.log(this.clients);
        for (let i = 0; i < this.readyClients.length; i++) {
            if( this.readyClients[i].id == character.clientId ) {
                this.readyClients[i].send('inviteResult', {result:character.status});
                let newNetworkedUser = this.state.networkedUsers.get(this.readyClients[i].id);
                console.log('handleEntrance newNetworkedUser =', newNetworkedUser);

                if( character.status == 'accept'){
                    let param = {
                        chatRoomHistoryId:newNetworkedUser.chatRoomHistoryId,
                        acceptStatus:1
                    };

                    let ChatRoomHistoryRes = await this.service.uAcceptStatus(param);
                    console.log('### handleEntrance = ', ChatRoomHistoryRes);
                }
                delete this.readyClients[i];
                break;
            }
        }

        this.readyClients = this.readyClients.filter((a) => a);
    }

    handleNewPosition(client: Client, message: any){
        logger.info('### handleNewPosition ###');
        let character = JSON.parse(message.data);
        let newNetworkedUser = this.state.networkedUsers.get(client.id);

        if( newNetworkedUser == undefined ){

            newNetworkedUser = new NetworkedEntityState().assign({
                entityId: client.id,
                chatId: character.chatId == undefined ? "ID" : character.chatId,
                xPos: character.xPos == undefined ? 0.0 : character.xPos,
                yPos: character.yPos == undefined ? 0.0 : character.yPos,
                zPos: character.zPos == undefined ? 0.0 : character.zPos,
                xRot: character.xRot == undefined ? 0.0 : character.xRot,
                yRot: character.yRot == undefined ? 0.0 : character.yRot,
                zRot: character.zRot == undefined ? 0.0 : character.zRot,
                wRot: character.wRot == undefined ? 0.0 : character.wRot,
                coins: character.coins == undefined ? 0.0 : character.coins,
                timestamp: this.state.serverTime,
                username: character.username == undefined ? "Nick" : character.username,
                seat: character.seat == undefined ? "0" : character.seat,
                chatRoomHistoryId: 1, //초기값은 1
                memberId: character.memberId == undefined ? 1 : character.memberId
            });

            if (character.avatar != null) {
                newNetworkedUser.avatar = new AvatarState().assign({
                    skinColor: character.avatar.skinColor == undefined ? "100_11" : character.avatar.skinColor,
                    shirtColor: character.avatar.shirtColor == undefined ? "default" : character.avatar.shirtColor,
                    pantsColor: character.avatar.pantsColor == undefined ? "default" : character.avatar.pantsColor,
                    hatColor: character.avatar.hatColor == undefined ? "default" : character.avatar.hatColor,
                    hatChoice: character.avatar.hatChoice == undefined ? "default" : character.avatar.hatChoice
                });
            }
        }else{
            newNetworkedUser.assign({
                entityId: client.id,
                chatId: character.chatId == undefined ? "ID" : character.chatId,
                xPos: character.xPos == undefined ? 0.0 : character.xPos,
                yPos: character.yPos == undefined ? 0.0 : character.yPos,
                zPos: character.zPos == undefined ? 0.0 : character.zPos,
                xRot: character.xRot == undefined ? 0.0 : character.xRot,
                yRot: character.yRot == undefined ? 0.0 : character.yRot,
                zRot: character.zRot == undefined ? 0.0 : character.zRot,
                wRot: character.wRot == undefined ? 0.0 : character.wRot,
                coins: character.coins == undefined ? 0.0 : character.coins,
                timestamp: this.state.serverTime,
                username: character.username == undefined ? "Nick" : character.username,
                seat: character.seat == undefined ? "0" : character.seat,
                chatRoomHistoryId: 1, //초기값은 1
                memberId: character.memberId == undefined ? 1 : character.memberId
            });

            if (character.avatar != null) {
                newNetworkedUser.avatar.assign({
                    skinColor: character.avatar.skinColor == undefined ? "100_11" : character.avatar.skinColor,
                    shirtColor: character.avatar.shirtColor == undefined ? "default" : character.avatar.shirtColor,
                    pantsColor: character.avatar.pantsColor == undefined ? "default" : character.avatar.pantsColor,
                    hatColor: character.avatar.hatColor == undefined ? "default" : character.avatar.hatColor,
                    hatChoice: character.avatar.hatChoice == undefined ? "default" : character.avatar.hatChoice
                });
            }
        }

        this.state.networkedUsers.set(client.id, newNetworkedUser);
    }

    async handleNewAction(client: Client, message : any){
        let character = JSON.parse(message.data);

        let newAction = new ActionState().assign({
            entityId: client.id,
            actionId: character.actionId
        });

        this.state.action.set(client.sessionId, newAction);

    }

    handleNewMessage(client: Client, message: any){
        let newChatMessage = new ChatMessage().assign({
            entityId: client.sessionId,
            message: message,
            timestamp: this.serverTime + this.messageLifetime
        });

        this.placeMessageInQueue(client, newChatMessage);
    }

    checkObjectReset() {
        this.state.interactableItems.forEach((state: InteractableState) => {
            if (state.inUse && state.availableTimestamp <= this.state.serverTime) {
                state.inUse = false;
                state.availableTimestamp = 0.0;
            }
        });
    }

    handleAvatarUpdate(client: Client, state: any) {
        let newNetworkedUser = this.state.networkedUsers.get(client.id);

        if( newNetworkedUser == undefined ){
            newNetworkedUser.avatar = new AvatarState().assign({
                    skinColor: state[0],
                    shirtColor: state[1],
                    pantsColor: state[2],
                    hatColor: state[3],
                    hatChoice: state[4]
                });
        }else{
            newNetworkedUser.avatar.assign({
                    skinColor: state[0],
                    shirtColor: state[1],
                    pantsColor: state[2],
                    hatColor: state[3],
                    hatChoice: state[4]
                });
        }

        this.state.networkedUsers.set(client.id, newNetworkedUser);
    }

    placeMessageInQueue(client:Client, newChatMessage : ChatMessage){
        logger.info('placeMessageInQueue start');
        let modifiedTimestamp = newChatMessage.timestamp;
        let chatQueue : ChatQueue = this.state.chatQueue.get(client.id);

        chatQueue.chatMessages.forEach((chatMessage) =>{
            if(chatMessage.entityId === client.id){
                let diff = modifiedTimestamp - chatMessage.timestamp;
                if(diff < this.messageLifetime){
                    modifiedTimestamp = chatMessage.timestamp + this.messageLifetime;
                }
            }
        });

        chatQueue.chatMessages.push(newChatMessage);
        logger.info('placeMessageInQueue end');
    }

    pruneMessages(){
        this.state.chatQueue.forEach((queue, id) =>{
            queue.chatMessages.forEach((message, index)=>{
                if(this.serverTime >= message.timestamp){
                    queue.chatMessages.splice(index, 1);
                }
            });
        });
    }
}
