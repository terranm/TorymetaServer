"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logIn = exports.signUp = exports.prepEmail = void 0;
const database_config_1 = require("../config/database.config");
const UserEntity_1 = require("../entities/UserEntity");
const logger_1 = __importDefault(require("../helpers/logger"));
const matchmakerHelper = __importStar(require("../helpers/matchmakerHelper"));
const Vectors_1 = require("../helpers/Vectors");
const util_1 = require("util");
const bcrypt = require('bcrypt');
const saltRounds = 10;
// Middleware
//===============================================
/**
 * Forces the email to be all lower case for consistency
 */
function prepEmail(req, res, next) {
    if (req.body.email) {
        try {
            req.body.email = req.body.email.toLowerCase();
        }
        catch (err) {
            logger_1.default.error(`Error converting email to lower case`);
        }
    }
    next();
}
exports.prepEmail = prepEmail;
//===============================================
/**
 * Update the user for a new room session; updates user's pending session Id and resets their position and rotation
 * @param user The user to update for the new session
 * @param sessionId The new session Id
 */
function updateUserForNewSession(user, sessionId) {
    user.pendingSessionId = sessionId;
    user.pendingSessionTimestamp = Date.now();
    user.updatedAt = new Date();
    user.position = new Vectors_1.Vector3(0, 1, 0);
    user.rotation = new Vectors_1.Vector3(0, 0, 0);
}
/**
 * Simple function for creating a new user account.
 * With successful account creation the user will be matchmaked into the first room.
 * @param req
 * @param res
 * @returns
 */
function signUp(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('aaaaa');
        try {
            logger_1.default.debug(`signUp - ${util_1.inspect(req.body)}`);
            // Check if the necessary parameters exist
            if (!req.body.username || !req.body.email || !req.body.password) {
                logger_1.default.error(`*** Sign Up Error - New user must have a username, email, and password!`);
                throw "New user must have a username, email, and password!";
                return;
            }
            const userRepo = database_config_1.DI.em.fork().getRepository(UserEntity_1.User);
            // Check if an account with the email already exists
            let user = yield userRepo.findOne({ email: req.body.email });
            let seatReservation;
            if (!user) {
                let password = yield encryptPassword(req.body.password);
                // Create a new user
                user = userRepo.create({
                    username: req.body.username,
                    email: req.body.email,
                    password: password
                });
                logger_1.default.debug(`Create a new user - ${util_1.inspect(user)}`);
                // Match make the user into a room
                seatReservation = yield matchmakerHelper.matchMakeToRoom("lobby_room", user.progress);
                updateUserForNewSession(user, seatReservation.sessionId);
                // Save the new user to the database
                yield userRepo.persistAndFlush(user);
            }
            else {
                logger_1.default.error(`*** Sign Up Error - User with that email already exists!`);
                throw "User with that email already exists!";
                return;
            }
            const newUserObj = Object.assign({}, user);
            delete newUserObj.password; // Don't send the user's password back to the client
            res.status(200).json({
                error: false,
                output: {
                    seatReservation,
                    user: newUserObj
                }
            });
        }
        catch (error) {
            res.status(400).json({
                error: true,
                output: error
            });
        }
    });
}
exports.signUp = signUp;
/**
 * Simple function to sign user in.
 * It performs a simple check if the provided password matches in the user account.
 * With a successful sign in the user will be matchmaked into the room where they left off or into the first room.
 * @param req
 * @param res
 */
function logIn(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger_1.default.debug(`logIn - ${util_1.inspect(req.body)}`);
            const userRepo = database_config_1.DI.em.fork().getRepository(UserEntity_1.User);
            // Check if the necessary parameters exist
            if (!req.body.email || !req.body.password) {
                throw "Missing email or password";
                return;
            }
            // Check if an account with the email exists
            let user = yield userRepo.findOne({ email: req.body.email });
            logger_1.default.debug(`logIn - ${util_1.inspect(user)}`);
            // Check if passwords match
            // let validPassword: boolean = await compareEncrypted(req.body.password, user.password);
            // if (!user || validPassword === false) {
            //     throw "Incorrect email or password";
            //     return;
            // }
            if (!user) {
                let password = req.body.email; // await encryptPassword(req.body.password);
                // Create a new user
                user = userRepo.create({
                    username: req.body.username,
                    email: req.body.email,
                    password: password
                });
                logger_1.default.debug(`Create a new user - ${util_1.inspect(user)}`);
                // Save the new user to the database
                yield userRepo.persistAndFlush(user);
            }
            console.log(user);
            // Check if the user is already logged in
            if (user.activeSessionId) {
                logger_1.default.error(`User is already logged in- \"${user.activeSessionId}\"`);
                throw "User is already logged in";
                return;
            }
            // Wait a minimum of 30 seconds when a pending session Id currently exists
            // before letting the user sign in again
            if (user.pendingSessionId && user.pendingSessionTimestamp && (Date.now() - user.pendingSessionTimestamp) <= 30000) {
                let timeLeft = (Date.now() - user.pendingSessionTimestamp) / 1000;
                logger_1.default.error(`Can't log in right now, try again in ${timeLeft} seconds!`);
                throw `Can't log in right now, try again in ${timeLeft} seconds!`;
                return;
            }
            // Match make the user into a room filtering based on the user's progress
            // const seatReservation: matchMaker.SeatReservation = await matchmakerHelper.matchMakeToRoom("lobby_room", user.progress);
            const seatReservation = yield matchmakerHelper.matchMakeToRoom("lobby_room", req.body.roomId);
            updateUserForNewSession(user, seatReservation.sessionId);
            // Save the user updates to the database
            yield userRepo.flush();
            // Don't include the password in the user object sent back to the client
            const userCopy = Object.assign({}, user);
            delete userCopy.password;
            // Send the user data and seat reservation back to the client
            // where the seat reservation can be used by the client to
            // consume the seat reservation and join the room.
            res.status(200).json({
                error: false,
                output: {
                    seatReservation,
                    user: userCopy
                }
            });
        }
        catch (error) {
            res.status(400).json({
                error: true,
                output: error
            });
        }
    });
}
exports.logIn = logIn;
function encryptPassword(password) {
    console.log("Encrypting password: " + password);
    //Encrypt the password
    return bcrypt.hash(password, saltRounds);
}
function compareEncrypted(password, hash) {
    return bcrypt.compare(password, hash);
}
