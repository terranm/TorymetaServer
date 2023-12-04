"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const arena_1 = require("@colyseus/arena");
const arena_config_1 = __importDefault(require("./arena.config"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = require("dotenv");
dotenv_1.config({ path: path_1.default.join(__dirname, "../arena.env") });
arena_1.listen(arena_config_1.default);
