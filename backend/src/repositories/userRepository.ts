import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { DatabasePool } from '../config/database';
import { logger } from '../utils/logger';
import type { 
  User, 
  CreateUserRequest,
  UpdateUserRequest,
  UserFilter,
  PaginationOptions,
  UserPreferences,
  UserAnalytics 
} from '../types/database';

export class UserRepository {
  private pool: Pool;

  constructor() {
    this.pool = DatabasePool.getInstance();
  }

  /**
   * ユーザーを作成
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    const client = await this.pool.connect();
    try {
      const userId = uuidv4();
      const hashedPassword = userData.password ? await bcrypt.hash(userData.password, 12) : null;
      
      const query = `
        INSERT INTO users (
          id, email, password_hash, display_name, phone_number, 
          preferences, is_active, is_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `;
      
      const values = [
        userId,
        userData.email || null,
        hashedPassword,
        userData.displayName || null,
        userData.phoneNumber || null,
        userData.preferences ? JSON.stringify(userData.preferences) : JSON.stringify({
          notifications: true,
          language: 'ja',
          theme: 'light'
        }),
        userData.isActive !== false,
        userData.isVerified || false
      ];

      const result = await client.query(query, values);
      
      logger.info('ユーザー作成', {
        userId,
        email: userData.email,
        displayName: userData.displayName,
        hasPassword: !!userData.password
      });

      // パスワードハッシュを除外して返す
      const user = result.rows[0];
      delete user.password_hash;
      return user;
    } catch (error) {
      logger.error('ユーザー作成エラー', { error, userData: { ...userData, password: '[REDACTED]' } });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * IDでユーザーを取得
   */
  async getUserById(userId: string, includePassword: boolean = false): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const query = `SELECT * FROM users WHERE id = $1`;
      const result = await client.query(query, [userId]);
      
      if (result.rows.length === 0) return null;

      const user = result.rows[0];
      if (!includePassword) {
        delete user.password_hash;
      }
      
      return user;
    } catch (error) {
      logger.error('ユーザー取得エラー', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * メールアドレスでユーザーを取得
   */
  async getUserByEmail(email: string, includePassword: boolean = false): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const query = `SELECT * FROM users WHERE email = $1 AND is_active = true`;
      const result = await client.query(query, [email]);
      
      if (result.rows.length === 0) return null;

      const user = result.rows[0];
      if (!includePassword) {
        delete user.password_hash;
      }
      
      return user;
    } catch (error) {
      logger.error('ユーザー取得エラー（メール）', { error, email });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 電話番号でユーザーを取得
   */
  async getUserByPhone(phoneNumber: string): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const query = `SELECT * FROM users WHERE phone_number = $1 AND is_active = true`;
      const result = await client.query(query, [phoneNumber]);
      
      if (result.rows.length === 0) return null;

      const user = result.rows[0];
      delete user.password_hash;
      return user;
    } catch (error) {
      logger.error('ユーザー取得エラー（電話番号）', { error, phoneNumber });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ユーザーを更新
   */
  async updateUser(userId: string, updates: UpdateUserRequest): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id') {
          if (key === 'password' && value) {
            // パスワードハッシュ化
            fields.push(`password_hash = $${paramCount}`);
            values.push(bcrypt.hashSync(value as string, 12));
          } else if (key === 'preferences' && value) {
            fields.push(`preferences = $${paramCount}`);
            values.push(JSON.stringify(value));
          } else if (key !== 'password') {
            fields.push(`${key} = $${paramCount}`);
            values.push(value);
          }
          paramCount++;
        }
      });

      if (fields.length === 0) return null;

      fields.push('updated_at = NOW()');
      values.push(userId);

      const query = `
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length > 0) {
        logger.info('ユーザー更新', { userId, updatedFields: Object.keys(updates) });
        const user = result.rows[0];
        delete user.password_hash;
        return user;
      }

      return null;
    } catch (error) {
      logger.error('ユーザー更新エラー', { 
        error, 
        userId, 
        updates: { ...updates, password: updates.password ? '[REDACTED]' : undefined } 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * パスワードを検証
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `SELECT password_hash FROM users WHERE id = $1 AND is_active = true`;
      const result = await client.query(query, [userId]);
      
      if (result.rows.length === 0) return false;

      const passwordHash = result.rows[0].password_hash;
      if (!passwordHash) return false;

      const isValid = await bcrypt.compare(password, passwordHash);
      
      logger.info('パスワード検証', { userId, isValid });
      return isValid;
    } catch (error) {
      logger.error('パスワード検証エラー', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ユーザーを検索（フィルター対応）
   */
  async searchUsers(filter: UserFilter = {}, options: PaginationOptions = {}): Promise<User[]> {
    const client = await this.pool.connect();
    try {
      const conditions: string[] = ['1=1'];
      const values: any[] = [];
      let paramCount = 0;

      if (filter.isActive !== undefined) {
        paramCount++;
        conditions.push(`is_active = $${paramCount}`);
        values.push(filter.isActive);
      }

      if (filter.isVerified !== undefined) {
        paramCount++;
        conditions.push(`is_verified = $${paramCount}`);
        values.push(filter.isVerified);
      }

      if (filter.searchText) {
        paramCount++;
        conditions.push(`(email ILIKE $${paramCount} OR display_name ILIKE $${paramCount} OR phone_number ILIKE $${paramCount})`);
        values.push(`%${filter.searchText}%`);
      }

      if (filter.createdAfter) {
        paramCount++;
        conditions.push(`created_at >= $${paramCount}`);
        values.push(filter.createdAfter);
      }

      if (filter.createdBefore) {
        paramCount++;
        conditions.push(`created_at <= $${paramCount}`);
        values.push(filter.createdBefore);
      }

      const limit = options.limit || 50;
      const offset = options.offset || 0;

      paramCount++;
      values.push(limit);
      paramCount++;
      values.push(offset);

      const orderBy = options.orderBy || 'created_at DESC';

      const query = `
        SELECT id, email, display_name, phone_number, preferences, 
               is_active, is_verified, last_login_at, created_at, updated_at
        FROM users 
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await client.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('ユーザー検索エラー', { error, filter, options });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ユーザーを論理削除
   */
  async deactivateUser(userId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `;
      
      const result = await client.query(query, [userId]);
      
      if (result.rowCount > 0) {
        logger.info('ユーザー無効化', { userId });
      }
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('ユーザー無効化エラー', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * メール認証を完了
   */
  async verifyEmail(userId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users 
        SET is_verified = true, updated_at = NOW()
        WHERE id = $1
      `;
      
      const result = await client.query(query, [userId]);
      
      if (result.rowCount > 0) {
        logger.info('メール認証完了', { userId });
      }
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('メール認証エラー', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 最終ログイン時刻を更新
   */
  async updateLastLogin(userId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users 
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `;
      
      const result = await client.query(query, [userId]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error('最終ログイン更新エラー', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ユーザー設定を更新
   */
  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      // 現在の設定を取得
      const currentUser = await this.getUserById(userId);
      if (!currentUser) return null;

      const currentPreferences = currentUser.preferences || {};
      const updatedPreferences = { ...currentPreferences, ...preferences };

      const query = `
        UPDATE users 
        SET preferences = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await client.query(query, [JSON.stringify(updatedPreferences), userId]);
      
      if (result.rows.length > 0) {
        logger.info('ユーザー設定更新', { userId, preferences });
        const user = result.rows[0];
        delete user.password_hash;
        return user;
      }

      return null;
    } catch (error) {
      logger.error('ユーザー設定更新エラー', { error, userId, preferences });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ユーザー統計を取得
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    newUsersThisMonth: number;
    recentSignups: User[];
  }> {
    const client = await this.pool.connect();
    try {
      // 基本統計
      const statsQuery = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as new_users_this_month
        FROM users
      `;

      const statsResult = await client.query(statsQuery);
      const stats = statsResult.rows[0];

      // 最近のサインアップ
      const recentQuery = `
        SELECT id, email, display_name, created_at
        FROM users 
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const recentResult = await client.query(recentQuery);

      return {
        totalUsers: parseInt(stats.total_users) || 0,
        activeUsers: parseInt(stats.active_users) || 0,
        verifiedUsers: parseInt(stats.verified_users) || 0,
        newUsersThisMonth: parseInt(stats.new_users_this_month) || 0,
        recentSignups: recentResult.rows,
      };
    } catch (error) {
      logger.error('ユーザー統計取得エラー', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ユーザーアクティビティ分析
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          u.created_at,
          u.last_login_at,
          COUNT(DISTINCT cs.id) as session_count,
          COUNT(m.id) as message_count,
          AVG(m.response_time_ms) as avg_response_time,
          COUNT(CASE WHEN cs.escalated_at IS NOT NULL THEN 1 END) as escalation_count
        FROM users u
        LEFT JOIN chat_sessions cs ON u.id = cs.user_id
        LEFT JOIN messages m ON cs.id = m.session_id
        WHERE u.id = $1
        GROUP BY u.id, u.created_at, u.last_login_at
      `;

      const result = await client.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return {
          sessionCount: 0,
          messageCount: 0,
          averageResponseTime: 0,
          escalationCount: 0,
          accountAge: 0,
          lastActivity: null,
        };
      }

      const row = result.rows[0];
      const createdAt = new Date(row.created_at);
      const accountAge = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        sessionCount: parseInt(row.session_count) || 0,
        messageCount: parseInt(row.message_count) || 0,
        averageResponseTime: parseFloat(row.avg_response_time) || 0,
        escalationCount: parseInt(row.escalation_count) || 0,
        accountAge,
        lastActivity: row.last_login_at,
      };
    } catch (error) {
      logger.error('ユーザーアクティビティ分析エラー', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 重複メールアドレスをチェック
   */
  async isEmailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      let query = `SELECT id FROM users WHERE email = $1 AND is_active = true`;
      const values: any[] = [email];

      if (excludeUserId) {
        query += ` AND id != $2`;
        values.push(excludeUserId);
      }

      const result = await client.query(query, values);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('メール重複チェックエラー', { error, email });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * アカウントロックアウト管理
   */
  async lockoutUser(userId: string, lockoutUntil: Date): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users 
        SET lockout_until = $1, updated_at = NOW()
        WHERE id = $2
      `;
      
      const result = await client.query(query, [lockoutUntil, userId]);
      
      if (result.rowCount > 0) {
        logger.info('ユーザーロックアウト', { userId, lockoutUntil });
      }
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('ユーザーロックアウトエラー', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ゲストユーザーを作成
   */
  async createGuestUser(sessionToken: string): Promise<User> {
    const client = await this.pool.connect();
    try {
      const userId = uuidv4();
      
      const query = `
        INSERT INTO users (
          id, display_name, preferences, is_active, is_verified, 
          is_guest, guest_session_token, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;
      
      const values = [
        userId,
        'ゲストユーザー',
        JSON.stringify({
          notifications: false,
          language: 'ja',
          theme: 'light'
        }),
        true,
        false,
        true,
        sessionToken
      ];

      const result = await client.query(query, values);
      
      logger.info('ゲストユーザー作成', { userId, sessionToken });
      
      const user = result.rows[0];
      delete user.password_hash;
      return user;
    } catch (error) {
      logger.error('ゲストユーザー作成エラー', { error, sessionToken });
      throw error;
    } finally {
      client.release();
    }
  }
}

export const userRepository = new UserRepository();