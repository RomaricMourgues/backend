/*import AWS_DynamoDB, {
  AttributeValue,
  DynamoDB,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { TransactionExecutor } from "amazon-qldb-driver-nodejs";
import config from "config";
import _ from "lodash";
import Framework from "../../../platform";
import { Logger } from "../../../platform/logger-db";
import { InternalContext } from "../../../types";
import {
  Condition,
  DbAdapterInterface,
  DbComparators,
  DbTableIndex,
  TransactionOperation,
} from "../api";
import { sanitizeCondition, sanitizeDocument } from "../utils";

export default class DbDynamo implements DbAdapterInterface {
  private driver: DynamoDB;
  private client: DynamoDBDocument;
  private logger: Logger;
  private tablesPrimaryIndex: { [key: string]: DbTableIndex } = {};
  private tablesGlobalIndexes: {
    [key: string]: { [key: string]: [string, "number" | "string"][] };
  } = {};

  constructor(private database: string) {}

  async init() {
    this.logger = Framework.LoggerDb.get("dynamodb");

    const serviceConfigurationOptions: AWS_DynamoDB.DynamoDBClientConfig = {
      region:
        config.get<string>("db.dynamo.region") ||
        config.get<string>("aws.region"),
      credentials: {
        accessKeyId: config.get<string>("aws.id"),
        secretAccessKey: config.get<string>("aws.secret"),
      },
    };
    console.log(serviceConfigurationOptions);

    this.driver = new DynamoDB(serviceConfigurationOptions);
    this.client = DynamoDBDocument.from(this.driver);
    return this;
  }

  async createTable(
    name: string,
    primaryIndex: DbTableIndex,
    globalIndexes?: { [key: string]: DbTableIndex }
  ) {
    try {
      if (primaryIndex.length < 1 || primaryIndex.length > 2) {
        throw new Error(
          "Invalid number of indexes, only 2 can be defined HASH and RANGE"
        );
      }

      this.tablesPrimaryIndex[name] = primaryIndex;
      this.tablesGlobalIndexes[name] = globalIndexes || {};

      try {
        await this.driver.createTable({
          AttributeDefinitions: [
            {
              AttributeName: primaryIndex[0][0],
              AttributeType: ["number"].includes(primaryIndex[0][1])
                ? "N"
                : "S",
            },
            {
              AttributeName: primaryIndex[1][0],
              AttributeType: ["number"].includes(primaryIndex[1][1])
                ? "N"
                : "S",
            },
          ],
          KeySchema: [
            {
              AttributeName: primaryIndex[0][0],
              KeyType: "HASH",
            },
            {
              AttributeName: primaryIndex[1][0],
              KeyType: "RANGE",
            },
          ],
          TableName: this.database + "." + name,
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
        });
        console.log("Db: Table " + name + " was created");

        //Wait for 10 seconds for the table to be created
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (e) {
        if ((e + "").indexOf("already exists") < 0) {
          throw e;
        } else {
          console.log("Db: Table " + name + " already exists");
        }
      }

      for (const index in globalIndexes) {
        const indexDefinition = globalIndexes[index];
        try {
          await this.driver.updateTable(
            {
              TableName: this.database + "." + name,
              AttributeDefinitions: [
                {
                  AttributeName: indexDefinition[0][0],
                  AttributeType: ["number"].includes(indexDefinition[0][1])
                    ? "N"
                    : "S",
                },
                {
                  AttributeName: indexDefinition[1][0],
                  AttributeType: ["number"].includes(indexDefinition[1][1])
                    ? "N"
                    : "S",
                },
              ],
              GlobalSecondaryIndexUpdates: [
                {
                  Create: {
                    IndexName: this.database + "." + name + "." + index,
                    KeySchema: [
                      {
                        AttributeName: indexDefinition[0][0],
                        KeyType: "HASH",
                      },
                      {
                        AttributeName: indexDefinition[1][0],
                        KeyType: "RANGE",
                      },
                    ],
                    Projection: {
                      ProjectionType: "ALL",
                    },
                    ProvisionedThroughput: {
                      ReadCapacityUnits: 1,
                      WriteCapacityUnits: 1,
                    },
                  },
                },
              ],
            },
            () => {
              console.log("Db: Index " + index + " was created");
            }
          );
        } catch (e) {
          if (
            (e + "").indexOf("already exists") < 0 &&
            (e + "").indexOf("being created") < 0
          ) {
            throw e;
          } else {
            console.log(
              "Db: Index " + index + " already exists or is being created"
            );
          }
        }
      }

      return;
    } catch (e) {
      console.error("Db: Error creating table " + name, e);
      throw e;
    }
  }

  async insert<Entity>(
    ctx: InternalContext,
    table: string,
    document: Entity,
    tnx?: TransactionExecutor
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

    const insert = {
      TableName: this.database + "." + table,
      Item: {
        ...(document as any),
      },
    };

    await new Promise((resolve, reject) => {
      try {
        this.client.put(insert, (err, data) => {
          if (err) reject(err);
          resolve(data);
        });
      } catch (e) {
        reject(e);
      }
    }).catch((e) => {
      throw e;
    });
  }

  async update<Entity>(
    ctx: InternalContext,

    table: string,
    condition: Condition<Entity>,
    document: Entity,
    tnx?: TransactionExecutor
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

    document = sanitizeDocument(document);

    for (const key in condition) delete document[key];

    const update = {
      TableName: this.database + "." + table,
      Key: {
        ...condition,
      } as unknown as Record<string, AttributeValue>,
      UpdateExpression:
        "SET " +
        Object.keys(document)
          .map((k) => `#col_${k} = :value_${k}`)
          .join(", "),
      ExpressionAttributeValues: Object.keys(document).reduce(function (
        result,
        key
      ) {
        result[":value_" + key] = document[key];
        return result;
      },
      {}),
      ExpressionAttributeNames: Object.keys(document).reduce(function (
        result,
        key
      ) {
        result["#col_" + key] = key;
        return result;
      },
      {}),
    };

    await new Promise((resolve, reject) =>
      this.client.update(update, (err, data) => {
        if (err) reject(err);
        resolve(data);
      })
    ).catch((e) => {
      throw e;
    });
  }

  async select<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    options: {
      index?: string;
      comparator?: DbComparators;
      limit?: number;
      asc?: boolean;
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
    const limit = Math.min(1000, options.limit) || 100;
    const asc = options.asc !== undefined ? options.asc : true;

    const query = {
      KeyConditionExpression: `#p = :p ${
        condition[indexes[1][0]]
          ? `and ${
              options.comparator === "begins_with"
                ? `begins_with(#s, :s)`
                : `#s ${comparator} :s`
            }`
          : ""
      }`,
      ExpressionAttributeNames: {
        ...{ "#p": indexes[0][0] },
        ...(condition[indexes[1][0]] ? { "#s": indexes[1][0] } : {}),
      },
      ExpressionAttributeValues: {
        ...{ ":p": condition[indexes[0][0]] },
        ...(condition[indexes[1][0]] ? { ":s": condition[indexes[1][0]] } : {}),
      },
      TableName: this.database + "." + table,
      ...(options?.index && {
        IndexName: this.database + "." + table + "." + options.index,
      }),
      ScanIndexForward: !!asc,
      Limit: limit,
    };

    try {
      const startTime = Date.now();
      const data =
        Object.values(condition).length === 0
          ? await this.client.scan(
              _.pick(query, ["TableName", "ScanIndexForward", "Limit"])
            )
          : await this.client.query(query);

      console.log(
        "Db: Query took " +
          (Date.now() - startTime) +
          "ms, " +
          data.Count +
          " items returned"
      );

      return data.Items.map((item) => {
        return item as any;
      });
    } catch (err) {
      console.error(err);
    }
  }

  async selectOne<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean; index?: string; retry?: number }
  ) {
    const list = await this.select<Entity>(ctx, table, condition, {
      index: options?.index,
    });
    if (!list || list.length === 0)
      return options?.retry > 0
        ? await new Promise((res, rej) => {
            setTimeout(async () => {
              try {
                res(
                  await this.selectOne(ctx, table, condition, {
                    ...options,
                    retry: options?.retry - 1,
                  })
                );
              } catch (e) {
                rej(e);
              }
            }, 500);
          })
        : null;
    if (list.length > 1 && !options?.ignoreSingleCheck) {
      throw new Error(
        "Multiple results found when only 1 was expected (dynamo)"
      );
    }
    return list[0];
  }

  async delete<Entity>(
    ctx: InternalContext,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean },
    tnx?: TransactionExecutor
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

    condition = sanitizeCondition(condition);
    condition = _(condition).omitBy(_.isUndefined).value();

    await new Promise((resolve, reject) => {
      if (
        typeof condition[Object.keys(condition)[0]] === "object" ||
        typeof condition[Object.keys(condition)[1]] === "object"
      ) {
        //Simulate a IN

        if (
          typeof condition[Object.keys(condition)[0]] === "object" &&
          typeof condition[Object.keys(condition)[1]] === "object"
        ) {
          throw new Error("Can't delete with 2 IN");
        }

        const arrayKey =
          typeof condition[Object.keys(condition)[0]] === "object"
            ? Object.keys(condition)[0]
            : Object.keys(condition)[1];
        const staticKey =
          Object.keys(condition)[
            arrayKey === Object.keys(condition)[0] ? 1 : 0
          ];

        const stmts = condition[arrayKey].map((value) => {
          return {
            Statement: `DELETE FROM "${this.database}.${table}" WHERE "${staticKey}" = '${condition[staticKey]}' AND "${arrayKey}" = '${value}'`,
          };
        });

        this.client.batchExecuteStatement(
          {
            Statements: stmts,
          },
          (err, data) => {
            if (err) reject(err);
            resolve(data);
          }
        );

        return;
      }

      const deletion = {
        Key: {
          ...condition,
        },
        TableName: this.database + "." + table,
      };
      this.client.delete(deletion, (err, data) => {
        if (err) reject(err);
        resolve(data);
      });
    }).catch((e) => {
      throw e;
    });
  }

  private transactions = new Map<string, TransactionOperation<any>[]>();

  async addToTransaction<Entity>(
    tnx: TransactionExecutor | string,
    operation: TransactionOperation<Entity>
  ) {
    const id = typeof tnx === "string" ? tnx : tnx.getTransactionId();
    if (!this.transactions.has(id)) {
      this.transactions.set(id, []);
    }
    this.transactions.get(id).push(operation);
  }

  async clearTransaction(tnx: TransactionExecutor | string) {
    const id = typeof tnx === "string" ? tnx : tnx.getTransactionId();
    this.transactions.delete(id);
  }

  async executeTransaction(tnx: TransactionExecutor | string) {
    const startTime = Date.now();
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
    console.log(`Transaction ${id} took ${Date.now() - startTime}ms`);
  }
}
*/
