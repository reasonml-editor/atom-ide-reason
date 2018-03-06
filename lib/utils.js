"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs-extra"));
function readFileConf(file) {
    try {
        if (fs.existsSync(file)) {
            return fs.readJsonSync(file, { encoding: 'utf-8' });
        }
    }
    catch (e) {
        console.error(e);
    }
    return {};
}
exports.readFileConf = readFileConf;
