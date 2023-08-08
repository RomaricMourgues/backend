import Big from "big.js";
import { v4 } from "uuid";

export const sanitizeDocument = <Entity>(document: Entity) => {
  if (document && typeof document === "object") {
    Object.keys(document).forEach((k) => {
      if (document[k] instanceof Big) {
        document[k] = document[k].toString();
      } else if (typeof document[k] === "object") {
        document[k] = sanitizeDocument(document[k]);
      }
    });
  }

  return document;
};

export const sanitizeCondition = <Entity>(condition: Entity) => {
  return sanitizeDocument(condition);
};

export const getDateUuid = (
  date: Date | number = Date.now(),
  uuid?: string
) => {
  uuid = uuid || v4();
  const dateString = new Date(date).toISOString();
  return `${dateString}#${uuid}`;
};
