import { Router } from "express";
import platform from "../../platform";
import { checkRole, Ctx } from "../utils";
import {
  getPublicCustomer,
  getSelf,
  updatePreferences,
} from "./services/customer";

export default (router: Router) => {
  router.get("/status", (req, res) => {
    res.json("ok");
  });

  const contactIPMap = new Map<string, number>();

  router.post("/contact-us", checkRole("NOTHING"), async (req, res) => {
    const ctx = Ctx.get(req)?.context;
    if (!req.body.title || !req.body.message) {
      res
        .status(400)
        .send({ status: "error", message: "Missing title or message" });
      return;
    }

    const ip = req.ip;
    if (!ip) {
      res.status(400).send({ status: "error", message: "Missing IP" });
      return;
    }

    const count = contactIPMap.get(ip) || 0;
    if (count > 5) {
      res
        .status(400)
        .send({ status: "error", message: "Too many requests from this IP" });
      return;
    }
    contactIPMap.set(ip, count + 1);

    await platform.PushTextMessage.push(ctx, "+33612345678", req.body.message);
    res.send({ status: "ok" });
  });

  router.get("/customers", checkRole("USER"), async (req, res) => {
    const ctx = Ctx.get(req)?.context;
    res.json(
      await getPublicCustomer(
        ctx,
        req.query.id as string,
        req.query.email as string,
        req.query.phone as string
      )
    );
  });

  router.get("/customers/me", checkRole("USER"), async (req, res) => {
    const ctx = Ctx.get(req)?.context;
    res.json(await getSelf(ctx));
  });

  router.post("/customers/preferences", checkRole("USER"), async (req, res) => {
    const ctx = Ctx.get(req)?.context;
    res.json(await updatePreferences(ctx, req.body));
  });
};
