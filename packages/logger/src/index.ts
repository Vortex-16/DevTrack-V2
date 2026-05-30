import pino from 'pino';

export interface LoggerConfigOptions {
  nodeEnv: string;
  serviceName: string;
  logtailToken?: string | undefined; // Optional — set LOGTAIL_SOURCE_TOKEN to activate
}

/**
 * Returns standard Pino configuration options.
 * In production with LOGTAIL_SOURCE_TOKEN set, logs are shipped to Logtail.
 * In development, logs are pretty-printed to the console.
 */
export function getPinoOptions(options: LoggerConfigOptions): pino.LoggerOptions {
  const isProd = options.nodeEnv === 'production';
  const hasLogtail = isProd && !!options.logtailToken;

  // Production with Logtail: multi-transport — JSON to stdout + ship to Logtail
  if (hasLogtail) {
    return {
      level: 'info',
      base: {
        service: options.serviceName,
        env: options.nodeEnv,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: {
        targets: [
          {
            // Raw JSON to stdout so Railway/Docker can capture it
            target: 'pino/file',
            level: 'info',
            options: { destination: 1 }, // stdout
          },
          {
            // Ship to Logtail (Better Stack)
            target: '@logtail/pino',
            level: 'info',
            options: { sourceToken: options.logtailToken },
          },
        ],
      },
    };
  }

  // Production without Logtail: clean JSON to stdout
  if (isProd) {
    return {
      level: 'info',
      base: {
        service: options.serviceName,
        env: options.nodeEnv,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };
  }

  // Development: pretty-print to console
  return {
    level: 'debug',
    base: {
      service: options.serviceName,
      env: options.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true,
        ignore: 'pid,hostname,service,env',
      },
    },
  };
}

/**
 * Creates a raw Pino logger instance.
 */
export function createLogger(options: LoggerConfigOptions) {
  return pino(getPinoOptions(options));
}
