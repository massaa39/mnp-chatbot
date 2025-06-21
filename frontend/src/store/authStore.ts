/**
 * 認証状態管理
 * Purpose: 認証、セッション管理のグローバル状態
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserInfo, SessionInfo } from '../types/api';
import { authAPI } from '../services/authService';
import { logger } from '../utils/logger';

export interface AuthState {
  // 状態
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  session: SessionInfo | null;
  sessionToken: string | null;
  error: string | null;
  
  // アクション
  createSession: (params: {
    phoneNumber?: string;
    currentCarrier?: string;
    targetCarrier?: string;
    mode: 'roadmap' | 'step_by_step';
    preferences?: Record<string, any>;
  }) => Promise<void>;
  
  verifySession: (sessionToken: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
  deleteSession: () => Promise<void>;
  updateUserInfo: (userInfo: Partial<UserInfo>) => void;
  updateSessionInfo: (sessionInfo: Partial<SessionInfo>) => void;
  clearAuth: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初期状態
      isAuthenticated: false,
      isLoading: false,
      user: null,
      session: null,
      sessionToken: null,
      error: null,

      // セッション作成
      createSession: async (params) => {
        set({ isLoading: true, error: null });
        
        try {
          logger.info('セッション作成開始', params);
          
          const response = await authAPI.createSession(params);
          
          if (response.success && response.data) {
            set({
              isAuthenticated: true,
              user: response.data.user,
              session: response.data.session,
              sessionToken: response.data.sessionToken,
              isLoading: false,
              error: null
            });
            
            logger.info('セッション作成成功', { 
              sessionToken: response.data.sessionToken.substring(0, 8) + '...' 
            });
          } else {
            throw new Error(response.error?.message || 'セッション作成に失敗しました');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'セッション作成に失敗しました';
          logger.error('セッション作成エラー', { error: errorMessage });
          
          set({
            isAuthenticated: false,
            user: null,
            session: null,
            sessionToken: null,
            isLoading: false,
            error: errorMessage
          });
          
          throw error;
        }
      },

      // セッション検証
      verifySession: async (sessionToken: string) => {
        set({ isLoading: true, error: null });
        
        try {
          logger.info('セッション検証開始', { 
            sessionToken: sessionToken.substring(0, 8) + '...' 
          });
          
          const response = await authAPI.verifySession(sessionToken);
          
          if (response.success && response.data?.valid) {
            set({
              isAuthenticated: true,
              user: response.data.user || null,
              session: response.data.session || null,
              sessionToken,
              isLoading: false,
              error: null
            });
            
            logger.info('セッション検証成功');
            return true;
          } else {
            // セッション無効
            set({
              isAuthenticated: false,
              user: null,
              session: null,
              sessionToken: null,
              isLoading: false,
              error: null
            });
            
            logger.warn('セッション無効');
            return false;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'セッション検証に失敗しました';
          logger.error('セッション検証エラー', { error: errorMessage });
          
          set({
            isAuthenticated: false,
            user: null,
            session: null,
            sessionToken: null,
            isLoading: false,
            error: errorMessage
          });
          
          return false;
        }
      },

      // セッション更新
      refreshSession: async () => {
        const { sessionToken } = get();
        
        if (!sessionToken) {
          throw new Error('セッショントークンがありません');
        }
        
        set({ isLoading: true, error: null });
        
        try {
          logger.info('セッション更新開始');
          
          const response = await authAPI.refreshSession(sessionToken);
          
          if (response.success) {
            // セッション情報を再取得
            await get().verifySession(sessionToken);
            logger.info('セッション更新成功');
          } else {
            throw new Error(response.error?.message || 'セッション更新に失敗しました');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'セッション更新に失敗しました';
          logger.error('セッション更新エラー', { error: errorMessage });
          
          set({
            isLoading: false,
            error: errorMessage
          });
          
          throw error;
        }
      },

      // セッション削除
      deleteSession: async () => {
        const { sessionToken } = get();
        
        if (!sessionToken) {
          get().clearAuth();
          return;
        }
        
        set({ isLoading: true, error: null });
        
        try {
          logger.info('セッション削除開始');
          
          await authAPI.deleteSession(sessionToken);
          
          get().clearAuth();
          logger.info('セッション削除成功');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'セッション削除に失敗しました';
          logger.error('セッション削除エラー', { error: errorMessage });
          
          // エラーが発生してもローカル状態はクリア
          get().clearAuth();
          
          throw error;
        }
      },

      // ユーザー情報更新
      updateUserInfo: (userInfo: Partial<UserInfo>) => {
        const { user } = get();
        
        if (user) {
          set({
            user: { ...user, ...userInfo }
          });
          
          logger.info('ユーザー情報更新', userInfo);
        }
      },

      // セッション情報更新
      updateSessionInfo: (sessionInfo: Partial<SessionInfo>) => {
        const { session } = get();
        
        if (session) {
          set({
            session: { ...session, ...sessionInfo }
          });
          
          logger.info('セッション情報更新', sessionInfo);
        }
      },

      // 認証状態クリア
      clearAuth: () => {
        set({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          session: null,
          sessionToken: null,
          error: null
        });
        
        logger.info('認証状態クリア');
      },

      // エラー設定
      setError: (error: string | null) => {
        set({ error, isLoading: false });
        
        if (error) {
          logger.error('認証エラー設定', { error });
        }
      },

      // ローディング状態設定
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      }
    }),
    {
      name: 'mnp-auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // セッションストレージに保存する項目を限定
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        session: state.session,
        sessionToken: state.sessionToken
      })
    }
  )
);

// セレクター関数
export const useAuth = () => {
  const store = useAuthStore();
  
  return {
    // 状態
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    user: store.user,
    session: store.session,
    sessionToken: store.sessionToken,
    error: store.error,
    
    // 計算プロパティ
    isGuest: !store.isAuthenticated,
    hasPhoneNumber: !!store.user?.phoneNumber,
    currentMode: store.session?.mode || 'roadmap',
    currentStep: store.session?.currentStep || 'initial',
    
    // アクション
    createSession: store.createSession,
    verifySession: store.verifySession,
    refreshSession: store.refreshSession,
    deleteSession: store.deleteSession,
    updateUserInfo: store.updateUserInfo,
    updateSessionInfo: store.updateSessionInfo,
    clearAuth: store.clearAuth,
    setError: store.setError,
    setLoading: store.setLoading
  };
};

// 認証状態の自動復元
export const initializeAuth = async () => {
  const { sessionToken, verifySession } = useAuthStore.getState();
  
  if (sessionToken) {
    try {
      await verifySession(sessionToken);
    } catch (error) {
      // セッション復元に失敗した場合はクリア
      useAuthStore.getState().clearAuth();
    }
  }
};

export default useAuthStore;