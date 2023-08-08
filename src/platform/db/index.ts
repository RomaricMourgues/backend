import { PlatformService } from "../types";
import config from "config";
import { DbAdapterInterface } from "./api";
import DbMemory from "./adapters/memory";
//import DbDynamo from "./adapters/dynamo";

export default class Db implements PlatformService {
  private service: { [key: string]: DbAdapterInterface } = {};

  async init() {
    return this;
  }

  async getService(options?: { sandbox?: boolean }) {
    const database: string = options?.sandbox
      ? config.get<string>("db.sandbox_database")
      : config.get<string>("db.database");

    if (!this.service[database]) {
      if (config.get<string>("db.type") === "dynamo") {
        console.log("DB: Using Dynamo");
        //        this.service[database] = await new DbDynamo(database).init();
      } else {
        console.log("DB: Using Memory");
        this.service[database] = await new DbMemory(database).init();
      }
    }

    return this.service[database];
  }
}
