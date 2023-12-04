import Arena from '@colyseus/arena';
import { monitor } from '@colyseus/monitor';
import { MikroORM } from '@mikro-orm/core';
import { RequestContext } from '@mikro-orm/core';
import express from 'express';

const logger = require('./helpers/logger');

import { MMORoom } from './old-rooms/MMORoom';
import { MMOPwRoom } from './rooms/MMOPwRoom';
import {createRoom} from './createRoom';
import {listRoom} from './listRoom';
import {createRoomV2} from './createRoomV2';
import {listRoomV2} from './listRoomV2';

export default Arena({
    getId: () => 'Your Colyseus App',

    initializeGameServer: (gameServer) => {
        gameServer.define('toryworld', MMORoom).filterBy(['roomID']);
        gameServer.define('toryworld-pw', MMOPwRoom).filterBy(['roomID']);
    },

    initializeExpress: (app) => {

        app.use(express.json());
        app.use(express.urlencoded({ extended: true, limit: '10kb' }));

        const wrapAsyncController = (fn:any)=>{
            return async (req:express.Request, res:express.Response, next: express.NextFunction) => {
                console.log(req.method, req.url);
                console.log(req.body);
                await fn(req, res).catch(next);
            };
        };

        app.get('/', (req:express.Request, res:express.Response) => { res.send('index'); });

        //app update 시간과 서버 업데이트 시간과의 차이로 인해 metabus-v3 / metabus-v4 로 분기
        //port 3700
        app.post('/metabus-v3/room/create', wrapAsyncController(createRoom));
        app.post('/metabus-v3/room/list', wrapAsyncController(listRoom));

        //port 3800
        app.post('/metabus-v4/room/create', wrapAsyncController(createRoomV2));
        app.post('/metabus-v4/room/list', wrapAsyncController(listRoomV2));

        app.use('/metabus-v3/colyseus', monitor());

        app.use((req:express.Request, res:express.Response, next: express.NextFunction) => { next(); });
        app.use((err: unknown, req:express.Request, res:express.Response, next: express.NextFunction) => {
            logger.error(err);
            console.log(err);
            res.status(500).json({ resultCode:'SERVER_ERROR', resultMessage: '알 수 없는 에러가 발생하였습니다.' });
        });
    },

    beforeListen: () => {
    }
});
