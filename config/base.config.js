const path = require("path");
const appPath = path.join(__dirname, "../src/web/");
const tsConfigPath = path.join(appPath, "tsconfig.json");
const mainPath = path.join(appPath, "index.ts");
const templatePath = path.join(appPath, "index.html");
const outputPath = path.join(__dirname, "../lib");
const port = 8080;

module.exports = {
  appPath,
  tsConfigPath,
  mainPath,
  templatePath,
  port,
  outputPath,
};
