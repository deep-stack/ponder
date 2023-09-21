import Sqlite from "better-sqlite3";
import assert from "node:assert";
import path from "node:path";
import pg, { Client, DatabaseError, Pool } from "pg";

import type { ResolvedConfig } from "@/config/config";
import type { Options } from "@/config/options";
import { PostgresError } from "@/errors/postgres";
import { SqliteError } from "@/errors/sqlite";
import { ensureDirExists } from "@/utils/exists";

export interface SqliteDb {
  kind: "sqlite";
  eventStoreDb: Sqlite.Database;
  userStoreDb: Sqlite.Database;
}

export interface PostgresDb {
  kind: "postgres";
  pool: Pool;
}

export type Database = SqliteDb | PostgresDb;

// Set pg protocol to use BigInt.
pg.types.setTypeParser(20, BigInt);

// Monkeypatch Pool.query to get more informative stack traces. I have no idea why this works.
// https://stackoverflow.com/a/70601114
const originalClientQuery = Client.prototype.query;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Client.prototype.query = async function query(
  ...args: [queryText: string, values: any[], callback: () => void]
) {
  try {
    return await originalClientQuery.apply(this, args);
  } catch (error) {
    const [statement, parameters] = args;

    if (error instanceof DatabaseError) {
      const parameters_ = parameters ?? [];
      throw new PostgresError({
        statement,
        parameters:
          parameters_.length <= 25
            ? parameters_
            : parameters_.slice(0, 26).concat(["..."]),
        pgError: error,
      });
    }

    throw error;
  }
};

export const patchSqliteDatabase = ({ db }: { db: any }) => {
  const oldPrepare = db.prepare;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  db.prepare = (source: string) => {
    const statement = oldPrepare.apply(db, [source]);

    const wrapper =
      (fn: (...args: any) => void) =>
      (...args: any) => {
        try {
          return fn.apply(statement, args);
        } catch (error) {
          throw new SqliteError({
            statement: source,
            parameters: args[0],
            sqliteError: error as Error,
          });
        }
      };

    for (const method of ["run", "get", "all"]) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      statement[method] = wrapper(statement[method]);
    }

    return statement;
  };

  return db;
};

export const buildDatabase = ({
  options,
  config,
}: {
  options: Options;
  config: ResolvedConfig;
}): Database => {
  let resolvedDatabaseConfig: NonNullable<ResolvedConfig["database"]>;

  const defaultSqliteDirectory = path.join(options.ponderDir, "cache");

  if (config.database) {
    if (config.database.kind === "postgres") {
      resolvedDatabaseConfig = {
        kind: "postgres",
        connectionString: config.database.connectionString,
      };
    } else {
      resolvedDatabaseConfig = {
        kind: "sqlite",
        directory: config.database.directory ?? defaultSqliteDirectory,
      };
    }
  } else {
    if (process.env.DATABASE_URL) {
      resolvedDatabaseConfig = {
        kind: "postgres",
        connectionString: process.env.DATABASE_URL,
      };
    } else {
      resolvedDatabaseConfig = {
        kind: "sqlite",
        directory: defaultSqliteDirectory,
      };
    }
  }

  if (resolvedDatabaseConfig.kind === "sqlite") {
    const [eventStoreDb, userStoreDb] = ["event-store.db", "user-store.db"].map(
      (filename) => {
        assert(resolvedDatabaseConfig.kind === "sqlite");
        const dbFilePath = path.join(
          resolvedDatabaseConfig.directory!,
          filename
        );
        ensureDirExists(dbFilePath);
        const rawDb = Sqlite(dbFilePath);
        rawDb.pragma("journal_mode = WAL");
        return patchSqliteDatabase({ db: rawDb });
      }
    );

    return { kind: "sqlite", eventStoreDb, userStoreDb };
  } else {
    const pool = new Pool({
      connectionString: resolvedDatabaseConfig.connectionString,
    });

    return { kind: "postgres", pool };
  }
};
