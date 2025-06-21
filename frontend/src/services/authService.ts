/**
 * 認証サービス
 * Purpose: 認証API通信の実装
 */

import { 
  CreateSessionRequest, 
  CreateSessionResponse, 
  VerifySessionRequest, 
  VerifySessionResponse,
  APIResponse 
} from '../types/api';
import { chatApi } from './chatApi';
import { logger } from '../utils/logger';

export class AuthService {
  /**
   * セッション作成
   */
  async createSession(params: CreateSessionRequest): Promise<APIResponse<CreateSessionResponse>> {
    try {
      logger.info('セッション作成API呼び出し', params);
      
      const response = await chatApi.createSession(params.mode);
      
      if (response.data.success) {
        logger.info('セッション作成API成功');
      } else {
        logger.warn('セッション作成API失敗', response.data.error);
      }
      
      return response.data;
    } catch (error) {
      logger.error('セッション作成API通信エラー', { error: error.message });
      throw new Error('セッションの作成に失敗しました');
    }
  }

  /**
   * セッション検証
   */
  async verifySession(sessionToken: string): Promise<APIResponse<VerifySessionResponse>> {
    try {
      logger.info('セッション検証API呼び出し', { 
        sessionToken: sessionToken.substring(0, 8) + '...' 
      });
      
      // chatApiでは直接セッション検証がAPIにないため、シンプルな模擬検証
      const response = {
        status: 200,
        data: {
          success: true,
          data: {
            valid: !!sessionToken && sessionToken.length > 10,
            user: sessionToken ? {
              sessionId: sessionToken,
              status: 'active',
              preferences: {},
              createdAt: new Date(),
              updatedAt: new Date()
            } : null,
            session: sessionToken ? {
              sessionToken,
              mode: 'step_by_step' as const,
              currentStep: 'initial',
              scenarioData: {},
              contextData: {},
              createdAt: new Date(),
              updatedAt: new Date()
            } : null
          }
        }
      };
      
      if (response.data.success) {
        logger.info('セッション検証API成功', { valid: response.data.data?.valid });
      } else {
        logger.warn('セッション検証API失敗', response.data.error);
      }
      
      return response.data;
    } catch (error) {
      logger.error('セッション検証API通信エラー', { error: error.message });
      throw new Error('セッションの検証に失敗しました');
    }
  }

  /**
   * セッション更新
   */
  async refreshSession(sessionToken: string): Promise<APIResponse<{ message: string; expiresAt: string }>> {
    try {
      logger.info('セッション更新API呼び出し');
      
      const response = await chatApi.refreshSession(sessionToken);
      
      if (response.data.success) {
        logger.info('セッション更新API成功');
      } else {
        logger.warn('セッション更新API失敗', response.data.error);
      }
      
      return response.data;
    } catch (error) {
      logger.error('セッション更新API通信エラー', { error: error.message });
      throw new Error('セッションの更新に失敗しました');
    }
  }

  /**
   * セッション削除
   */
  async deleteSession(sessionToken: string): Promise<APIResponse<{ message: string }>> {
    try {
      logger.info('セッション削除API呼び出し');
      
      const response = await chatApi.deleteSession(sessionToken);
      
      if (response.data.success) {
        logger.info('セッション削除API成功');
      } else {
        logger.warn('セッション削除API失敗', response.data.error);
      }
      
      return response.data;
    } catch (error) {
      logger.error('セッション削除API通信エラー', { error: error.message });
      throw new Error('セッションの削除に失敗しました');
    }
  }

  /**
   * セッション情報取得
   */
  async getSessionInfo(sessionToken: string): Promise<APIResponse<{ user: any; session: any }>> {
    try {
      logger.info('セッション情報取得API呼び出し');
      
      // セッション情報をシンプルに返す
      const response = {
        status: 200,
        data: {
          success: true,
          data: {
            user: {
              sessionId: sessionToken,
              status: 'active',
              preferences: {},
              createdAt: new Date(),
              updatedAt: new Date()
            },
            session: {
              sessionToken,
              mode: 'step_by_step' as const,
              currentStep: 'initial',
              scenarioData: {},
              contextData: {},
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      };
      
      if (response.data.success) {
        logger.info('セッション情報取得API成功');
      } else {
        logger.warn('セッション情報取得API失敗', response.data.error);
      }
      
      return response.data;
    } catch (error) {
      logger.error('セッション情報取得API通信エラー', { error: error.message });
      throw new Error('セッション情報の取得に失敗しました');
    }
  }

  /**
   * セッション有効性チェック（ローカル）
   */
  isSessionValid(sessionToken: string | null): boolean {
    if (!sessionToken) {
      return false;
    }

    // 基本的な形式チェック
    if (!sessionToken.startsWith('mnp_') || sessionToken.length < 20) {
      return false;
    }

    return true;
  }

  /**
   * セッショントークンをリクエストヘッダーに設定
   */
  setSessionToken(sessionToken: string | null): void {
    if (sessionToken) {
      logger.info('セッショントークン設定', { 
        token: sessionToken.substring(0, 8) + '...' 
      });
    } else {
      logger.info('セッショントークン削除');
    }
  }

  /**
   * CSRFトークン取得
   */
  async getCsrfToken(): Promise<string> {
    try {
      // 仮のCRSFトークンを生成
      return 'csrf_' + Math.random().toString(36).substr(2, 9);
    } catch (error) {
      logger.error('CSRFトークン取得エラー', { error: error.message });
      throw new Error('CSRFトークンの取得に失敗しました');
    }
  }

  /**
   * ゲストセッション作成（認証なし）
   */
  async createGuestSession(mode: 'roadmap' | 'step_by_step' = 'roadmap'): Promise<APIResponse<CreateSessionResponse>> {
    return this.createSession({
      mode,
      preferences: {
        isGuest: true
      }
    });
  }

  /**
   * セッション期限チェック
   */
  isSessionExpired(session: any): boolean {
    if (!session || !session.createdAt) {
      return true;
    }

    const createdAt = new Date(session.createdAt);
    const now = new Date();
    const sessionAge = now.getTime() - createdAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24時間

    return sessionAge > maxAge;
  }

  /**
   * セッション統計取得
   */
  async getSessionStats(): Promise<APIResponse<{
    activeSessions: number;
    totalSessions: number;
    averageSessionDuration: number;
  }>> {
    try {
      // 仮の統計情報を返す
      const response = {
        status: 200,
        data: {
          success: true,
          data: {
            activeSessions: 150,
            totalSessions: 1250,
            averageSessionDuration: 1800
          }
        }
      };
      
      if (response.data.success) {
        logger.info('セッション統計取得成功');
      }
      
      return response.data;
    } catch (error) {
      logger.error('セッション統計取得エラー', { error: error.message });
      throw new Error('セッション統計の取得に失敗しました');
    }
  }
}

// シングルトンインスタンス
export const authAPI = new AuthService();

// デフォルトエクスポート
export default AuthService;