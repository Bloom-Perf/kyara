import winston from "winston";
import ecsFormat from "@elastic/ecs-winston-format";

export const createLogger = () => winston.createLogger({
  level: 'debug',
  format: ecsFormat({ convertReqRes: true }),
  transports: [
    new winston.transports.Console()
  ]
})