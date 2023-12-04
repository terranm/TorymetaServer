import { Room, Client, ServerError, matchMaker } from 'colyseus';
import { ChatMessage, ChatRoomState, ChatQueue, InteractableState, NetworkedEntityState, ActionState, RoomState } from './schema/RoomState';
import * as interactableObjectFactory from '../helpers/interactableObjectFactory';
import { Vector, Vector2, Vector3 } from '../helpers/Vectors';
import { AvatarState } from './schema/AvatarState';
import { DBManager } from '../database/DBManager';

const logger = require('../helpers/logger');

export class MMOPwRoom extends Room<RoomState> {

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
    memberIdCreator: number = 0;
    interval: any;

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
        this.memberIdCreator = options.memberId;

        this.service = new DBManager();
        let param = {
            roomId:this.roomId, title:this.title, countMaxJoin:this.maxClients, creatorNick:this.creatorName,
            privateRoom:this.privateRoom ? 1 : 0, chatGroup:this.chatGroup, tableId:this.tableId,
            memberIdCreator:this.memberIdCreator, description:this.description, processId:this.listing.processId
        };

        console.log('onCreate param = ', param);
        const res = await this.service.iCreateRoom(param);
        console.log('onCreate res = ', res.insertId);

        if( res ){ this.chatRoomInsertId = res.insertId; }

        logger.info('*********************** MMO ROOM CREATED ***********************');
        console.log('this.title =', this.title);
        console.log('this.description =', this.description);
        console.log('this.image =', this.image);
        console.log('this.chatGroup =', this.chatGroup);
        console.log('this.creatorName =', this.creatorName);
        console.log('this.privateRoom =', this.privateRoom);
        console.log('[[this.chatRoomInsertId]] =', this.chatRoomInsertId);
        console.log(options);
        logger.info('***********************');

        if(options['roomId'] != null){ this.roomId = options['roomId']; }
        if(options['messageLifetime']){ this.messageLifetime = options['messageLifetime']; }

        this.progress = options['progress'] || '0,0';

        this.setState(new RoomState());
        this.registerForMessages();
        this.setPatchRate(100);

        // Set the Simulation Interval callback
        this.setSimulationInterval(dt => {
            this.state.serverTime += dt;
            this.serverTime += dt;
            this.checkObjectReset();
            //this.schdSendInvite();
        });

        if( this.interval == null ){
            this.interval = setInterval(() => {
                this.schdSendInvite();
            }, 5000);
        }
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
            if( data.roomMaker == true ){
                this.roomMakerId = client.id;
            }else{
                if( this.password !== data.password ){
                    throw new Error("INCORRECT_PASSWORD");
                }
            }
        }

        //채팅라운지에 입장할 경우 : acceptStatus를 수락전에는 0 으로 설정.
        //20230713 비공개방 입장 시 비번 입력으로 수정되어 무조건 1로 설정함. 위에 방 입장 시 비번 검사 프로세스가 있음.
        let param = {
            chatRoomId:this.chatRoomInsertId, memberId:parseInt(data.memberId), memberNick:data.username,
            acceptStatus:1, roomMaker:data.roomMaker ? 1: 0,
            clientId:client.sessionId
        };

        const res = await this.service.iJoinRoom(param);

        //res값이 있고 채팅라운지가 아니라면
        if( res ){
            let ChatRoomRes = null;
            let friendList = null;

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

        let networkedUser = this.state.networkedUsers.get(client.id);

        if( networkedUser.roomMaker && this.clients.length > 0 ){
            let newNetworkedUser = this.state.networkedUsers.get(this.clients[0].id);
            this.roomMakerId = this.clients[0].id;
            this.creatorName = newNetworkedUser.username;

            let param = {
                chatRoomHistoryId:newNetworkedUser.chatRoomHistoryId
            };

            let ChatRoomHistoryRes = await this.service.uRoomMaker(param);
            newNetworkedUser.roomMaker = true;
            this.state.networkedUsers.set(this.clients[0].id, newNetworkedUser);
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

        try{
            clearInterval(this.interval);
        }catch(e){
            console.log('>>>[onDispose] catch this.interval =', this.interval);
        }

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

        this.onMessage('sendKick', (client : Client, message: any) => {
            logger.info('######### sendKick onMessage #########');
            console.log('this.roomId =', this.roomId);
            this.handleKick(client, message);
        });

        this.onMessage('sendPerm', (client : Client, message: any) => {
            logger.info('######### sendPerm onMessage #########');
            console.log('this.roomId =', this.roomId);
            this.handlePerm(client, message);
        });

        this.onMessage('sendChangeRoomAttr', (client : Client, message: any) => {
            logger.info('######### sendChangeRoomAttr onMessage #########');
            console.log('this.roomId =', this.roomId);
            this.handleChangeRoomAttr(client, message);
        });

        this.onMessage('penalty', (client : Client, message: any) => {
            logger.info('######### penalty onMessage #########');
            console.log('this.roomId =', this.roomId);
            this.handlePenalty(client, message);
        });

        this.onMessage('invite', (client : Client, message: any) => {
            logger.info('######### invite onMessage #########');
            this.handleInvite(client, message);
        });

        this.onMessage('findFriend', (client : Client, message: any) => {
            logger.info('######### findFriend onMessage #########');
            this.handleFindFriend(client, message);
        });

        this.onMessage('findParticipant', (client : Client, message: any) => {
            logger.info('######### findParticipant onMessage #########');
            this.handleFindParticipant(client, message);
        });
    }

    async handleFindParticipant(client: Client, message : any){
        logger.info('######### handleFindParticipant #########');

        let participantIds:any[] = [];

        for (let i = 0; i < this.clients.length; i++)
            {
                let networkedUser = this.state.networkedUsers.get(this.clients[i].id);
                participantIds.push(networkedUser.memberId);
            }

        let param: any = {};
        let processIds:any[] = [];

        processIds.push(this.listing.processId);

        Object.assign(param, { processIds:processIds, friendIds:participantIds });

        console.log(param);

        const onlineFriendList = await this.service.sOnlineFriendList(param);
        console.log(onlineFriendList);

        onlineFriendList.forEach((friend:any) =>{

            for (let j = 0; j < this.clients.length; j++)
                {
                    let networkedUser = this.state.networkedUsers.get(this.clients[j].id);
                    if( friend.memberId == networkedUser.memberId && networkedUser.roomMaker ) {
                        friend['roomMaker'] = true;
                    }else {
                        if( friend['roomMaker'] == undefined ){
                            friend['roomMaker'] = false;
                        }

                    }
                }
        });

        if( onlineFriendList.length < 1 ){
            client.send('participantList', {status:'OFFLINE', friendList:[], chatRoomId:this.chatRoomInsertId});
        }else{
            client.send('participantList', {status:'ONLINE', friendList:onlineFriendList, chatRoomId:this.chatRoomInsertId});
        }
    }

    async handleFindFriend(client: Client, message : any){
        logger.info('######### handleFindFriend #########');

        let networkedUser = this.state.networkedUsers.get(client.id);
        let rooms = await matchMaker.query({ name: 'toryworld-pw' });

        let param: any = {};

        Object.assign(param, { memberId:networkedUser.memberId });

        const friendList = await this.service.sFriendList(param);

        let processIds:any[] = [];
        let friendIds:any[] = [];

        rooms.forEach((room) =>{
            if( room.roomId == 'lobby' ) {
                processIds.push(room.processId);
            }
        });

        friendList.forEach((friend: any) =>{ friendIds.push(friend.desti_member_id); });

        if( processIds.length < 1 ){
            return client.send('friendList', {status:'OFFLINE', friendList:[]});
        }

        Object.assign(param, { processIds:processIds, friendIds:friendIds });

        const onlineAllList = await this.service.sOnlineAllList(param);

        onlineAllList.forEach((friend: any) =>{
            if( friend.cnt < 2 ){
                friendIds.push(friend.memberId);
            }
        });

        Object.assign(param, { processIds:processIds, friendIds:friendIds });

        const onlineFriendList = await this.service.sOnlineFriendList(param);

        if( onlineFriendList.length < 1 ){
            client.send('friendList', {status:'OFFLINE', friendList:[]});
        }else{
            client.send('friendList', {status:'ONLINE', friendList:onlineFriendList});
        }
    }

    async handleInvite(client: Client, message : any){
        let character = JSON.parse(message.data);
        console.log("character = ", character);
        let networkedUser = this.state.networkedUsers.get(client.id);
        let rooms = await matchMaker.query({ name: 'toryworld-pw' });

        let processIds:any[] = [];
        let friendIds:any[] = [];

        rooms.forEach((room) =>{ processIds.push(room.processId); });
        character.friendIds.forEach((friend: any) =>{ friendIds.push(friend); });

        console.log('processIds = ', processIds);
        console.log('friendIds = ', friendIds);

        let param = { processIds:processIds, friendIds:friendIds };

        const friendList = await this.service.sOnlineFriendList(param);

        console.log('friendList = ', friendList);

        if( friendList.length < 1 ){
            client.send('inviteResult', {status:'OFFLINE'});
        }else{
            let roomInfo: any = null;
            let res: any = null;
            for(let i = 0; i < friendList.length; i++){
                roomInfo = {
                                processId:friendList[i].processId, clientId:friendList[i].clientId, memberId:friendList[i].memberId,
                                memberIdInviter:networkedUser.memberId,
                                roomId:this.roomId, title:this.title, roomPassword:this.password, privateRoom:this.privateRoom ? 1 : 0,
                                inviterNick:networkedUser.username, inviterImgUrl:friendList[i].imgUrl
                            };
                res = await this.service.iInviteHistory(roomInfo);
                client.send('inviteResult', {status:'ONLINE'});
            }
        }
    }

    async schdSendInvite(){
        console.log('### schdSendInvite ');
        let param = { processId:this.listing.processId };

        const inviteList = await this.service.sInviteHistory(param);

        let roomInfo: any = null;
        let res: any = null;

        if( inviteList.length > 0 ){
            console.log(inviteList);
            for(let i = 0; i < inviteList.length; i++){
                for (let j = 0; j < this.clients.length; j++) {
                    if( inviteList[i].client_id == this.clients[j].id ){
                        console.log(inviteList[i]);
                        this.clients[j].send('receiveInvite', {
                                        status:'ONLINE',
                                        title:inviteList[i].title == undefined ? '' : inviteList[i].title,
                                        roomId:inviteList[i].room_id == undefined ? '' : inviteList[i].room_id,
                                        password:inviteList[i].room_password == undefined ? '' : inviteList[i].room_password,
                                        privateRoom:inviteList[i].private_room ? true : false,
                                        inviterNick:inviteList[i].inviter_nick == undefined ? '' : inviteList[i].inviter_nick,
                                        inviterImgUrl:inviteList[i].inviter_img_url == undefined ? '' : inviteList[i].inviter_img_url
                        });
                        roomInfo = { chatRoomInviteHistoryId : inviteList[i].chat_room_invite_history_id };
                        res = await this.service.uInviteHistory(roomInfo);
                    }
                }
            }

        }
    }

    async handlePenalty(client: Client, message : any){
        let character = JSON.parse(message.data);
        console.log('### handlePenalty = ', character);

        let param = {};

        for (let i = 0; i < this.clients.length; i++) {

            let tempNetworkedUser = this.state.networkedUsers.get(this.clients[i].id);

            if( tempNetworkedUser.memberId == character.memberId ) {
                let newNetworkedUser = this.state.networkedUsers.get(this.clients[i].id);

                param = { chatRoomHistoryId:newNetworkedUser.chatRoomHistoryId };

                let ChatRoomHistoryRes;

                if( character.penaltyType.toUpperCase() == 'W' ){
                    ChatRoomHistoryRes = await this.service.uChatWarningCount(param);
                }else if( character.penaltyType.toUpperCase() == 'S' ){
                    ChatRoomHistoryRes = await this.service.uChatStopCount(param);
                }

                //penaltyType:warning/stop
                this.clients[i].send('penalty', {penaltyType:character.penaltyType, sec:character.sec});

                break;
            }
        }

    }

    async handleChangeRoomAttr(client: Client, message : any){
        let character = JSON.parse(message.data);
        console.log('### handleChangeRoomAttr = ', character);
        this.title = character.title;
        this.description = character.description;
        this.privateRoom = character.privateRoom;

        let param = {
                chatRoomId:this.chatRoomInsertId,
                title:this.title,
                roomDescription:this.description,
                privateRoom:this.privateRoom
            };

        let ChatRoomRes = await this.service.uRoomAttr(param);

    }

    async handlePerm(client: Client, message : any){
        let character = JSON.parse(message.data);
        console.log('### handlePerm = ', character);

        for (let i = 0; i < this.clients.length; i++) {

            let tempNetworkedUser = this.state.networkedUsers.get(this.clients[i].id);

            if( tempNetworkedUser.memberId == character.memberId ) {
                let newNetworkedUserPrev = this.state.networkedUsers.get(this.roomMakerId);
                newNetworkedUserPrev.roomMaker = false;
                this.state.networkedUsers.set(this.roomMakerId, newNetworkedUserPrev);

                console.log('### handlePerm prev this.roomMakerId = ', this.roomMakerId);
                console.log('### handlePerm prev this.creatorName = ', this.creatorName);

                let newNetworkedUserNext = this.state.networkedUsers.get(this.clients[i].id);
                newNetworkedUserNext.roomMaker = true;
                this.roomMakerId = this.clients[i].id;
                this.creatorName = newNetworkedUserNext.username;
                this.state.networkedUsers.set(this.roomMakerId, newNetworkedUserNext);

                console.log('### handlePerm next this.roomMakerId = ', this.roomMakerId);
                console.log('### handlePerm next this.creatorName = ', this.creatorName);

                let param = {
                        chatRoomHistoryId:newNetworkedUserPrev.chatRoomHistoryId
                    };

                let ChatRoomHistoryRes = await this.service.uRoomMaker(param);
                console.log('### handlePerm ChatRoomHistoryRes = ', ChatRoomHistoryRes);

                this.clients[i].send('changePerm', {status:'roomMaker'});

                client.send('changePermResult', {status:'success'});

                break;
            }
        }

    }

    async handleKick(client: Client, message : any){
        let character = JSON.parse(message.data);
        console.log('handleKick = ', character);

        for (let i = 0; i < this.clients.length; i++) {

            let tempNetworkedUser = this.state.networkedUsers.get(this.clients[i].id);

            if( tempNetworkedUser.memberId == character.memberId ) {
                this.clients[i].send('kick', {status:'kick'});
                let newNetworkedUser = this.state.networkedUsers.get(this.clients[i].id);

                console.log('handleKick newNetworkedUser.username = ', newNetworkedUser.username);
                console.log('handleKick newNetworkedUser.memberId = ', newNetworkedUser.memberId);
                console.log('handleKick newNetworkedUser.roomMaker = ', newNetworkedUser.roomMaker);

                let param = {
                        chatRoomHistoryId:newNetworkedUser.chatRoomHistoryId
                    };

                let ChatRoomHistoryRes = await this.service.uKickStatus(param);
                console.log('### handleKick = ', ChatRoomHistoryRes);

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

                if( character.status == 'accept' ){
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
                memberId: character.memberId == undefined ? 1 : character.memberId,
                roomMaker: character.roomMaker == undefined ? false : character.roomMaker,
                inputting: character.inputting == undefined ? 0.0 : character.inputting,
                table: character.table == undefined ? "0" : character.table,
                clients: this.clients.length,
                maxClients: this.maxClients,
                password: character.password == undefined ? "" : character.password
            });

            if (character.avatar != null) {
                newNetworkedUser.avatar = new AvatarState().assign({
                    skinCode: character.avatar.skinCode == undefined ? "7001" : character.avatar.skinCode,
                    skinColorCode: character.avatar.skinColorCode == undefined ? "#000000" : character.avatar.skinColorCode,
                    hairCode: character.avatar.hairCode == undefined ? "2001" : character.avatar.hairCode,
                    hairColorCode: character.avatar.hairColorCode == undefined ? "#000000" : character.avatar.hairColorCode,
                    faceCode: character.avatar.faceCode == undefined ? "3001" : character.avatar.faceCode,
                    faceColorCode: character.avatar.faceColorCode == undefined ? "#000000" : character.avatar.faceColorCode,
                    topCode: character.avatar.topCode == undefined ? "4001" : character.avatar.topCode,
                    topColorCode: character.avatar.topColorCode == undefined ? "#000000" : character.avatar.topColorCode,
                    bottomCode: character.avatar.bottomCode == undefined ? "5001" : character.avatar.bottomCode,
                    bottomColorCode: character.avatar.bottomColorCode == undefined ? "#000000" : character.avatar.bottomColorCode,
                    shoesCode: character.avatar.shoesCode == undefined ? "6001" : character.avatar.shoesCode,
                    shoesColorCode: character.avatar.shoesColorCode == undefined ? "#000000" : character.avatar.shoesColorCode,
                    bodyCode: character.avatar.bodyCode == undefined ? "1001" : character.avatar.bodyCode,
                    hatCode: character.avatar.hatCode == undefined ? "8001" : character.avatar.hatCode,
                    hatColorCode: character.avatar.hatColorCode == undefined ? "#000000" : character.avatar.hatColorCode
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
                memberId: character.memberId == undefined ? 1 : character.memberId,
                roomMaker: character.roomMaker == undefined ? false : character.roomMaker,
                inputting: character.inputting == undefined ? 0.0 : character.inputting,
                table: character.table == undefined ? "0" : character.table,
                clients: this.clients.length,
                maxClients: this.maxClients,
                password: character.password == undefined ? "" : character.password
            });

            if (character.avatar != null) {
                newNetworkedUser.avatar.assign({
                    skinCode: character.avatar.skinCode == undefined ? "7001" : character.avatar.skinCode,
                    skinColorCode: character.avatar.skinColorCode == undefined ? "#000000" : character.avatar.skinColorCode,
                    hairCode: character.avatar.hairCode == undefined ? "2001" : character.avatar.hairCode,
                    hairColorCode: character.avatar.hairColorCode == undefined ? "#000000" : character.avatar.hairColorCode,
                    faceCode: character.avatar.faceCode == undefined ? "3001" : character.avatar.faceCode,
                    faceColorCode: character.avatar.faceColorCode == undefined ? "#000000" : character.avatar.faceColorCode,
                    topCode: character.avatar.topCode == undefined ? "4001" : character.avatar.topCode,
                    topColorCode: character.avatar.topColorCode == undefined ? "#000000" : character.avatar.topColorCode,
                    bottomCode: character.avatar.bottomCode == undefined ? "5001" : character.avatar.bottomCode,
                    bottomColorCode: character.avatar.bottomColorCode == undefined ? "#000000" : character.avatar.bottomColorCode,
                    shoesCode: character.avatar.shoesCode == undefined ? "6001" : character.avatar.shoesCode,
                    shoesColorCode: character.avatar.shoesColorCode == undefined ? "#000000" : character.avatar.shoesColorCode,
                    bodyCode: character.avatar.bodyCode == undefined ? "1001" : character.avatar.bodyCode,
                    hatCode: character.avatar.hatCode == undefined ? "8001" : character.avatar.hatCode,
                    hatColorCode: character.avatar.hatColorCode == undefined ? "#000000" : character.avatar.hatColorCode
                });
            }
        }

        this.state.networkedUsers.set(client.id, newNetworkedUser);

        console.log(this.state.networkedUsers.get(client.id));
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
                    skinCode: state[0],
                    skinColorCode: state[1],
                    hairCode: state[2],
                    hairColorCode: state[3],
                    faceCode: state[4],
                    faceColorCode: state[5],
                    topCode: state[6],
                    topColorCode: state[7],
                    bottomCode: state[8],
                    bottomColorCode: state[9],
                    shoesCode: state[10],
                    shoesColorCode: state[11],
                    bodyCode: state[12],
                    hatCode: state[13],
                    hatColorCode: state[14]
                });
        }else{
            newNetworkedUser.avatar.assign({
                    skinCode: state[0],
                    skinColorCode: state[1],
                    hairCode: state[2],
                    hairColorCode: state[3],
                    faceCode: state[4],
                    faceColorCode: state[5],
                    topCode: state[6],
                    topColorCode: state[7],
                    bottomCode: state[8],
                    bottomColorCode: state[9],
                    shoesCode: state[10],
                    shoesColorCode: state[11],
                    bodyCode: state[12],
                    hatCode: state[13],
                    hatColorCode: state[14]
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
