import cron from "croner";
import shortUUID from "short-uuid";
import { v4 } from "uuid";
import platform from "..";
import { InternalContext } from "../../types";

const CronService = {
  schedule: (
    name: string,
    cronExpression: string,
    callback: (ctx: InternalContext) => void
  ) => {
    cron(
      cronExpression,
      async () => {
        const ctx = {
          req_id: shortUUID().fromUUID(v4()),
          id: "cron",
          role: "SYSTEM",
        } as InternalContext;
        platform.LoggerDb.get("CronService").info(
          ctx,
          `Run cron job '${name}'`
        );
        try {
          callback(ctx);
        } catch (e) {
          platform.LoggerDb.get("CronService").error(
            ctx,
            `Error with cron job '${name}': ${e}`,
            e
          );
          platform.LoggerDb.flush();
        }
      },
      {
        name,
        timezone: "Europe/Oslo",
      }
    );
  },
};

export default CronService;
