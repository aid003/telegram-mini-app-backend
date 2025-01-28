"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var dotenv_1 = __importDefault(require("dotenv"));
var log4js_1 = __importDefault(require("log4js"));
dotenv_1.default.config();
var logger = log4js_1.default.getLogger();
logger.level = process.env.LOG_LEVEL;
// logger.info("log4js log info");
// logger.debug("log4js log debug");
// logger.error("log4js log error");
var app = (0, express_1.default)();
var port = process.env.PORT;
app.get("/", function (request, response) {
    response.send("Hello world!");
});
app.listen(port, function () { return console.log("Running on port ".concat(port)); });
//# sourceMappingURL=index.js.map