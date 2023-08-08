import { Router } from "express";
import { Ctx } from "../utils";
import { checkRole, checkRoleAny } from "../utils";
import { verifyPassword } from "./services/password";
import { requestSmsValidation, verifySmsValidationCode } from "./services/sms";

export default (router: Router) => {
  router.get("/status", (req, res) => {
    try {
      //Fixme: check if the service is up
    } catch (e) {
      res.json({ error: e.message });
      return;
    }
    res.json("ok");
  });

  router.get("/logout", checkRole("USER"), (req, res) => {
    res.json({ success: true });
  });

  router.post(
    "/mfa/methods/:method_id/request",
    checkRoleAny(["NOTHING", "USER"]),
    async (req, res) => {
      const ctx = Ctx.get(req)?.context;
      if (req.params.method_id === "phone") {
        res.json(await requestSmsValidation(ctx, req.body));
      } else {
        throw Error("Invalid MFA method");
      }
    }
  );

  router.post(
    "/mfa/methods/:method_id/validate",
    checkRoleAny(["NOTHING", "USER"]),
    async (req, res) => {
      const ctx = Ctx.get(req)?.context;
      if (req.params.method_id === "phone") {
        res.json(await verifySmsValidationCode(ctx, req.body));
      } else if (req.params.method_id === "password") {
        res.json(await verifyPassword(ctx, req.body));
      } else {
        throw Error("Invalid MFA method");
      }
    }
  );
};
