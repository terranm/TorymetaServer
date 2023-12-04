"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const arena_1 = __importDefault(require("@colyseus/arena"));
const monitor_1 = require("@colyseus/monitor");
const express_1 = __importDefault(require("express"));
const logger = require("./helpers/logger");
const MMORoom_1 = require("./rooms/MMORoom");
const createRoom_1 = require("./createRoom");
exports.default = arena_1.default({
    getId: () => "Your Colyseus App",
    initializeGameServer: (gameServer) => {
        gameServer.define('toryworld', MMORoom_1.MMORoom).filterBy(["roomID"]);
    },
    initializeExpress: (app) => {
        app.use(express_1.default.json());
        app.use(express_1.default.urlencoded({ extended: true, limit: "10kb" }));
        app.get("/", (req, res) => {
            res.send("index");
        });
        app.post('/metabus-v3/room/create', createRoom_1.createRoom);
        app.use("/metabus-v3/colyseus", monitor_1.monitor());
    },
    beforeListen: () => {
    }
});
