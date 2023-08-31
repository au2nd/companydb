const path = require('path')
const puppeteer = require('puppeteer')

const isPkg = typeof process.pkg !== 'undefined'

// mac path replace
let chromiumExecutablePath = isPkg
  ? puppeteer
      .executablePath()
      .replace(
        /^.*?\/node_modules\/puppeteer\/\.local-chromium/,
        path.join(path.dirname(process.execPath), 'chromium')
      )
  : puppeteer.executablePath()

console.log(process.platform)

// check win32
if (process.platform == 'win32') {
  chromiumExecutablePath = isPkg
    ? puppeteer
        .executablePath()
        .replace(
          /^.*?\\node_modules\\puppeteer\\\.local-chromium/,
          path.join(path.dirname(process.execPath), 'chromium')
        )
    : puppeteer.executablePath()
}

module.exports = { isPkg, chromiumExecutablePath }
