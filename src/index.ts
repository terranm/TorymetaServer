import { listen } from "@colyseus/arena";
import arenaConfig from "./arena.config";
import path from "path";
import { config } from "dotenv";

config({ path: path.join(__dirname, "../arena.env") });
listen(arenaConfig);
