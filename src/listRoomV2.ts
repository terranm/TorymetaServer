import { matchMaker } from 'colyseus';
import { DBManager } from './database/DBManager';

const logger = require('./helpers/logger');

interface ListRoomRequest {
    body: {
        chatGroup?: string;
        limit:number;
    }
}

export async function listRoomV2(req: ListRoomRequest, res: any, next: Error) {

    const service = new DBManager();

    let reqChatGroup = req.body.chatGroup == undefined || req.body.chatGroup == '' ? '' : req.body.chatGroup;
    let reqLimit = req.body.limit == undefined ? 5 : req.body.limit;
    const rooms = await matchMaker.query({ name: 'toryworld-pw' });

    let tmp:any[] = []; //조건에 맞는 room 객체를 넣을 배열
    let roomListArr:any[] = []; //tmp room 객체에서 필요한 내용만 응답할 데이터를 담을 배열

    rooms.forEach((room) =>{
        logger.debug(room);
        if( room.chatGroup == reqChatGroup ){
            tmp = room.$rooms;
        }
    });

    let i = 0;
    tmp.forEach((room) =>{
        if( room.chatGroup == reqChatGroup ){
            if( i < reqLimit ){

                let date = new Date( Date.parse(room.createdAt) );
                let year = date.getFullYear().toString();
                let month = ("0" + (date.getMonth() + 1)).slice(-2);
                let day = ("0" + date.getDate()).slice(-2);
                let hour = ("0" + date.getHours()).slice(-2);
                let minute = ("0" + date.getMinutes()).slice(-2);
                let second = ("0" + date.getSeconds()).slice(-2);

                let createdAt = year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;

                roomListArr.push({
                    clients:room.clients,
                    locked:room.locked,
                    privateRoom:room.privateRoom,
                    maxClients:room.maxClients,
                    unlisted:room.unlisted,
                    createdAt:createdAt,
                    creatorName:room.creatorName,
                    roomId:room.roomId,
                    password:room.password,
                    title:room.title,
                    description:room.description,
                    image:room.image,
                    chatGroup:room.chatGroup,
                    tableId:room.tableId
                });
                i++;
            }
        }
    });

    const dummyList = await service.sDummyChatRoomList(null);

    dummyList.forEach((dummy: any) =>{
        let date = new Date( Date.parse(dummy.created_time) );
        let year = date.getFullYear().toString();
        let month = ("0" + (date.getMonth() + 1)).slice(-2);
        let day = ("0" + date.getDate()).slice(-2);
        let hour = ("0" + date.getHours()).slice(-2);
        let minute = ("0" + date.getMinutes()).slice(-2);
        let second = ("0" + date.getSeconds()).slice(-2);

        let createdAt = year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;

        roomListArr.push({
            clients:dummy.client,
            locked:true,
            privateRoom:true,
            maxClients:dummy.max_client,
            unlisted:false,
            createdAt:createdAt,
            creatorName:dummy.creator_name,
            roomId:"000000000",
            password:"1234**",
            title:dummy.title,
            description:dummy.description,
            image:dummy.image_url,
            chatGroup:"chat_lounge",
            tableId:dummy.table_id
        });
    });

    let result;
    if( rooms.length < 1 && roomListArr.length < 1 ){
        result = {
            resultCode:'IS_NOT_EXIST_ROOM',
            resultMessage:'방목록이 없습니다.',
            result:{
                rooms:[]
            }
        };
    }else{
        result = {
            resultCode:'0000',
            resultMessage:'',
            result:{
                rooms:roomListArr
            }
        };
    }

    logger.debug(result);

    return res.status(200).json(result);
}
