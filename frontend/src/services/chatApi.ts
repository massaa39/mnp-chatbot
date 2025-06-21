import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type {
  ChatRequest,
  ChatResponse,
  ChatHistoryRequest,
  ChatHistoryResponse,
  EscalationRequest,
  EscalationResponse,
  FAQSearchRequest,
  FAQSearchResponse,
  APIResponse,
} from '../types/api';

// APIクライアント設定
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const API_VERSION = 'v1';

class ChatApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // リクエストインターセプター
    this.client.interceptors.request.use(
      (config) => {
        // セッショントークンを自動付与
        const sessionToken = this.getSessionToken();
        if (sessionToken && config.headers) {
          config.headers['X-Session-Token'] = sessionToken;
        }

        // リクエストログ
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
            data: config.data,
            headers: config.headers,
          });
        }

        return config;
      },
      (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => {
        // レスポンスログ
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API Response] ${response.status}`, {
            data: response.data,
            headers: response.headers,
          });
        }

        return response;
      },
      (error) => {
        // エラーログ
        console.error(`[API Error] ${error.response?.status || 'Network Error'}`, {
          url: error.config?.url,
          data: error.response?.data,
          message: error.message,
        });

        // エラーの正規化
        if (error.response?.data?.error) {
          error.message = error.response.data.error.message || error.message;
        }

        return Promise.reject(error);
      }
    );
  }

  private getSessionToken(): string | null {
    // セッショントークンの取得（認証ストアから）
    try {
      const authStore = localStorage.getItem('mnp-auth-store');
      if (authStore) {
        const parsed = JSON.parse(authStore);
        return parsed.state?.sessionToken || null;
      }
    } catch (error) {
      console.warn('セッショントークンの取得に失敗:', error);
    }
    return null;
  }

  // チャットメッセージ送信
  async sendMessage(request: ChatRequest): Promise<AxiosResponse<APIResponse<ChatResponse>>> {
    try {
      const response = await this.client.post<APIResponse<ChatResponse>>('/messages', {
        sessionToken: request.sessionToken,
        message: request.message,
        mode: request.mode,
        contextData: request.contextData,
      });

      return response;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      throw new Error('メッセージの送信に失敗しました');
    }
  }

  // チャット履歴取得
  async getChatHistory(sessionToken: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<AxiosResponse<APIResponse<ChatHistoryResponse>>> {
    try {
      const response = await this.client.get<APIResponse<ChatHistoryResponse>>(
        `/history/${sessionToken}`,
        {
          params: {
            page: Math.floor((options?.offset || 0) / (options?.limit || 50)) + 1,
            limit: options?.limit || 50,
          },
        }
      );

      return response;
    } catch (error) {
      console.error('履歴取得エラー:', error);
      throw new Error('履歴の取得に失敗しました');
    }
  }

  // エスカレーション開始
  async initiateEscalation(request: EscalationRequest): Promise<AxiosResponse<APIResponse<EscalationResponse>>> {
    try {
      const response = await this.client.post<APIResponse<EscalationResponse>>('/escalation', {
        sessionToken: request.sessionToken,
        reason: request.reason,
        context: request.context,
        priority: request.priority || 'medium',
        contactInfo: request.contactInfo,
      });

      return response;
    } catch (error) {
      console.error('エスカレーション開始エラー:', error);
      throw new Error('エスカレーションの開始に失敗しました');
    }
  }

  // エスカレーション状態確認
  async getEscalationStatus(sessionToken: string): Promise<AxiosResponse<APIResponse<{
    status: 'pending' | 'active' | 'resolved' | 'cancelled';
    ticketId?: string;
    estimatedWaitTime?: number;
    assignedAgent?: string;
  }>>> {
    try {
      const response = await this.client.get(`/escalation/status/${sessionToken}`);
      return response;
    } catch (error) {
      console.error('エスカレーション状態確認エラー:', error);
      throw new Error('エスカレーション状態の確認に失敗しました');
    }
  }

  // FAQ検索
  async searchFAQ(request: FAQSearchRequest): Promise<AxiosResponse<APIResponse<FAQSearchResponse>>> {
    try {
      const response = await this.client.post<APIResponse<FAQSearchResponse>>('/faq/search', {
        query: request.query,
        category: request.category,
        carrier: request.carrier,
        limit: request.limit || 10,
      });

      return response;
    } catch (error) {
      console.error('FAQ検索エラー:', error);
      throw new Error('FAQ検索に失敗しました');
    }
  }

  // セッション作成
  async createSession(mode?: 'step_by_step' | 'roadmap'): Promise<AxiosResponse<APIResponse<{
    sessionToken: string;
    expiresAt: string;
  }>>> {
    try {
      const response = await this.client.post('/chat/sessions', {
        mode: mode || 'step_by_step',
        userAgent: navigator.userAgent,
        language: navigator.language || 'ja',
      });

      return response;
    } catch (error) {
      console.error('セッション作成エラー:', error);
      throw new Error('セッションの作成に失敗しました');
    }
  }

  // セッション更新
  async refreshSession(sessionToken: string): Promise<AxiosResponse<APIResponse<{
    sessionToken: string;
    expiresAt: string;
  }>>> {
    try {
      const response = await this.client.post(`/chat/sessions/${sessionToken}/refresh`);
      return response;
    } catch (error) {
      console.error('セッション更新エラー:', error);
      throw new Error('セッションの更新に失敗しました');
    }
  }

  // セッション削除
  async deleteSession(sessionToken: string): Promise<AxiosResponse<APIResponse<{}>>> {
    try {
      const response = await this.client.delete(`/chat/sessions/${sessionToken}`);
      return response;
    } catch (error) {
      console.error('セッション削除エラー:', error);
      throw new Error('セッションの削除に失敗しました');
    }
  }

  // ヘルスチェック
  async healthCheck(): Promise<AxiosResponse<APIResponse<{
    status: 'ok' | 'error';
    timestamp: string;
    version: string;
  }>>> {
    try {
      const response = await this.client.get('/health');
      return response;
    } catch (error) {
      console.error('ヘルスチェックエラー:', error);
      throw new Error('サーバーの状態確認に失敗しました');
    }
  }

  // WebSocket接続用トークン取得
  async getWebSocketToken(sessionToken: string): Promise<AxiosResponse<APIResponse<{
    wsToken: string;
    wsUrl: string;
    expiresAt: string;
  }>>> {
    try {
      const response = await this.client.post(`/chat/sessions/${sessionToken}/ws-token`);
      return response;
    } catch (error) {
      console.error('WebSocketトークン取得エラー:', error);
      throw new Error('WebSocket接続トークンの取得に失敗しました');
    }
  }

  // エスカレーション統計取得（管理画面用）
  async getEscalationStats(period: string = '7d'): Promise<AxiosResponse<APIResponse<{
    totalEscalations: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    averageWaitTime: number;
    averageResolutionTime: number;
    satisfactionRating: number;
    activeAgents: number;
    queueLength: number;
  }>>> {
    try {
      const response = await this.client.get('/escalation/stats', {
        params: { period }
      });
      return response;
    } catch (error) {
      console.error('エスカレーション統計取得エラー:', error);
      throw new Error('エスカレーション統計の取得に失敗しました');
    }
  }

  // エスカレーション一覧取得（管理画面用）
  async getEscalations(options: {
    status?: string;
    priority?: string;
    assignedAgent?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
  } = {}): Promise<AxiosResponse<APIResponse<{
    escalations: Array<{
      id: string;
      ticketId: string;
      sessionToken: string;
      reason: string;
      priority: string;
      status: string;
      assignedAgent?: string;
      estimatedWaitTime: number;
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: {
      limit: number;
      offset: number;
      total: number;
    };
  }>>> {
    try {
      const response = await this.client.get('/escalation', {
        params: options
      });
      return response;
    } catch (error) {
      console.error('エスカレーション一覧取得エラー:', error);
      throw new Error('エスカレーション一覧の取得に失敗しました');
    }
  }

  // エスカレーション更新（管理画面用）
  async updateEscalation(ticketId: string, updateData: {
    status?: string;
    assignedAgent?: string;
    notes?: string;
    estimatedWaitTime?: number;
  }): Promise<AxiosResponse<APIResponse<{
    ticketId: string;
    status: string;
    priority: string;
    assignedAgent?: string;
    estimatedWaitTime?: number;
    updatedAt: string;
  }>>> {
    try {
      const response = await this.client.put(`/escalation/${ticketId}`, updateData);
      return response;
    } catch (error) {
      console.error('エスカレーション更新エラー:', error);
      throw new Error('エスカレーションの更新に失敗しました');
    }
  }

  // エスカレーション詳細取得
  async getEscalationDetails(ticketId: string): Promise<AxiosResponse<APIResponse<{
    ticketId: string;
    sessionId: string;
    reason: string;
    priority: string;
    status: string;
    assignedAgent?: string;
    contactInfo: Record<string, any>;
    context: Record<string, any>;
    estimatedWaitTime: number;
    createdAt: string;
    updatedAt: string;
    customerInfo: {
      phoneNumber?: string;
    };
  }>>> {
    try {
      const response = await this.client.get(`/escalation/${ticketId}`);
      return response;
    } catch (error) {
      console.error('エスカレーション詳細取得エラー:', error);
      throw new Error('エスカレーション詳細の取得に失敗しました');
    }
  }

  // FAQ統計取得（管理画面用）
  async getFAQStats(): Promise<AxiosResponse<APIResponse<{
    totalFAQs: number;
    categoryStats: Array<{ category: string; count: number }>;
    carrierStats: Array<{ carrier: string; count: number }>;
    popularFAQs: Array<{ id: string; question: string; views: number }>;
  }>>> {
    try {
      const response = await this.client.get('/faq/stats');
      return response;
    } catch (error) {
      console.error('FAQ統計取得エラー:', error);
      throw new Error('FAQ統計の取得に失敗しました');
    }
  }

  // エスカレーション解決
  async resolveEscalation(ticketId: string, resolutionData: {
    resolution?: string;
    feedback?: string;
    rating?: number;
  }): Promise<AxiosResponse<APIResponse<{
    ticketId: string;
    status: string;
    resolution?: string;
    feedback?: string;
    rating?: number;
    resolvedAt?: string;
  }>>> {
    try {
      const response = await this.client.post(`/escalation/${ticketId}/resolve`, resolutionData);
      return response;
    } catch (error) {
      console.error('エスカレーション解決エラー:', error);
      throw new Error('エスカレーションの解決に失敗しました');
    }
  }

  // FAQ管理（管理画面用）
  async createFAQ(faqData: {
    category: string;
    subcategory?: string;
    question: string;
    answer: string;
    keywords?: string[];
    priority?: number;
    carrierSpecific?: string;
  }): Promise<AxiosResponse<APIResponse<{
    id: string;
    category: string;
    question: string;
    answer: string;
    createdAt: string;
  }>>> {
    try {
      const response = await this.client.post('/faq', faqData);
      return response;
    } catch (error) {
      console.error('FAQ作成エラー:', error);
      throw new Error('FAQの作成に失敗しました');
    }
  }

  async updateFAQ(faqId: string, updateData: {
    question?: string;
    answer?: string;
    keywords?: string[];
    priority?: number;
    isActive?: boolean;
  }): Promise<AxiosResponse<APIResponse<{
    id: string;
    question: string;
    answer: string;
    updatedAt: string;
  }>>> {
    try {
      const response = await this.client.put(`/faq/${faqId}`, updateData);
      return response;
    } catch (error) {
      console.error('FAQ更新エラー:', error);
      throw new Error('FAQの更新に失敗しました');
    }
  }

  async deleteFAQ(faqId: string): Promise<AxiosResponse<APIResponse<{}>>> {
    try {
      const response = await this.client.delete(`/faq/${faqId}`);
      return response;
    } catch (error) {
      console.error('FAQ削除エラー:', error);
      throw new Error('FAQの削除に失敗しました');
    }
  }

  // APIクライアントの設定変更
  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  removeAuthToken() {
    delete this.client.defaults.headers.common['Authorization'];
  }

  setTimeout(timeout: number) {
    this.client.defaults.timeout = timeout;
  }

  // デバッグ用: APIクライアント情報
  getClientInfo() {
    return {
      baseURL: this.client.defaults.baseURL,
      timeout: this.client.defaults.timeout,
      headers: this.client.defaults.headers,
    };
  }
}

// シングルトンインスタンス
export const chatApi = new ChatApiService();

// 便利なヘルパー関数
export const chatApiHelpers = {
  // エラーメッセージの正規化
  normalizeError: (error: any): string => {
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return '不明なエラーが発生しました';
  },

  // レスポンスが成功かどうかの判定
  isSuccessResponse: (response: AxiosResponse<APIResponse<any>>): boolean => {
    return response.status >= 200 && response.status < 300 && response.data.success;
  },

  // セッショントークンの有効性チェック
  isValidSessionToken: (token: string): boolean => {
    if (!token || typeof token !== 'string') return false;
    
    // UUIDv4の形式をチェック
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(token);
  },
};