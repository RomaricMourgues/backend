import _ from "lodash";
import { InternalContext } from "../../../types";
import { v4 } from "uuid";
import {
  Condition,
  DbAdapterInterface,
  DbComparators,
  DbTableIndex,
  TransactionOperation,
} from "../api";
import { sanitizeCondition, sanitizeDocument } from "../utils";
import { Logger } from "../../../platform/logger-db";
import Framework from "../../../platform";

export default class DbMemory implements DbAdapterInterface {
  private store = {};
  private tablesPrimaryIndex: {
    [key: string]: [string, "number" | "string"][];
  } = {};
  private tablesGlobalIndexes: {
    [key: string]: { [key: string]: [string, "number" | "string"][] };
  } = {};
  private logger: Logger;

  constructor(private database: string) {}

  async init() {
    this.logger = Framework.LoggerDb.get("dynamodb-memory");
    return this;
  }

  async createTable(
    name: string,
    primaryIndex: DbTableIndex,
    globalIndexes?: { [key: string]: DbTableIndex }
  ) {
    this.store[this.database + "." + name] = {
      rows: [],
      indexes: primaryIndex,
    };
    this.tablesPrimaryIndex[name] = primaryIndex;
    this.tablesGlobalIndexes[name] = globalIndexes || {};
  }

  async insert<Entity>(
    ctx: InternalContext,
    table: string,
    document: Entity,
    tnx?: any
  ) {
    if (tnx) {
      return this.addToTransaction(tnx, {
        operation: "insert",
        ctx,
        table,
        condition: null,
        document,
      });
    }

    this.logger.info(ctx, "insert on " + table);

    document = sanitizeDocument(document);
    (document as any)._id = v4();
    this.store[this.database + "." + table].rows.push({
      ..._.cloneDeep(document),
    });
  }

  async update<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    document: Entity,
    tnx?: any
  ) {
    if (tnx) {
      return this.addToTransaction(tnx, {
        operation: "update",
        ctx,
        table,
        condition,
        document,
      });
    }

    this.logger.info(ctx, "update on " + table);

    condition = sanitizeCondition(condition);
    condition = _(condition).omitBy(_.isUndefined).value();

    const indexes = this.tablesPrimaryIndex[table];

    this.store[this.database + "." + table].rows = this.store[
      this.database + "." + table
    ].rows.filter(
      (row) => !testConditions(_.pick(condition, indexes[0][0]), row)
    );

    await this.insert(ctx, table, _.cloneDeep(document));
  }

  async select<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    options: {
      comparator?: DbComparators;
      limit?: number;
      asc?: boolean;
      index?: string;
    } = {
      comparator: "=",
      limit: 100,
      asc: true,
    }
  ) {
    condition = sanitizeCondition(condition);
    condition = _(condition).omitBy(_.isUndefined).value();

    this.logger.info(ctx, "select on " + table);

    const indexes = options?.index
      ? this.tablesGlobalIndexes[table][options?.index]
      : this.tablesPrimaryIndex[table];
    const comparator = options.comparator || "=";

    let list = this.store[this.database + "." + table].rows
      .filter((row) =>
        indexes[0][0] !== undefined
          ? testConditions(_.pick(condition, indexes[0][0]), row)
          : true
      )
      .filter((row) => {
        if (!condition[indexes[1][0]]) return true;
        let compare =
          parseFloat(row[indexes[1][0]]) - parseFloat(condition[indexes[1][0]]);
        if (typeof indexes[0][0] === "string") {
          compare = row[indexes[1][0]].localeCompare(
            condition[indexes[1][0]].toString()
          );
        }

        if (comparator === "<") {
          return compare < 0;
        } else if (comparator === ">") {
          return compare > 0;
        } else if (comparator === ">=") {
          return compare >= 0;
        } else if (comparator === "<=") {
          return compare <= 0;
        } else if (comparator === "begins_with") {
          return (
            row[indexes[1][0]]
              .toString()
              .indexOf(condition[indexes[1][0]].toString()) === 0
          );
        } else {
          return compare === 0;
        }
      });
    list.sort((a: any, b: any) => {
      if (options?.asc === false) {
        return b - a;
      } else {
        return a - b;
      }
    });
    list = list.slice(0, options.limit || 100).map((r: any) => r) as Entity[];
    return list;
  }

  async selectOne<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean; index?: string }
  ) {
    const list = await this.select<Entity>(ctx, table, condition, {
      index: options?.index,
    });
    if (!list || list.length === 0) return null;
    if (list.length > 1 && !options?.ignoreSingleCheck) {
      throw new Error(
        "Multiple results found when only 1 was expected (memory)"
      );
    }
    return list[0];
  }

  async delete<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean },
    tnx?: any
  ) {
    if (tnx) {
      return this.addToTransaction(tnx, {
        operation: "delete",
        ctx,
        table,
        condition,
        document: null,
      });
    }

    this.logger.info(ctx, "delete on " + table);

    await this.selectOne<Entity>(ctx, table, condition, options);

    condition = sanitizeCondition(condition);
    condition = _(condition).omitBy(_.isUndefined).value();

    const indexes = this.tablesPrimaryIndex[table];

    this.store[this.database + "." + table].rows = this.store[
      this.database + "." + table
    ].rows.filter((row) =>
      testConditions(_.pick(condition, indexes[0][0]), row)
    );
  }

  private transactions = new Map<string, TransactionOperation<any>[]>();

  async addToTransaction<Entity>(
    tnx: any | string,
    operation: TransactionOperation<Entity>
  ) {
    const id = typeof tnx === "string" ? tnx : tnx.getTransactionId();
    if (!this.transactions.has(id)) {
      this.transactions.set(id, []);
    }
    this.transactions.get(id).push(operation);
  }

  async clearTransaction(tnx: any | string) {
    const id = typeof tnx === "string" ? tnx : tnx.getTransactionId();
    this.transactions.delete(id);
  }

  async executeTransaction(tnx: any | string) {
    const id = typeof tnx === "string" ? tnx : tnx.getTransactionId();
    if (!this.transactions.has(id)) return;
    const operations = this.transactions.get(id);
    for (const operation of operations) {
      switch (operation.operation) {
        case "insert":
          await this.insert(operation.ctx, operation.table, operation.document);
          break;
        case "update":
          await this.update(
            operation.ctx,
            operation.table,
            operation.condition,
            operation.document
          );
          break;
        case "delete":
          await this.delete(
            operation.ctx,
            operation.table,
            operation.condition
          );
          break;
      }
    }
    this.transactions.delete(id);
  }
}

const testConditions = <T>(condition: Condition<T>, row: T) => {
  for (const key in condition) {
    if (typeof condition[key] === "string") {
      if (row[key] !== condition[key]) {
        return false;
      }
    }
    if (Array.isArray(condition[key])) {
      if (!condition[key].includes(row[key])) {
        return false;
      }
    }
  }
  return true;
};
