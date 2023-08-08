import config from "config";
import { Express } from "express";
import http from "http";
import AuthService from "./auth";
import CustomersService from "./customers";
import { secureExpress, useCtx } from "./utils";

export default class Services {
  private static internalApp: Express;
  public static internalServer: http.Server;
  public static Auth: AuthService;
  public static Customers: CustomersService;

  static async init() {
    console.log("Initializing application services...");

    Services.internalApp = secureExpress();

    useCtx(Services.internalApp);

    Services.Auth = await new AuthService().init(Services.internalApp);
    Services.Customers = await new CustomersService().init(
      Services.internalApp
    );

    const port = config.get<string>("server.port");

    this.internalServer = Services.internalApp.listen(port, () => {
      console.log(`Internal server listening on port ${port}`);
    });

    console.log("Finished initializing application services...");
  }
}
