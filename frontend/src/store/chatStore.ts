import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { 
  ChatState, 
  Message, 
  ChatMode, 
  UIState,
  MessageType,
  EscalationState 
} from '../types/chat';
import type { SessionInfo } from '../types/api';
import { chatApi } from '../services/chatApi';
import { useAuthStore } from './authStore';

export interface ChatStore extends ChatState {
  // メッセージ操作
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  
  // チャット操作
  sendMessage: (content: string) => Promise<void>;
  startNewSession: (mode?: ChatMode) => Promise<void>;
  loadChatHistory: (sessionToken: string) => Promise<void>;
  
  // UI状態管理
  setUIState: (updates: Partial<UIState>) => void;
  setTyping: (isTyping: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  
  // エスカレーション
  initiateEscalation: (reason: string) => Promise<void>;
  updateEscalationState: (state: Partial<EscalationState>) => void;
  
  // モード管理
  switchMode: (mode: ChatMode) => void;
  
  // ユーティリティ
  getMessageById: (id: string) => Message | undefined;
  getLastUserMessage: () => Message | undefined;
  getLastAIMessage: () => Message | undefined;
  exportChatHistory: () => string;
}

const initialState: ChatState = {
  messages: [],
  currentSession: null,
  mode: 'step_by_step',
  uiState: {
    isLoading: false,
    isTyping: false,
    error: null,
    isConnected: true,
    showQuickReplies: true,
    scrollToBottom: false,
  },
  escalationState: {
    isEscalated: false,
    reason: null,
    timestamp: null,
    ticketId: null,
    estimatedWaitTime: null,
    status: 'none',
  },
  preferences: {
    notifications: true,
    sound: true,
    theme: 'light',
    language: 'ja',
  },
};

export const useChatStore = create<ChatStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState,

          // メッセージ操作
          addMessage: (messageData) => {
            set((state) => {
              const newMessage: Message = {
                ...messageData,
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
              };
              state.messages.push(newMessage);
              state.uiState.scrollToBottom = true;
            });
          },

          updateMessage: (id, updates) => {
            set((state) => {
              const messageIndex = state.messages.findIndex(msg => msg.id === id);
              if (messageIndex !== -1) {
                state.messages[messageIndex] = {
                  ...state.messages[messageIndex],
                  ...updates,
                };
              }
            });
          },

          deleteMessage: (id) => {
            set((state) => {
              state.messages = state.messages.filter(msg => msg.id !== id);
            });
          },

          clearMessages: () => {
            set((state) => {
              state.messages = [];
              state.currentSession = null;
              state.escalationState = initialState.escalationState;
            });
          },

          // チャット操作
          sendMessage: async (content) => {
            const { sessionToken } = useAuthStore.getState();
            
            if (!sessionToken) {
              throw new Error('セッションが初期化されていません');
            }

            try {
              // ユーザーメッセージを追加
              get().addMessage({
                type: 'user',
                content,
                sender: 'user',
              });

              // ローディング状態を設定
              get().setLoading(true);
              get().setTyping(true);

              try {
                // APIにメッセージを送信
                const response = await chatApi.sendMessage({
                  sessionToken,
                  message: content,
                  mode: get().mode,
                });

                // AIレスポンスを追加
                get().addMessage({
                  type: 'ai',
                  content: response.data.data?.message || 'APIからのレスポンスを受信しました。',
                  sender: 'ai',
                  metadata: {
                    confidence: response.data.data?.metadata?.confidenceScore,
                    sources: response.data.data?.actions,
                    responseTime: response.data.data?.metadata?.responseTime,
                  },
                });

                // セッション情報を更新
                if (response.data.sessionInfo) {
                  set((state) => {
                    state.currentSession = response.data.sessionInfo;
                  });
                }

                // エスカレーションチェック
                if (response.data.shouldEscalate) {
                  get().updateEscalationState({
                    reason: response.data.escalationReason || 'システムが有人対応を推奨しています',
                  });
                }
              } catch (apiError) {
                // API接続失敗時のフォールバックレスポンス
                console.warn('API接続失敗、デモレスポンスで継続:', apiError);
                
                // デモレスポンスを生成
                const demoResponse = get().generateDemoResponse(content);
                get().addMessage({
                  type: 'ai',
                  content: demoResponse,
                  sender: 'ai',
                  metadata: {
                    isDemo: true,
                    responseTime: 1000,
                  },
                });
              }

            } catch (error) {
              console.error('メッセージ送信エラー:', error);
              
              // エラーメッセージを追加
              get().addMessage({
                type: 'system',
                content: 'メッセージの送信に失敗しました。もう一度お試しください。',
                sender: 'system',
              });

              get().setUIState({
                error: error instanceof Error ? error.message : '不明なエラーが発生しました',
              });
            } finally {
              get().setLoading(false);
              get().setTyping(false);
            }
          },

          startNewSession: async (mode = 'step_by_step') => {
            try {
              get().clearMessages();
              get().setLoading(true);

              // ローカルセッション情報を設定
              const sessionId = `local_session_${Date.now()}`;
              set((state) => {
                state.currentSession = {
                  sessionId,
                  mode,
                  status: 'active',
                  currentStep: 'greeting',
                  startedAt: new Date(),
                };
                state.mode = mode;
              });

              // ウェルカムメッセージを追加
              get().addMessage({
                type: 'ai',
                content: 'こんにちは！MNP（携帯番号ポータビリティ）のサポートを担当いたします。\n\nどのようなことでお手伝いできますか？',
                sender: 'ai',
                metadata: {
                  confidence: 1.0,
                  responseTime: 100
                }
              });

              // クイックリプライオプション用のメッセージを追加
              setTimeout(() => {
                get().addMessage({
                  type: 'ai',
                  content: '以下から選択してください：',
                  sender: 'ai',
                  quickReplies: [
                    { text: 'MNP手続きの流れを教えて', value: 'mnp_flow' },
                    { text: '必要な書類は何ですか？', value: 'required_docs' },
                    { text: '手数料について知りたい', value: 'fees_info' },
                    { text: '他の質問をする', value: 'other_question' }
                  ],
                  metadata: {
                    confidence: 1.0,
                    responseTime: 50
                  }
                });
              }, 800);

              // バックグラウンドでAPI接続を試行
              try {
                const { sessionToken } = useAuthStore.getState();
                if (sessionToken) {
                  await get().loadChatHistory(sessionToken);
                }
              } catch (apiError) {
                console.log('API接続失敗、ローカルモードで継続:', apiError);
              }

            } catch (error) {
              console.error('セッション開始エラー:', error);
              
              // エラーが発生しても基本的なウェルカムメッセージを表示
              get().addMessage({
                type: 'ai',
                content: 'こんにちは！MNPサポートへようこそ。現在オフラインモードで動作していますが、基本的な情報をご案内できます。',
                sender: 'ai',
              });
              
            } finally {
              get().setLoading(false);
            }
          },

          loadChatHistory: async (sessionToken) => {
            try {
              get().setLoading(true);
              
              const response = await chatApi.getChatHistory(sessionToken);
              
              if (response && response.data) {
                set((state) => {
                  state.messages = response.data.messages || [];
                  state.currentSession = response.data.sessionInfo || null;
                  state.mode = response.data.mode || 'step_by_step';
                });
              }

            } catch (error) {
              console.error('履歴読み込みエラー:', error);
              // エラーは表示しない（新規セッションとして処理）
              // デフォルトのセッション情報を設定
              set((state) => {
                state.currentSession = {
                  sessionToken,
                  mode: 'step_by_step',
                  currentStep: 'initial',
                  scenarioData: {},
                  contextData: {},
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
              });
            } finally {
              get().setLoading(false);
            }
          },

          // UI状態管理
          setUIState: (updates) => {
            set((state) => {
              Object.assign(state.uiState, updates);
            });
          },

          setTyping: (isTyping) => {
            set((state) => {
              state.uiState.isTyping = isTyping;
            });
          },

          setLoading: (isLoading) => {
            set((state) => {
              state.uiState.isLoading = isLoading;
            });
          },

          // エスカレーション
          initiateEscalation: async (reason) => {
            try {
              const { sessionToken } = useAuthStore.getState();
              
              if (!sessionToken) {
                throw new Error('セッションが初期化されていません');
              }

              const response = await chatApi.initiateEscalation({
                sessionToken,
                reason,
                context: {
                  lastMessages: get().messages.slice(-5),
                  mode: get().mode,
                },
              });

              get().updateEscalationState({
                isEscalated: true,
                reason,
                timestamp: new Date().toISOString(),
                ticketId: response.data.ticketId,
                estimatedWaitTime: response.data.estimatedWaitTime,
                status: 'pending',
              });

              // システムメッセージを追加
              get().addMessage({
                type: 'system',
                content: `有人サポートに接続しています。チケット番号: ${response.data.ticketId}`,
                sender: 'system',
              });

            } catch (error) {
              console.error('エスカレーション開始エラー:', error);
              throw error;
            }
          },

          updateEscalationState: (updates) => {
            set((state) => {
              Object.assign(state.escalationState, updates);
            });
          },

          // モード管理
          switchMode: (mode) => {
            set((state) => {
              state.mode = mode;
            });

            // モード切り替えメッセージを追加
            const modeMessages = {
              step_by_step: 'ステップバイステップモードに切り替えました。順序立ててご案内いたします。',
              roadmap: 'ロードマップモードに切り替えました。全体の流れをご確認いただけます。',
            };

            get().addMessage({
              type: 'system',
              content: modeMessages[mode],
              sender: 'system',
            });
          },

          // ユーティリティ
          getMessageById: (id) => {
            return get().messages.find(msg => msg.id === id);
          },

          getLastUserMessage: () => {
            const messages = get().messages;
            return messages.filter(msg => msg.type === 'user').pop();
          },

          getLastAIMessage: () => {
            const messages = get().messages;
            return messages.filter(msg => msg.type === 'ai').pop();
          },

          exportChatHistory: () => {
            const { messages, currentSession, mode } = get();
            const exportData = {
              exportDate: new Date().toISOString(),
              sessionInfo: currentSession,
              mode,
              messages: messages.map(msg => ({
                ...msg,
                // 機密情報を除外
                metadata: msg.metadata ? {
                  confidence: msg.metadata.confidence,
                  responseTime: msg.metadata.responseTime,
                } : undefined,
              })),
            };
            return JSON.stringify(exportData, null, 2);
          },

          // デモレスポンス生成（API接続失敗時のフォールバック）
          generateDemoResponse: (userMessage: string) => {
            const responses = [
              'MNP手続きについてお質問いただきありがとうございます。現在オフラインモードで動作しておりますが、基本的な情報をご案内できます。',
              'MNP（携帯番号ポータビリティ）は、現在お使いの電話番号をそのまま他のキャリアで使用できるサービスです。手続きにはいくつかのステップがあります。',
              '現在ネットワークに接続できませんが、ローカルに保存された情報でお答えします。MNP手続きに関して、どのようなことを知りたいでしょうか？',
              'お質問ありがとうございます。サーバーとの通信が一時的に不可能ですが、基本的なMNP情報はこのアプリ内でご確認いただけます。'
            ];
            
            // ユーザーメッセージに基づいて適切なレスポンスを選択
            if (userMessage.includes('MNP') || userMessage.includes('携帯') || userMessage.includes('番号')) {
              return responses[1];
            } else if (userMessage.includes('こんにちは') || userMessage.includes('はじめまして')) {
              return responses[0];
            } else {
              return responses[Math.floor(Math.random() * responses.length)];
            }
          },
        }))
      ),
      {
        name: 'mnp-chat-store',
        version: 1,
        partialize: (state) => ({
          // 永続化する状態を選択
          mode: state.mode,
          preferences: state.preferences,
          // セッション情報は認証ストアで管理
        }),
      }
    ),
    {
      name: 'ChatStore',
    }
  )
);

// セレクター関数
export const useChatMessages = () => useChatStore(state => state.messages);
export const useChatUIState = () => useChatStore(state => state.uiState);
export const useChatMode = () => useChatStore(state => state.mode);
export const useEscalationState = () => useChatStore(state => state.escalationState);