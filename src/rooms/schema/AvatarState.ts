import { Schema, type } from "@colyseus/schema";

export class AvatarState extends Schema {
    @type("string") skinCode: string = "7001";
    @type("string") skinColorCode: string = "#000000";
    @type("string") hairCode: string = "2001";
    @type("string") hairColorCode: string = "#000000";
    @type("string") faceCode: string = "3001";
    @type("string") faceColorCode: string = "#000000";
    @type("string") topCode: string = "4001";
    @type("string") topColorCode: string = "#000000";
    @type("string") bottomCode: string = "5001";
    @type("string") bottomColorCode: string = "#000000";
    @type("string") shoesCode: string = "6001";
    @type("string") shoesColorCode: string = "#000000";
    @type("string") bodyCode: string = "1001";
    @type("string") hatCode: string = "8001";
    @type("string") hatColorCode: string = "#000000";
  }
