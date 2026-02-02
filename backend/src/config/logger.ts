import pino, { type LoggerOptions } from 'pino';
import { envConfig } from './environmentalVariables.js';

const { node_env, log_level } = envConfig;

const getLogLevel = (): pino.Level => {
  if (log_level) return log_level as pino.Level;
  
  switch (node_env) {
    case 'production': return 'warn';
    case 'test': return 'error';
    default: return 'debug';
  }
};

// 1. Create a function that returns ONLY the configuration object
export const getLoggerConfig = (): LoggerOptions => {
  const config: LoggerOptions = {
    level: getLogLevel(),
  };
  
  if (node_env === 'development') {
    config.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    };
  }
  
  return config;
};

// 2. Export the instance for manual use: logger.info("message")
export const logger = pino(getLoggerConfig());