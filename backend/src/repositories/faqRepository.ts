import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../config/database';
import { logger } from '../utils/logger';
import type { 
  FAQ, 
  CreateFAQRequest,
  UpdateFAQRequest,
  FAQSearchFilter,
  PaginationOptions,
  FAQCategory,
  Carrier
} from '../types/database';

export class FAQRepository {
  private pool: Pool;

  constructor() {
    this.pool = DatabasePool.getInstance();
  }

  /**
   * FAQを作成
   */
  async createFAQ(faqData: CreateFAQRequest): Promise<FAQ> {
    const client = await this.pool.connect();
    try {
      const faqId = uuidv4();
      const query = `
        INSERT INTO faqs (
          id, question, answer, category, carrier, tags, 
          embedding_vector, priority, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `;
      
      const values = [
        faqId,
        faqData.question,
        faqData.answer,
        faqData.category,
        faqData.carrier || null,
        faqData.tags ? JSON.stringify(faqData.tags) : null,
        faqData.embeddingVector || null,
        faqData.priority || 5,
        faqData.isActive !== false
      ];

      const result = await client.query(query, values);
      
      logger.info('FAQ作成', {
        faqId,
        category: faqData.category,
        carrier: faqData.carrier,
        priority: faqData.priority
      });

      return result.rows[0];
    } catch (error) {
      logger.error('FAQ作成エラー', { error, faqData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * IDでFAQを取得
   */
  async getFAQById(faqId: string): Promise<FAQ | null> {
    const client = await this.pool.connect();
    try {
      const query = `SELECT * FROM faqs WHERE id = $1`;
      const result = await client.query(query, [faqId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('FAQ取得エラー', { error, faqId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * FAQを更新
   */
  async updateFAQ(faqId: string, updates: UpdateFAQRequest): Promise<FAQ | null> {
    const client = await this.pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id') {
          if (key === 'tags' && value) {
            fields.push(`tags = $${paramCount}`);
            values.push(JSON.stringify(value));
          } else {
            fields.push(`${key} = $${paramCount}`);
            values.push(value);
          }
          paramCount++;
        }
      });

      if (fields.length === 0) return null;

      fields.push('updated_at = NOW()');
      values.push(faqId);

      const query = `
        UPDATE faqs 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length > 0) {
        logger.info('FAQ更新', { faqId, updates });
      }

      return result.rows[0] || null;
    } catch (error) {
      logger.error('FAQ更新エラー', { error, faqId, updates });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * FAQを削除（論理削除）
   */
  async deleteFAQ(faqId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE faqs 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `;
      
      const result = await client.query(query, [faqId]);
      
      if (result.rowCount > 0) {
        logger.info('FAQ削除', { faqId });
      }
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('FAQ削除エラー', { error, faqId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * FAQを検索（フィルター対応）
   */
  async searchFAQs(filter: FAQSearchFilter = {}, options: PaginationOptions = {}): Promise<FAQ[]> {
    const client = await this.pool.connect();
    try {
      const conditions: string[] = ['is_active = true'];
      const values: any[] = [];
      let paramCount = 0;

      if (filter.category) {
        paramCount++;
        conditions.push(`category = $${paramCount}`);
        values.push(filter.category);
      }

      if (filter.carrier) {
        paramCount++;
        conditions.push(`(carrier = $${paramCount} OR carrier IS NULL)`);
        values.push(filter.carrier);
      }

      if (filter.searchText) {
        paramCount++;
        conditions.push(`(question ILIKE $${paramCount} OR answer ILIKE $${paramCount} OR tags::text ILIKE $${paramCount})`);
        values.push(`%${filter.searchText}%`);
      }

      if (filter.priority) {
        paramCount++;
        conditions.push(`priority >= $${paramCount}`);
        values.push(filter.priority);
      }

      const limit = options.limit || 20;
      const offset = options.offset || 0;

      paramCount++;
      values.push(limit);
      paramCount++;
      values.push(offset);

      const orderBy = options.orderBy || 'priority DESC, created_at DESC';

      const query = `
        SELECT * FROM faqs 
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await client.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('FAQ検索エラー', { error, filter, options });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ベクトル類似度検索
   */
  async searchFAQsByVector(
    embeddingVector: number[], 
    limit: number = 10,
    filter: Partial<FAQSearchFilter> = {}
  ): Promise<Array<FAQ & { similarity: number }>> {
    const client = await this.pool.connect();
    try {
      const conditions: string[] = ['is_active = true', 'embedding_vector IS NOT NULL'];
      const values: any[] = [JSON.stringify(embeddingVector)];
      let paramCount = 1;

      if (filter.category) {
        paramCount++;
        conditions.push(`category = $${paramCount}`);
        values.push(filter.category);
      }

      if (filter.carrier) {
        paramCount++;
        conditions.push(`(carrier = $${paramCount} OR carrier IS NULL)`);
        values.push(filter.carrier);
      }

      if (filter.priority) {
        paramCount++;
        conditions.push(`priority >= $${paramCount}`);
        values.push(filter.priority);
      }

      paramCount++;
      values.push(limit);

      const query = `
        SELECT *, 
               1 - (embedding_vector <=> $1::vector) as similarity
        FROM faqs 
        WHERE ${conditions.join(' AND ')}
        ORDER BY embedding_vector <=> $1::vector
        LIMIT $${paramCount}
      `;

      const result = await client.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('FAQ ベクトル検索エラー', { error, filter, limit });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 全文検索
   */
  async fullTextSearchFAQs(
    searchText: string,
    filter: Partial<FAQSearchFilter> = {},
    options: PaginationOptions = {}
  ): Promise<FAQ[]> {
    const client = await this.pool.connect();
    try {
      const conditions: string[] = ['is_active = true'];
      const values: any[] = [];
      let paramCount = 0;

      // 全文検索条件
      paramCount++;
      conditions.push(`
        to_tsvector('japanese', question || ' ' || answer) @@ 
        plainto_tsquery('japanese', $${paramCount})
      `);
      values.push(searchText);

      if (filter.category) {
        paramCount++;
        conditions.push(`category = $${paramCount}`);
        values.push(filter.category);
      }

      if (filter.carrier) {
        paramCount++;
        conditions.push(`(carrier = $${paramCount} OR carrier IS NULL)`);
        values.push(filter.carrier);
      }

      const limit = options.limit || 20;
      const offset = options.offset || 0;

      paramCount++;
      values.push(limit);
      paramCount++;
      values.push(offset);

      const query = `
        SELECT *,
               ts_rank(to_tsvector('japanese', question || ' ' || answer), 
                      plainto_tsquery('japanese', $1)) as rank
        FROM faqs 
        WHERE ${conditions.join(' AND ')}
        ORDER BY rank DESC, priority DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await client.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('FAQ 全文検索エラー', { error, searchText, filter, options });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * カテゴリ別FAQ数を取得
   */
  async getFAQCountByCategory(): Promise<Array<{ category: string; count: number }>> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT category, COUNT(*) as count
        FROM faqs 
        WHERE is_active = true
        GROUP BY category
        ORDER BY count DESC
      `;

      const result = await client.query(query);
      return result.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count)
      }));
    } catch (error) {
      logger.error('カテゴリ別FAQ数取得エラー', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * キャリア別FAQ数を取得
   */
  async getFAQCountByCarrier(): Promise<Array<{ carrier: string | null; count: number }>> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT carrier, COUNT(*) as count
        FROM faqs 
        WHERE is_active = true
        GROUP BY carrier
        ORDER BY count DESC
      `;

      const result = await client.query(query);
      return result.rows.map(row => ({
        carrier: row.carrier,
        count: parseInt(row.count)
      }));
    } catch (error) {
      logger.error('キャリア別FAQ数取得エラー', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 人気のFAQを取得（アクセス頻度順）
   */
  async getPopularFAQs(limit: number = 10): Promise<FAQ[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT f.*, COUNT(m.id) as access_count
        FROM faqs f
        LEFT JOIN messages m ON m.content ILIKE '%' || f.question || '%'
        WHERE f.is_active = true
        GROUP BY f.id
        ORDER BY access_count DESC, f.priority DESC
        LIMIT $1
      `;

      const result = await client.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('人気FAQ取得エラー', { error, limit });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * FAQの埋め込みベクトルを更新
   */
  async updateEmbeddingVector(faqId: string, embeddingVector: number[]): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE faqs 
        SET embedding_vector = $1, updated_at = NOW()
        WHERE id = $2
      `;

      const result = await client.query(query, [JSON.stringify(embeddingVector), faqId]);
      
      if (result.rowCount > 0) {
        logger.info('FAQ埋め込みベクトル更新', { faqId });
      }

      return result.rowCount > 0;
    } catch (error) {
      logger.error('FAQ埋め込みベクトル更新エラー', { error, faqId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * バッチでFAQの埋め込みベクトルを更新
   */
  async batchUpdateEmbeddingVectors(updates: Array<{ id: string; embeddingVector: number[] }>): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let updatedCount = 0;
      for (const update of updates) {
        const query = `
          UPDATE faqs 
          SET embedding_vector = $1, updated_at = NOW()
          WHERE id = $2
        `;
        
        const result = await client.query(query, [JSON.stringify(update.embeddingVector), update.id]);
        if (result.rowCount > 0) {
          updatedCount++;
        }
      }

      await client.query('COMMIT');
      
      logger.info('FAQ埋め込みベクトル一括更新', { 
        totalCount: updates.length,
        updatedCount 
      });

      return updatedCount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('FAQ埋め込みベクトル一括更新エラー', { error, updateCount: updates.length });
      throw error;
    } finally {
      client.release();
    }
  }
}

export const faqRepository = new FAQRepository();