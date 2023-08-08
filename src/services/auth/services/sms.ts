import config from "config";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { InternalContext } from "../../../types";
import platform from "../../../platform";
import { AuthValidationJwtPayload } from "../types";

export const requestSmsValidation = async (
  ctx: InternalContext,
  body: { phone: string; captcha_validation?: string }
): Promise<any> => {
  let randomDigits = `${Math.floor(100000 + Math.random() * 900000)}`;
  const phone = (body.phone || "").replace(/[^0-9+]/gm, "").toLocaleLowerCase();

  if (!body.phone) {
    throw Error("Phone number is required");
  }

  //Verify there is a captcha validation if user isn't logged in
  //if (!(await platform.Captcha.verify(ctx, body.captcha_validation))) {
  //  throw Error("Captcha validation failed for unlogged user");
  //}

  const message = `MW-${randomDigits}`;

  if (process.env.NODE_ENV === "development" && phone.startsWith("+000000")) {
    randomDigits = phone.slice(phone.length - 6, phone.length);
    console.log("Dev SMS OTP for", phone, "is", randomDigits);
  } else {
    platform.PushTextMessage.push(ctx, phone, message, "HelloWorld");
  }

  const expire = new Date().getTime() + 1000 * 60 * 30;

  const token = jwt.sign(
    {
      token: crypto
        .createHash("sha256")
        .update(
          randomDigits.toString() +
            body.phone +
            expire +
            config.get<string>("jwt.secret")
        )
        .digest("base64"),
      phone: body.phone,
      expire,
    },
    config.get<string>("jwt.secret"),
    { expiresIn: 60 * 60 }
  );

  return {
    token,
    expire,
    success: true,
  };
};

export const verifySmsValidationCode = async (
  ctx: InternalContext,
  body: { phone: string; code: string; token: string; expire: number }
): Promise<any> => {
  body.code = body.code.replace(/[^0-9]/gm, "");

  const tokenInJwt = jwt.verify(
    body.token,
    config.get<string>("jwt.secret")
  ) as {
    token: string;
    expire: number;
    phone: string;
  };

  const token = crypto
    .createHash("sha256")
    .update(
      body.code +
        tokenInJwt.phone +
        tokenInJwt.expire +
        config.get<string>("jwt.secret")
    )
    .digest("base64");

  if (body.expire < new Date().getTime()) {
    throw Error("Challenge expired");
  }

  if (token !== tokenInJwt.token) {
    throw Error("Invalid code");
  }

  return {
    success: true,
    type: "phone",
    validation_token: jwt.sign(
      { type: "phone", phone: tokenInJwt.phone } as AuthValidationJwtPayload,
      config.get<string>("jwt.secret"),
      { expiresIn: 60 * 30 }
    ),
  };
};
