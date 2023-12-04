import { connection } from "./DBConnection";
const _sqlformat = { language: 'sql', indent: '  ' };
const mybatismapper = require('mybatis-mapper');
mybatismapper.createMapper(['./src/xml/mmo.xml',]);

export class DBManager{

    async commonQuery(sql: string){
        let c = null;
        let res = [];
        try
            {
                c = await connection.getConnection(async (conn:any) => conn);
                res = await c.query(sql);
            }
        catch (err)
            {
                console.error('commonQuery = ', err);
                res = [];
            }
        finally
            {
                try {
                    c.release();
                } catch (err) {
                    console.error('commonQuery = ', err);
                    res = [];
                }
            }

        return res;
    }

    async selectOne(sql: string){
        let res = [];
        res = await this.commonQuery(sql);

        return res.length > 1 ? res[0][0] : [];
    }

    async selectAll(sql: string){
        let res = [];
        res = await this.commonQuery(sql);

        return res.length > 1 ? res[0] : [];
    }

    async excute(sql: string){
        let res = [];
        res = await this.commonQuery(sql);

        return res.length > 1 ? res[0] : [];
    }

    async iCreateRoom(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'iCreateRoom', param, _sqlformat);

        return await this.excute(sql);
    }

    async iJoinRoom(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'iJoinRoom', param, _sqlformat);

        return await this.excute(sql);
    }

    async uJoinUserAddCount(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uJoinUserAddCount', param, _sqlformat);

        return await this.excute(sql);
    }

    async uJoinUserSubtractCount(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uJoinUserSubtractCount', param, _sqlformat);

        return await this.excute(sql);
    }

    async uLeaveRoom(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uLeaveRoom', param, _sqlformat);

        return await this.excute(sql);
    }

    async uChatStopCount(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uChatStopCount', param, _sqlformat);

        return await this.excute(sql);
    }

    async uChatWarningCount(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uChatWarningCount', param, _sqlformat);

        return await this.excute(sql);
    }

    async uRoomAttr(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uRoomAttr', param, _sqlformat);

        return await this.excute(sql);
    }

    async uRoomMaker(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uRoomMaker', param, _sqlformat);

        return await this.excute(sql);
    }

    async uKickStatus(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uKickStatus', param, _sqlformat);

        return await this.excute(sql);
    }

    async uDisposeRoom(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uDisposeRoom', param, _sqlformat);

        return await this.excute(sql);
    }

    async uAcceptStatus(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uAcceptStatus', param, _sqlformat);

        return await this.excute(sql);
    }

    async iInviteHistory(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'iInviteHistory', param, _sqlformat);

        return await this.excute(sql);
    }

    async sInviteHistory(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'sInviteHistory', param, _sqlformat);

        return await this.selectAll(sql);
    }

    async uInviteHistory(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'uInviteHistory', param, _sqlformat);

        return await this.excute(sql);
    }

    async sFriendList(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'sFriendList', param, _sqlformat);

        return await this.selectAll(sql);
    }

    async sOnlineFriendList(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'sOnlineFriendList', param, _sqlformat);

        return await this.selectAll(sql);
    }

    async sOnlineAllList(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'sOnlineAllList', param, _sqlformat);

        return await this.selectAll(sql);
    }

    async sDummyChatRoomList(param: any){
        let sql = mybatismapper.getStatement('mmoRoomMapper', 'sDummyChatRoomList', param, _sqlformat);

        return await this.selectAll(sql);
    }

}
