
import { parseStruct, Module } from 'ts-file-parser';

// const tsFileStruct = require("ts-file-parser")
const fs = require("fs")

export function parseFile(filePath: string): Module {
    const decls = fs.readFileSync(filePath).toString();
    const jsonStructure: Module = parseStruct(decls, {}, "");
    return jsonStructure;
}