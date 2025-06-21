/**
 * ChatStore テスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useChatStore } from '../../../../frontend/src/store/chatStore';
import { chatApi } from '../../../../frontend/src/services/chatApi';

// API モック
vi.mock('../../../../frontend/src/services/chatApi');
vi.mock('../../../../frontend/src/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      sessionToken: 'test-session-token',
    }),
  },
}));

const mockChatApi = chatApi as any;

describe('ChatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // ストアをリセット
    const { result } = renderHook(() => useChatStore());
    act(() => {
      result.current.clearMessages();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('メッセージ操作', () => {
    it('addMessage でメッセージを追加できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'user',
          content: 'テストメッセージ',
          sender: 'user',
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toMatchObject({
        type: 'user',
        content: 'テストメッセージ',
        sender: 'user',
        id: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it('updateMessage でメッセージを更新できる', () => {
      const { result } = renderHook(() => useChatStore());

      // メッセージを追加
      act(() => {
        result.current.addMessage({
          type: 'ai',
          content: '元のメッセージ',
          sender: 'ai',
        });
      });

      const messageId = result.current.messages[0].id;

      // メッセージを更新
      act(() => {
        result.current.updateMessage(messageId, {
          content: '更新されたメッセージ',
        });
      });

      expect(result.current.messages[0].content).toBe('更新されたメッセージ');
    });

    it('deleteMessage でメッセージを削除できる', () => {
      const { result } = renderHook(() => useChatStore());

      // メッセージを追加
      act(() => {
        result.current.addMessage({
          type: 'user',
          content: '削除テスト',
          sender: 'user',
        });
      });

      const messageId = result.current.messages[0].id;

      // メッセージを削除
      act(() => {
        result.current.deleteMessage(messageId);
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it('clearMessages で全メッセージを削除できる', () => {
      const { result } = renderHook(() => useChatStore());

      // 複数のメッセージを追加
      act(() => {
        result.current.addMessage({
          type: 'user',
          content: 'メッセージ1',
          sender: 'user',
        });
        result.current.addMessage({
          type: 'ai',
          content: 'メッセージ2',
          sender: 'ai',
        });
      });

      expect(result.current.messages).toHaveLength(2);

      // 全削除
      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.currentSession).toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('メッセージ送信が正常に動作する', async () => {
      const mockResponse = {
        data: {
          data: {
            message: 'AIからの応答',
            metadata: {
              confidenceScore: 0.9,
              responseTime: 150,
            },
            actions: [
              {
                type: 'button',
                label: 'テストアクション',
                value: 'test',
              },
            ],
          },
          sessionInfo: {
            id: 'session-1',
            sessionToken: 'test-token',
            mode: 'step_by_step',
          },
          shouldEscalate: false,
        },
      };

      mockChatApi.sendMessage.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.sendMessage('ユーザーメッセージ');
      });

      // ユーザーメッセージとAI応答の両方が追加されることを確認
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toMatchObject({
        type: 'user',
        content: 'ユーザーメッセージ',
        sender: 'user',
      });
      expect(result.current.messages[1]).toMatchObject({
        type: 'ai',
        content: 'AIからの応答',
        sender: 'ai',
        metadata: {
          confidence: 0.9,
          sources: mockResponse.data.data.actions,
          responseTime: 150,
        },
      });

      // セッション情報が更新されることを確認
      expect(result.current.currentSession).toEqual(mockResponse.data.sessionInfo);
    });

    it('エスカレーションが推奨される場合に状態を更新する', async () => {
      const mockResponse = {
        data: {
          data: {
            message: 'エスカレーション必要',
          },
          shouldEscalate: true,
          escalationReason: 'システムが有人対応を推奨',
        },
      };

      mockChatApi.sendMessage.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.sendMessage('複雑な質問');
      });

      expect(result.current.escalationState.reason).toBe('システムが有人対応を推奨');
    });

    it('送信エラー時にエラーメッセージを追加する', async () => {
      mockChatApi.sendMessage.mockRejectedValue(new Error('ネットワークエラー'));

      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.sendMessage('エラーテスト');
      });

      // ユーザーメッセージとエラーメッセージが追加されることを確認
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1]).toMatchObject({
        type: 'system',
        content: 'メッセージの送信に失敗しました。もう一度お試しください。',
        sender: 'system',
      });

      // エラー状態が設定されることを確認
      expect(result.current.uiState.error).toBeTruthy();
    });

    it('セッショントークンがない場合にエラーを投げる', async () => {
      // authStore をモックしてセッショントークンなしの状態にする
      vi.doMock('../../../../frontend/src/store/authStore', () => ({
        useAuthStore: {
          getState: () => ({
            sessionToken: null,
          }),
        },
      }));

      const { result } = renderHook(() => useChatStore());

      await expect(
        act(async () => {
          await result.current.sendMessage('テスト');
        })
      ).rejects.toThrow('セッションが初期化されていません');
    });
  });

  describe('startNewSession', () => {
    it('新しいセッションを開始できる', async () => {
      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.startNewSession('roadmap');
      });

      // モードが設定されることを確認
      expect(result.current.mode).toBe('roadmap');

      // ウェルカムメッセージが追加されることを確認
      expect(result.current.messages).toHaveLength(2); // モード切替 + ウェルカム
      expect(result.current.messages[1]).toMatchObject({
        type: 'ai',
        content: expect.stringContaining('MNP'),
        sender: 'ai',
      });
    });

    it('既存セッションがある場合に履歴を読み込む', async () => {
      const mockHistoryResponse = {
        data: {
          messages: [
            {
              id: 'msg-1',
              type: 'ai',
              content: '過去のメッセージ',
              sender: 'ai',
              timestamp: '2024-01-01T00:00:00Z',
            },
          ],
          sessionInfo: {
            id: 'existing-session',
            mode: 'step_by_step',
          },
          mode: 'step_by_step',
        },
      };

      mockChatApi.getChatHistory.mockResolvedValue(mockHistoryResponse);

      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.startNewSession();
      });

      // 履歴が読み込まれることを確認
      expect(result.current.messages).toContain(
        expect.objectContaining({
          content: '過去のメッセージ',
        })
      );
      expect(result.current.currentSession).toEqual(mockHistoryResponse.data.sessionInfo);
    });
  });

  describe('UI状態管理', () => {
    it('setUIState でUI状態を更新できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setUIState({
          isLoading: true,
          error: 'テストエラー',
        });
      });

      expect(result.current.uiState.isLoading).toBe(true);
      expect(result.current.uiState.error).toBe('テストエラー');
    });

    it('setTyping でタイピング状態を設定できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setTyping(true);
      });

      expect(result.current.uiState.isTyping).toBe(true);

      act(() => {
        result.current.setTyping(false);
      });

      expect(result.current.uiState.isTyping).toBe(false);
    });

    it('setLoading でローディング状態を設定できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.uiState.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.uiState.isLoading).toBe(false);
    });
  });

  describe('エスカレーション', () => {
    it('initiateEscalation でエスカレーションを開始できる', async () => {
      const mockResponse = {
        data: {
          ticketId: 'TICKET-12345',
          estimatedWaitTime: 5,
        },
      };

      mockChatApi.initiateEscalation.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.initiateEscalation('複雑な問題');
      });

      expect(result.current.escalationState).toMatchObject({
        isEscalated: true,
        reason: '複雑な問題',
        ticketId: 'TICKET-12345',
        estimatedWaitTime: 5,
        status: 'pending',
        timestamp: expect.any(String),
      });

      // システムメッセージが追加されることを確認
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toMatchObject({
        type: 'system',
        content: expect.stringContaining('TICKET-12345'),
        sender: 'system',
      });
    });

    it('updateEscalationState でエスカレーション状態を更新できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.updateEscalationState({
          status: 'connected',
          ticketId: 'TICKET-67890',
        });
      });

      expect(result.current.escalationState.status).toBe('connected');
      expect(result.current.escalationState.ticketId).toBe('TICKET-67890');
    });
  });

  describe('モード管理', () => {
    it('switchMode でモードを切り替えできる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.switchMode('roadmap');
      });

      expect(result.current.mode).toBe('roadmap');

      // モード切り替えメッセージが追加されることを確認
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toMatchObject({
        type: 'system',
        content: 'ロードマップモードに切り替えました。全体の流れをご確認いただけます。',
        sender: 'system',
      });
    });
  });

  describe('ユーティリティ関数', () => {
    it('getMessageById で指定IDのメッセージを取得できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'user',
          content: 'テストメッセージ',
          sender: 'user',
        });
      });

      const messageId = result.current.messages[0].id;
      const message = result.current.getMessageById(messageId);

      expect(message).toMatchObject({
        id: messageId,
        content: 'テストメッセージ',
      });
    });

    it('getLastUserMessage で最新のユーザーメッセージを取得できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'user',
          content: '最初のユーザーメッセージ',
          sender: 'user',
        });
        result.current.addMessage({
          type: 'ai',
          content: 'AI応答',
          sender: 'ai',
        });
        result.current.addMessage({
          type: 'user',
          content: '最新のユーザーメッセージ',
          sender: 'user',
        });
      });

      const lastUserMessage = result.current.getLastUserMessage();

      expect(lastUserMessage?.content).toBe('最新のユーザーメッセージ');
    });

    it('getLastAIMessage で最新のAIメッセージを取得できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'ai',
          content: '最初のAI応答',
          sender: 'ai',
        });
        result.current.addMessage({
          type: 'user',
          content: 'ユーザーメッセージ',
          sender: 'user',
        });
        result.current.addMessage({
          type: 'ai',
          content: '最新のAI応答',
          sender: 'ai',
        });
      });

      const lastAIMessage = result.current.getLastAIMessage();

      expect(lastAIMessage?.content).toBe('最新のAI応答');
    });

    it('exportChatHistory でチャット履歴をエクスポートできる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'user',
          content: 'エクスポートテスト',
          sender: 'user',
        });
      });

      const exportData = result.current.exportChatHistory();
      const parsed = JSON.parse(exportData);

      expect(parsed).toMatchObject({
        exportDate: expect.any(String),
        mode: 'step_by_step',
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: 'エクスポートテスト',
          }),
        ]),
      });
    });
  });

  describe('永続化', () => {
    it('重要な状態が永続化される', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.switchMode('roadmap');
      });

      // Zustandの永続化ミドルウェアが動作することを確認
      // 実際のテストでは localStorage のモックを確認
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });
});