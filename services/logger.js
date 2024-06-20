const { createLogger, format, transports } = require("winston");
const fs = require("fs");

const logger = createLogger({
  level: "log",
  format: format.combine(
    format.cli(),
    format.printf((info) => {
      const projectPath = __dirname.split("/").slice(0, -1).join("/");
      return `${info.level}: ${info.message} \n${info.stack}`;
      const shortStack = info.stack
        ? `${info.stack.split("\n")[0]} \n ${
            info.stack.split("\n")[1]
          }`.replace(projectPath, "")
        : info.message;
      return `${info.level}: ${shortStack} \n`;
    })
  ),
  defaultMeta: { service: "dankspider" },
  transports: [
    new transports.File({ filename: "./temp/log/error.log", level: "error" }),
    new transports.Console({ level: "info" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.cli(),
    })
  );
}

function deleteLogs() {
  try {
    if (!fs.existsSync("./temp/log")) {
      fs.mkdirSync("./temp/log");
    }

    if (fs.existsSync("./temp/log/errors.log")) {
      fs.unlinkSync("./temp/log/errors.log");
    }

    if (fs.existsSync("./temp/log/warnings.log")) {
      fs.unlinkSync("./temp/log/warnings.log");
    }

    if (fs.existsSync("./temp/log/info.log")) {
      fs.unlinkSync("./temp/log/info.log");
    }
  } catch (error) {
    logger.error(
      "From services/logger/deleteLogs ",
      error,
      "\n",
      error.stack,
      "\n"
    );
  }
}
/*
// ***************
// Allows for parameter-based logging
// ***************

logger.log({
  level: 'info',
  message: `info', 'Pass a message and this works', {
  additional: 'properties',
  are: 'passed along'
});

logger.info('Use a helper method if you want', {
  additional: 'properties',
  are: 'passed along'
});

// ***************
// Allows for string interpolation
// ***************

// info: test message my string {}
logger.log({
  level: 'info',
  message: `info', 'test message %s', 'my string');


// info: test message first second {number: 123}
logger.log({
  level: 'info',
  message: `info', 'test message %s, %s', 'first', 'second', { number: 123 });
*/

module.exports = { logger, deleteLogs };
