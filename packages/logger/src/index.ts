import pino from 'pino';

export interface LoggerConfigOptions {
  nodeEnv: string;
  serviceName: string;
}

/**
 * Returns standard Pino configuration options.
 */
export function getPinoOptions(options: LoggerConfigOptions): pino.LoggerOptions {
  const isProd = options.nodeEnv === 'production';

  return {
    level: isProd ? 'info' : 'debug',
    base: {
      service: options.serviceName,
      env: options.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(!isProd
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              ignore: 'pid,hostname,service,env',
            },
          },
        }
      : {}),
  };
}

/**
 * Creates a raw Pino logger instance.
 */
export function createLogger(options: LoggerConfigOptions) {
  return pino(getPinoOptions(options));
}
