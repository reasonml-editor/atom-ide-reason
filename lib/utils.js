"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const deepmerge_1 = __importDefault(require("deepmerge"));
const cjson = __importStar(require("cjson"));
const toolkeys = [
    "bsb", "bsc", "env", "esy", "ocamlfind", "ocamlmerlin", "opam", "rebuild", "refmt", "refmterr", "rtop"
];
function flatten1(array) {
    return [].concat(...array);
}
function parseConf(conf, property = "toolchainPath") {
    if (!conf || !conf[property]) {
        return conf;
    }
    let confFromPath = { path: {} };
    const toolchainPaths = flatten1([conf[property]]);
    delete conf[property];
    for (const toolname of toolkeys) {
        for (const toolchainPath of toolchainPaths) {
            if (fs.existsSync(path.join(toolchainPath, toolname))) {
                if (confFromPath.path) {
                    confFromPath.path[toolname] = path.join(toolchainPath, toolname);
                }
                break;
            }
        }
    }
    return deepmerge_1.default(deepmerge_1.default({}, confFromPath), conf);
}
function readFileConf(file) {
    try {
        if (fs.existsSync(file)) {
            const conf = cjson.load(file);
            return parseConf(conf);
        }
    }
    catch (e) {
        console.error(e);
    }
    return {};
}
exports.readFileConf = readFileConf;
function capitalize(str) {
    if (!str) {
        return str;
    }
    return str[0].toUpperCase() + str.slice(1);
}
exports.capitalize = capitalize;
