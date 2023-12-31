import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { AvatarState } from "./AvatarState";
import { Vector3 } from "../../helpers/Vectors";

export class ChatMessage extends Schema {
    @type("string") entityId: string = "";
    @type("string") message: string = "";
    @type("number") timestamp: number = 0.0;
}

//An array of messages for a user
export class ChatQueue extends Schema {
    @type({ array: ChatMessage }) chatMessages = new ArraySchema<ChatMessage>();
}

export class ChatRoomState extends Schema {
    @type({ map: ChatQueue }) chatQueue = new MapSchema<ChatQueue>();
}

export class NetworkedEntityState extends Schema {
    @type("string") entityId: string = "ID";
    @type("string") chatId: string = "ID";
    //Position
    @type("number") xPos: number = 0.0;
    @type("number") yPos: number = 0.0;
    @type("number") zPos: number = 0.0;
    //Rotation
    @type("number") xRot: number = 0.0;
    @type("number") yRot: number = 0.0;
    @type("number") zRot: number = 0.0;
    @type("number") wRot: number = 0.0;

    @type(AvatarState) avatar: AvatarState = new AvatarState();
    @type("number") coins: number = 0.0;

    //Interpolation values
    @type("number") timestamp: number = 0.0;
    @type("string") username: string = "";
    @type("string") seat: string = "0";
    @type("number") chatRoomHistoryId: number = 0.0;
    @type("number") memberId: number = 0.0;
    @type("boolean") roomMaker: boolean = false;
    @type("number") inputting: number = 0.0;
    @type("string") table: string = "0";
    @type("number") clients: number = 0.0;
    @type("number") maxClients: number = 0.0;
    @type("string") password: string = "";
}

export class InteractableState extends Schema {
    @type("string") id: string = "ID";
    @type("boolean") inUse: boolean = false;
    @type("string") interactableType: string = "";
    @type("number") availableTimestamp: number = 0.0;
    @type("number") coinChange: number = 0.0;
    @type("number") useDuration: number = 0.0;
}

export class ActionState extends Schema {
    @type("string") entityId: string = "ID";
    @type("string") actionId: string = "ID";
}

export class RoomState extends Schema {
    @type({ map: NetworkedEntityState }) networkedUsers = new MapSchema<NetworkedEntityState>();
    @type({ map: InteractableState }) interactableItems = new MapSchema<InteractableState>();
    @type({ map: ChatQueue }) chatQueue = new MapSchema<ChatQueue>();
    @type({ map: ActionState }) action = new MapSchema<ActionState>();

    @type("number") serverTime: number = 0.0;

    getUserPosition(sessionId: string): Vector3 {

        if (this.networkedUsers.has(sessionId)) {

            const user: NetworkedEntityState = this.networkedUsers.get(sessionId);

            return {
                x: user.xPos,
                y: user.yPos,
                z: user.zPos
            };
        }

        return null;
    }

    setUserPosition(sessionId: string, position: Vector3) {
        if (this.networkedUsers.has(sessionId)) {

            const user: NetworkedEntityState = this.networkedUsers.get(sessionId);

            user.xPos = position.x;
            user.yPos = position.y;
            user.zPos = position.z;
        }
    }

    getUserRotation(sessionId: string): Vector3 {

        if (this.networkedUsers.has(sessionId)) {

            const user: NetworkedEntityState = this.networkedUsers.get(sessionId);

            return {
                x: user.xRot,
                y: user.yRot,
                z: user.zRot
            };
        }

        return null;
    }

    getUserAvatarState(sessionId: string): AvatarState {

        if (this.networkedUsers.has(sessionId)) {

            const user: NetworkedEntityState = this.networkedUsers.get(sessionId);
            return user.avatar;
        }

        return null;
    }
}
