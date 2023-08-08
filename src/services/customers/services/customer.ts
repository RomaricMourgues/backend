import { InternalContext } from "../../../types";
import Customers from "../entities/customers";

export const getSelf = async (ctx: InternalContext) => {
  throw new Error("Not implemented");
};

export const getPublicCustomer = async (
  ctx: InternalContext,
  id: string,
  email: string,
  phone: string
) => {
  throw new Error("Not implemented");
};

export const getAvatar = async (_ctx: InternalContext, userId: string) => {
  throw new Error("Not implemented");
};

export const updatePreferences = async (
  ctx: InternalContext,
  body: Partial<Customers["preferences"]>
) => {
  throw new Error("Not implemented");
};
