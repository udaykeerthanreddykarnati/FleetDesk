import 'server-only';
import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from 'mysql2/promise';
import type { ExecuteValues } from 'mysql2';

declare global {
  var fleetMysqlPool: Pool | undefined;
}

const mysqlOptions = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'fleet_app',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'fleet_logistics',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 5,
  idleTimeout: 60000,
  enableKeepAlive: true,
  charset: 'utf8mb4'
};

export const pool = globalThis.fleetMysqlPool ?? (process.env.MYSQL_URL
  ? mysql.createPool(process.env.MYSQL_URL)
  : mysql.createPool(mysqlOptions));

if (process.env.NODE_ENV !== 'production') globalThis.fleetMysqlPool = pool;

export async function query<T>(sql: string, values: unknown[] = []): Promise<T> {
  const [rows] = await pool.execute(sql, values as ExecuteValues[]);
  return rows as T;
}

export async function execute(sql: string, values: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, values as ExecuteValues[]);
  return result;
}

export async function inTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
