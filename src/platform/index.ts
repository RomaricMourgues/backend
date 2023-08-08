import DbService from "./db";
import LoggerDbService from "./logger-db";
import PushTextMessageService from "./push-text-message";
import CronService from "./cron";

export default class Framework {
  public static Db: DbService;
  public static LoggerDb: LoggerDbService;
  public static PushTextMessage: PushTextMessageService;
  public static Cron: typeof CronService;

  static async init() {
    console.log("Initializing platform services...");
    Framework.LoggerDb = await new LoggerDbService().init();
    Framework.Db = await new DbService().init();
    Framework.PushTextMessage = await new PushTextMessageService().init();
    Framework.Cron = CronService;

    console.log("Finished initializing platform services...");
  }
}
