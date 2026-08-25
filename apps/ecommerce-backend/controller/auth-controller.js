"use strict";
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
exports.googleAuth = void 0;
const DB_1 = require("../data/DB");
const axios_1 = __importDefault(require("axios"));
const googleAPI_1 = require("../utils/googleAPI");
const googleAuth = (code) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const googleRes = yield googleAPI_1.oauth2Client.getToken(code);
        googleAPI_1.oauth2Client.setCredentials(googleRes.tokens);
        const userRes = yield axios_1.default.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', { headers: { Authorization: `Bearer ${googleRes.tokens.access_token}` } });
        const query = `
                SELECT userid,username,email,mobile_number,dob FROM "users" WHERE email = $1;
            `;
        const values = [userRes.data.email];
        const result = yield DB_1.client.query(query, values);
        return result.rows[0];
    }
    catch (error) {
        return false;
    }
});
exports.googleAuth = googleAuth;
