import { createLogger, format, transports, Logger, LeveledLogMethod } from 'winston';
import chalk from 'chalk';

const { printf } = format;

const customLevels = {
  error: 0,
  warn: 1,
  menu: 2,
  info: 2,
  debug: 3
};

const printer = printf(info => {
  let level: string;
  switch (info.level) {
    case 'debug':
      level = chalk.whiteBright.bgBlue(`${info.level}`);
      break;
    case 'info':
      level = chalk.whiteBright.bgGreen(`${info.level} `);
      break;
    case 'warn':
      level = chalk.whiteBright.bgRgb(195, 105, 0)(`${info.level} `);
      break;
    case 'error':
      level = chalk.whiteBright.bgRed(`${info.level}`);
      break;
    default:
      break;
  }
  return `${level} ${info.message}`;
});

export const logger = createLogger({
  levels: customLevels,
  format: printer,
  transports: [new transports.Console()]
}) as Logger & Record<keyof typeof customLevels, LeveledLogMethod>;
