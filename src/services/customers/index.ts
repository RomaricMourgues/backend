import { Express, Router } from "express";
import { default as Framework, default as platform } from "../../platform";
import { Logger } from "../../platform/logger-db";
import { InternalContext } from "../../types";
import { InternalApplicationService } from "../types";
import { CustomersTableName } from "./entities/customers";
import registerRoutes from "./routes";
import { getPublicCustomer } from "./services/customer";

export default class Customers implements InternalApplicationService {
  version = 1;
  name = "customers";
  private logger: Logger;

  async init(server: Express) {
    const router = Router();
    registerRoutes(router);
    server.use(`/${this.name}/v${this.version}`, router);

    const ledger = await platform.Db.getService();
    ledger.createTable(CustomersTableName, []);

    this.logger = Framework.LoggerDb.get("customers");

    console.log(`${this.name}:v${this.version} initialized`);
    return this;
  }

  async getPublicCustomer(
    ctx: InternalContext,
    query: {
      id?: string;
      email?: string;
      phone?: string;
    }
  ) {
    this.logger.info(ctx, "get-public");
    return await getPublicCustomer(
      ctx,
      query.id as string,
      query.email as string,
      query.phone as string
    );
  }
}
