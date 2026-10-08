#!/usr/bin/env node
/**
 * Read UTF-8 text and strip a leading BOM (PowerShell 5.1 UTF8 writes BOM).
 */
const fs = require('fs');

function stripBom(text) {
  if (!text || text.charCodeAt(0) !== 0xfeff) {
    return text;
  }
  return text.slice(1);
}

function readFileUtf8(filePath) {
  return stripBom(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  stripBom,
  readFileUtf8,
};
