/**
 * データベース接続設定
 * Purpose: PostgreSQL接続管理とプール設定
 */
import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

interface DatabaseConfig extends PoolConfig {
  connectionString: string;
}

class Database {
  private pool: Pool;
  private static instance: Database;

  private constructor() {
    const config: DatabaseConfig = {
      connectionString: process.env.DATABASE_URL!,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // 最大接続数
      idleTimeoutMillis: 30000, // アイドルタイムアウト
      connectionTimeoutMillis: 2000, // 接続タイムアウト
    };

    this.pool = new Pool(config);

    // 接続エラーハンドリング
    this.pool.on('error', (err: Error) => {
      logger.error('Database pool error:', {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
    });

    // 接続成功ログ
    this.pool.on('connect', () => {
      logger.info('New database connection established');
    });

    logger.info('Database connection pool initialized', {
      maxConnections: config.max,
      environment: process.env.NODE_ENV
    });
  }

  /**
   * シングルトンインスタンス取得
   */
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * データベースクエリ実行
   * @param text SQLクエリ
   * @param params パラメータ配列
   * @returns クエリ結果
   */
  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    const client = await this.pool.connect();

    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      });

      return result;
    } catch (error: any) {
      logger.error('Database query error:', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        error: error.message,
        params: params?.slice(0, 5), // パラメータは最初の5個のみログ
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * トランザクション実行
   * @param callback トランザクション内で実行する処理
   * @returns 処理結果
   */
  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      logger.debug('Transaction started');

      const result = await callback(client);
      
      await client.query('COMMIT');
      logger.debug('Transaction committed');

      return result;
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back:', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * データベース接続開始
   */
  public async connect(): Promise<void> {
    try {
      // Test the connection
      await this.query('SELECT 1');
      logger.info('Database connection successful');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  /**
   * データベース接続終了
   */
  public async disconnect(): Promise<void> {
    await this.close();
  }

  /**
   * ヘルスチェック
   * @returns 接続状態
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * 接続プール終了
   */
  public async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

export const database = Database.getInstance();