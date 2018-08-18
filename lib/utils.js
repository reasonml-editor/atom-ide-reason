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
    "bsb",
    "env",
    "esy",
    "ocamlfind",
    "ocamlmerlin",
    "opam",
    "rebuild",
    "refmt",
    "refmterr",
    "rtop",
];
function flatten1(array) {
    return [].concat(...array);
}
function readFile(file) {
    try {
        if (fs.existsSync(file)) {
            return cjson.load(file);
        }
    }
    catch (e) {
        console.error(e);
    }
    return null;
}
exports.readFile = readFile;
function readPerProjectConfig(file) {
    const configFromFile = readFile(file);
    if (!configFromFile || !configFromFile.toolchainPath) {
        return configFromFile;
    }
    let configFromPath = { ols: { path: {} } };
    const toolchainPaths = flatten1([configFromFile.toolchainPath]);
    delete configFromFile.toolchainPath;
    for (const toolname of toolkeys) {
        for (const toolchainPath of toolchainPaths) {
            if (fs.existsSync(path.join(toolchainPath, toolname))) {
                configFromPath.ols.path[toolname] = path.join(toolchainPath, toolname);
                break;
            }
        }
    }
    return deepmerge_1.default(deepmerge_1.default({}, configFromPath), configFromFile);
}
exports.readPerProjectConfig = readPerProjectConfig;
function capitalize(str) {
    if (!str) {
        return str;
    }
    return str[0].toUpperCase() + str.slice(1);
}
exports.capitalize = capitalize;
