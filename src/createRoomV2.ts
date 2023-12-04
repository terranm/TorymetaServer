import { matchMaker } from 'colyseus';
const logger = require('./helpers/logger');

interface CreateRoomRequest {
    body: {
        roomId?: string;
        maxClients: string;
        title?: string;
        description?: string;
        creatorName?: string;
        image?: string;
        chatGroup?: string;
        tableId?: string;
        memberId: number;
        privateRoom?: number;
        password?: string;
    }
}

export async function createRoomV2(req: CreateRoomRequest, res: any) {
    let reqRoomId = req.body.roomId;
    let reqMaxClients = req.body.maxClients == undefined ? 254 : parseInt(req.body.maxClients);
    let reqTitle = req.body.title == undefined || req.body.title == '' ? '' : req.body.title;
    let reqDescription = req.body.description == undefined || req.body.description == '' ? '' : req.body.description;
    let reqImage = req.body.image == undefined || req.body.image == '' ? '' : req.body.image;
    let reqChatGroup = req.body.chatGroup == undefined || req.body.chatGroup == '' ? '' : req.body.chatGroup;
    let reqTableId = req.body.tableId == undefined || req.body.tableId == '' ? '' : req.body.tableId;
    let reqCreatorName = req.body.creatorName == undefined || req.body.creatorName == '' ? '' : req.body.creatorName;
    let reqMemberId = req.body.memberId == undefined ? 0 : req.body.memberId;
    let reqPrivateRoom = req.body.privateRoom == undefined ? 0 : req.body.privateRoom < 1 ? false : true;
    let reqPassword = req.body.privateRoom == undefined ? 0 : req.body.privateRoom < 1 ? '' : req.body.password;

    const rooms = await matchMaker.query({ name: 'toryworld-pw' });

    let isRoomId = 0;
    const regex = /seminar/gi;

    if( reqChatGroup == '' || reqChatGroup.match(regex) ){
        rooms.forEach((room) =>{
            if( room.roomId == reqRoomId ){
                isRoomId = 1;
            }
        });
    }

    let room;
    if( isRoomId < 1 ){

        reqRoomId = reqChatGroup == '' || reqChatGroup.match(regex) ? reqRoomId : '';

        room = await matchMaker.createRoom('toryworld-pw', {
            mode: reqRoomId,
            maxClients:reqMaxClients,
            title:reqTitle,
            description:reqDescription,
            image:reqImage,
            chatGroup:reqChatGroup,
            tableId:reqTableId,
            creatorName:reqCreatorName,
            memberId:reqMemberId,
            privateRoom:reqPrivateRoom,
            password:reqPassword
        });

        if( reqChatGroup == '' || reqChatGroup.match(regex) ){
            room.roomId = reqRoomId;
            room.maxClients = reqMaxClients;
            room.chatGroup = reqChatGroup;
        }else{
            reqRoomId = room.roomId;
            room.maxClients = reqMaxClients;
            room.title = reqTitle;
            room.description = reqDescription;
            room.image = reqImage;
            room.creatorName = reqCreatorName;
            room.chatGroup = reqChatGroup;
            room.tableId = reqTableId;
            room.privateRoom = reqPrivateRoom;
            room.password = reqPassword;
        }
    }

    logger.debug({roomId:reqRoomId, output:{room}});

    return res.status(200).json( {roomId:reqRoomId, output:{room}} );
}
