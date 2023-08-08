import { InternalContext } from "../../types";
import { PlatformService } from "../types";

type TransactionExecutor = any; //TODO initially that's a type from AWS SDK

export type Condition<T> =
  | Partial<T>
  | {
      [key: string]: string | string[];
    };

export type DbTableIndex = [string, "number" | "string"][];

export type DbComparators = ">" | "<" | "=" | "<=" | ">=" | "begins_with";

export type TransactionOperation<Entity> = {
  operation: "insert" | "update" | "delete";
  ctx: InternalContext;
  table: string;
  document: Entity;
  condition: Condition<Entity>;
};

export interface DbAdapterInterface extends PlatformService {
  createTable(
    name: string,
    primaryIndex: DbTableIndex,
    globalIndexes?: { [key: string]: DbTableIndex }
  ): Promise<void>;

  insert<Entity>(
    ctx: InternalContext,
    table: string,
    document: Entity,
    tnx?: TransactionExecutor
  ): Promise<void>;

  update<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    document: Entity,
    tnx?: TransactionExecutor
  ): Promise<void>;

  select<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    options?: {
      comparator?: DbComparators;
      limit?: number;
      asc?: boolean;
      index?: string;
    }
  ): Promise<Entity[]>;

  selectOne<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean; index?: string; retry?: number }
  ): Promise<Entity>;

  delete<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean },
    tnx?: TransactionExecutor
  ): Promise<void>;

  executeTransaction(tnx: TransactionExecutor): Promise<void>;
  clearTransaction(tnx: TransactionExecutor): Promise<void>;
}
