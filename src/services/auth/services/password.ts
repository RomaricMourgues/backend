import config from "config";
import jwt from "jsonwebtoken";
import { InternalContext } from "../../../types";
import { AuthValidationJwtPayload } from "../types";

export const verifyPassword = async (
  ctx: InternalContext,
  body: { email?: string; phone?: string; code: string }
): Promise<any> => {
  let user = null;

  if (!user || !user.mfas.find((mfa) => mfa.type === "password")) {
    throw Error("Invalid password");
  }

  const challenge = user.mfas.find((mfa) => mfa.type === "password").value;

  if (!challenge) {
    throw Error("Invalid password");
  }

  //check password is ok for user
  //if ((await getOrVerifyHash(body.code, challenge)) !== true) {
  //  throw Error("Invalid password");
  //}

  return {
    success: true,
    type: "password",
    validation_token: jwt.sign(
      {
        type: "password",
        email: body.email,
        phone: body.phone,
      } as AuthValidationJwtPayload,
      config.get<string>("jwt.secret"),
      { expiresIn: 60 * 30 }
    ),
  };
};
