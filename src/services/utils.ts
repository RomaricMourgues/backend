import express, { Express, Request, Response } from "express";
import _ from "lodash";
import shortUUID from "short-uuid";
import { InternalContext } from "src/types";
import { v4 } from "uuid";

export function secureExpress() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _, next) => {
    if (req.headers["content-type"] === "application/x-www-form-urlencoded") {
      req.headers["content-type"] = "application/json";
    }
    next();
  });
  return app;
}

export class Ctx {
  static _bindings = new WeakMap<Request, Ctx>();

  context: InternalContext;

  static bind(req: Request): void {
    const ctx = new Ctx();
    Ctx._bindings.set(req, ctx);
  }

  static get(req: Request): Ctx | null {
    return Ctx._bindings.get(req) || null;
  }
}

export function useCtx(server: Express) {
  server.use((req, _, next) => {
    Ctx.bind(req);
    next();
  });
  server.use((req, _, next) => {
    //Create the default context
    const context: InternalContext = {
      id: "",
      role: "NOTHING",
      ip: req.ip,
      created_at: new Date().getTime(),
      req_id: shortUUID().fromUUID(v4()),
    };

    const ctx = Ctx.get(req);
    ctx.context = context;

    next();
  });
}

export const checkRoleAny =
  (roles: InternalContext["role"][]) =>
  (req: Request, _res: Response, next: () => void) => {
    //If one of the requested role is SYSAGENT then SYSADMIN can also operate
    if (roles.includes("SYSAGENT")) roles = _.uniq([...roles, "SYSADMIN"]);

    //If one of the requested role is USER then SYSAGENT and SYSADMIN can also operate
    if (roles.includes("USER"))
      roles = _.uniq([...roles, "SYSAGENT", "SYSADMIN"]);

    //NOTHING role can be impersonated by USER
    if (roles.includes("NOTHING")) roles = _.uniq([...roles, "USER"]);

    //USER role can be impersonated by API
    if (roles.includes("USER")) roles = _.uniq([...roles, "API"]);

    const ctx = Ctx.get(req)?.context;
    if (!ctx) {
      throw Error("No context found");
    }
    if (roles.indexOf(ctx.role) < 0) {
      throw Error(
        `Expected role is one of [${roles.join(",")}], but got ${ctx.role}`
      );
    }
    next();
  };

export const checkRole = (role: InternalContext["role"]) =>
  checkRoleAny([role]);
