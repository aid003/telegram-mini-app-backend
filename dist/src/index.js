"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = __importDefault(require("dotenv"));
var log4js_1 = __importDefault(require("log4js"));
dotenv_1.default.config();
var logger = log4js_1.default.getLogger();
logger.level = process.env.LOG_LEVEL;
// logger.info("log4js log info");
// logger.debug("log4js log debug");
// logger.error("log4js log error");
// const app = express();
// const port = process.env.PORT;
// app.get("/", (request, response) => {
//   response.send("Hello world!");
// });
// app.listen(port, () => console.log(`Running on port ${port}`));
var routing_controllers_1 = require("routing-controllers");
var user_controller_1 = require("controller/user-controller");
var app = (0, routing_controllers_1.createExpressServer)({
    controllers: [user_controller_1.UserController], // we specify controllers we want to use
});
//# sourceMappingURL=index.js.map