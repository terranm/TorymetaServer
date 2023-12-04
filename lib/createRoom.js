"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoom = void 0;
const colyseus_1 = require("colyseus");
function createRoom(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let reqRoomId = req.body.roomId;
        let reqMaxClients = req.body.maxClients == undefined ? 255 : req.body.maxClients;
        console.info("createRoom roomId :", reqRoomId);
        console.info("createRoom reqMaxClients :", reqMaxClients);
        const rooms = yield colyseus_1.matchMaker.query({ name: "toryworld" });
        let isRoomId = 0;
        rooms.forEach((room) => {
            if (room.roomId == reqRoomId) {
                isRoomId = 1;
            }
        });
        let room;
        if (isRoomId < 1) {
            room = yield colyseus_1.matchMaker.createRoom("toryworld", { mode: reqRoomId, maxClients: reqMaxClients });
            room.roomId = reqRoomId;
            room.maxClients = reqMaxClients;
        }
        return res.status(200).json({
            roomId: reqRoomId,
            output: {
                room
            }
        });
    });
}
exports.createRoom = createRoom;
