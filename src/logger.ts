import log4js, { Logger } from 'log4js';

function getLayout(pattern: string) {
  return {
    type: 'pattern',
    pattern,
    tokens: {
      timestamp: function (logEvent) {
        return logEvent.startTime
          .toISOString()
          .replace('T', ' ')
          .replace('Z', '')
          .replace('.', ',');
      },
      component: function (logEvent) {
        return logEvent.context?.component || 'general';
      }
    }
  };
}

function initLogger(logLevelConsole = 'info', logLevelFile = 'info', logFile: string | undefined = undefined) {

  let appenders: { [name: string]: log4js.Appender } = {
    console: {
      type: 'console',
      layout: getLayout('%[%x{timestamp} - %p -%] %m')
    },
    filteredConsole: {
      type: 'logLevelFilter',
      level: logLevelConsole,
      appender: 'console'
    }
  };

  let appendersList = ['filteredConsole'];

  if (logFile) {
    appenders = {
      ...appenders,
      file: {
        type: 'file',
        filename: logFile,
        layout: getLayout('%x{timestamp} - %p - %m')
      },
      filteredFile: {
        type: 'logLevelFilter',
        level: logLevelFile,
        appender: 'file'
      }
    };
    appendersList = [...appendersList, 'filteredFile'];
  }

  log4js.configure({
    appenders,
    categories: {
      default: {
        appenders: appendersList,
        level: 'all'
      }
    }
  });

  const logger = log4js.getLogger();

  logger.debug('LOG_LEVEL_CONSOLE=%s', logLevelConsole);
  if (logFile) {
    logger.debug('LOG_FILE=%s', logFile);
    logger.debug('LOG_LEVEL_FILE=%s', logLevelFile);
  }

  process.on('unhandledRejection', (error) => {
    log4js.getLogger().fatal('Unhandled rejection:', error);
  });

  return logger;
}

let logger: Logger | null = null;

export function getLogger() {
  if (logger === null) {
    logger = initLogger(process.env.LOG_LEVEL_CONSOLE, process.env.LOG_LEVEL_FILE, process.env.LOG_FILE);
  }
  return logger;
}
