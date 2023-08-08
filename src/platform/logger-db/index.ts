import config from "config";
import _ from "lodash";
import os from "os";
import { InternalContext } from "../../types";
import { PlatformService } from "../types";

const instanceId = _.union(...Object.values(os.networkInterfaces()))
  .map((a) => parseInt(a.mac.replace(/:/gm, ""), 16).toString(36))
  .filter((m) => m !== "0")[0];
const runId = Date.now().toString(36);

export type Logger = {
  error: (context: InternalContext, message: string, more?: any) => void;
  info: (context: InternalContext, message: string, more?: any) => void;
  warn: (context: InternalContext, message: string, more?: any) => void;
};

export default class LoggerDb implements PlatformService {
  private logs: {
    timestamp: number;
    type: string;
    message: string;
    role: string;
    id: string;
    req_id: string;
    more: any;
  }[] = [];
  private flushTimeout;

  async init() {
    return this;
  }

  get(name: string): Logger {
    return {
      error: (context: InternalContext, message: string, more?: any) =>
        this.error(context, `[${name}]` + " " + message, more),
      info: (context: InternalContext, message: string, more?: any) =>
        this.info(context, `[${name}]` + " " + message, more),
      warn: (context: InternalContext, message: string, more?: any) =>
        this.warn(context, `[${name}]` + " " + message, more),
    };
  }

  info(context: InternalContext, message: string, more?: any) {
    this.logs.push({
      timestamp: Date.now(),
      type: "info",
      message,
      role: context.role,
      id: context.id,
      req_id: context.req_id,
      more: more,
    });

    this.flush();
  }

  warn(context: InternalContext, message: string, more?: any) {
    this.logs.push({
      timestamp: Date.now(),
      type: "warn",
      message,
      role: context.role,
      id: context.id,
      req_id: context.req_id,
      more: more,
    });

    this.flush();
  }

  error(context: InternalContext, message: string, more?: any) {
    this.logs.push({
      timestamp: Date.now(),
      type: "error",
      message,
      role: context.role,
      id: context.id,
      req_id: context.req_id,
      more: more,
    });

    this.flush();
  }

  async flush() {
    const clearSensible = (o: string) => {
      if (!o || typeof o !== "string") return o;
      return o.replace(
        /((password|key|secret|cvv|ccv|number|phone)[^"]*)":"[^"]+"/gim,
        '$1":"***"'
      );
    };

    //Clear logs from anything looking like a password
    try {
      this.logs = this.logs.map((log) => {
        log.message = log.message
          ? JSON.parse(clearSensible(JSON.stringify(log.message)))
          : log.message;
        log.more = log.more
          ? JSON.parse(clearSensible(JSON.stringify(log.more)))
          : log.more;
        return log;
      });
    } catch (e) {
      console.error(e);
    }

    if (this.logs.length > 0) {
      const lastLog = this.logs[this.logs.length - 1];
      console.log(
        new Date().toISOString(),
        " - ",
        lastLog.req_id || "",
        `[${lastLog.role}]`,
        lastLog.message,
        lastLog.more || ""
      );
    }

    clearTimeout(this.flushTimeout);
    if (this.logs.length > 0) {
      this.flushTimeout = setTimeout(() => {
        this.flush();
      }, 1000 * 10);
    }

    if (
      this.logs.length < 1 ||
      (this.logs.length < 100 &&
        this.logs[0].timestamp > Date.now() - 1000 * 10)
    ) {
      return;
    }

    const logs = this.logs;
    this.logs = [];

    for (const log of logs) {
      //TODO: Save to an external log database for instance
    }
  }
}
