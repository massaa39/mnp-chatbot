/**
 * ChatScreen コンポーネントテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChatScreenComponent from '../../../../frontend/src/components/ChatScreen';
import { useChatStore } from '../../../../frontend/src/store/chatStore';

// Zustandストアのモック
vi.mock('../../../../frontend/src/store/chatStore');

// framer-motionのモック
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// react-router-domのモック
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// テストデータ
const mockMessages = [
  {
    id: 'msg-1',
    type: 'ai' as const,
    content: 'こんにちは！MNPサポートを担当いたします。',
    sender: 'ai' as const,
    timestamp: '2024-01-01T00:00:00Z',
  },
  {
    id: 'msg-2',
    type: 'user' as const,
    content: 'MNPの手続きについて教えてください',
    sender: 'user' as const,
    timestamp: '2024-01-01T00:01:00Z',
  },
  {
    id: 'msg-3',
    type: 'ai' as const,
    content: 'MNPの手続きについてご説明します。',
    sender: 'ai' as const,
    timestamp: '2024-01-01T00:02:00Z',
    metadata: {
      confidence: 0.9,
      sources: [
        {
          type: 'button' as const,
          label: '詳細確認',
          value: 'details'
        }
      ]
    }
  },
];

const mockChatState = {
  messages: mockMessages,
  currentSession: {
    id: 'session-1',
    sessionToken: 'test-token',
    userId: 'user-1',
    mode: 'step_by_step' as const,
    currentStep: 'initial',
    status: 'active' as const,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  mode: 'step_by_step' as const,
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
    status: 'none' as const,
  },
  preferences: {
    notifications: true,
    sound: true,
    theme: 'light' as const,
    language: 'ja' as const,
  },
  sendMessage: vi.fn(),
  addMessage: vi.fn(),
  setUIState: vi.fn(),
  initiateEscalation: vi.fn(),
  switchMode: vi.fn(),
};

describe('ChatScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useChatStore as any).mockReturnValue(mockChatState);
  });

  const renderChatScreen = (props = {}) => {
    return render(
      <BrowserRouter>
        <ChatScreenComponent {...props} />
      </BrowserRouter>
    );
  };

  describe('基本表示', () => {
    it('チャット画面が正常に表示される', () => {
      renderChatScreen();

      // ヘッダーの確認
      expect(screen.getByText('MNP チャットサポート')).toBeInTheDocument();

      // メッセージ履歴の確認
      expect(screen.getByText('こんにちは！MNPサポートを担当いたします。')).toBeInTheDocument();
      expect(screen.getByText('MNPの手続きについて教えてください')).toBeInTheDocument();
      expect(screen.getByText('MNPの手続きについてご説明します。')).toBeInTheDocument();

      // 入力フィールドの確認
      expect(screen.getByPlaceholderText('メッセージを入力...')).toBeInTheDocument();
    });

    it('メッセージタイプに応じて適切なスタイルが適用される', () => {
      renderChatScreen();

      // ユーザーメッセージ（右寄せ）
      const userMessage = screen.getByText('MNPの手続きについて教えてください').closest('div');
      expect(userMessage).toHaveClass('ml-8');

      // AIメッセージ（左寄せ）
      const aiMessage = screen.getByText('こんにちは！MNPサポートを担当いたします。').closest('div');
      expect(aiMessage).toHaveClass('mr-8');
    });

    it('アクションボタンが表示される', () => {
      renderChatScreen();

      expect(screen.getByText('詳細確認')).toBeInTheDocument();
    });
  });

  describe('メッセージ送信', () => {
    it('テキスト入力でメッセージを送信できる', async () => {
      renderChatScreen();

      const input = screen.getByPlaceholderText('メッセージを入力...');
      const sendButton = screen.getByLabelText('メッセージを送信');

      // テキスト入力
      fireEvent.change(input, { target: { value: 'テストメッセージ' } });
      expect(input).toHaveValue('テストメッセージ');

      // 送信ボタンクリック
      fireEvent.click(sendButton);

      // sendMessage が呼ばれることを確認
      await waitFor(() => {
        expect(mockChatState.sendMessage).toHaveBeenCalledWith('テストメッセージ');
      });

      // 入力フィールドがクリアされることを確認
      expect(input).toHaveValue('');
    });

    it('Enterキーでメッセージを送信できる', async () => {
      renderChatScreen();

      const input = screen.getByPlaceholderText('メッセージを入力...');

      fireEvent.change(input, { target: { value: 'Enterキーテスト' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

      await waitFor(() => {
        expect(mockChatState.sendMessage).toHaveBeenCalledWith('Enterキーテスト');
      });
    });

    it('空のメッセージは送信できない', async () => {
      renderChatScreen();

      const sendButton = screen.getByLabelText('メッセージを送信');

      // 空の状態で送信ボタンをクリック
      fireEvent.click(sendButton);

      // sendMessage が呼ばれないことを確認
      expect(mockChatState.sendMessage).not.toHaveBeenCalled();
    });

    it('送信中は入力とボタンが無効化される', () => {
      const loadingState = {
        ...mockChatState,
        uiState: {
          ...mockChatState.uiState,
          isLoading: true,
        },
      };
      (useChatStore as any).mockReturnValue(loadingState);

      renderChatScreen();

      const input = screen.getByPlaceholderText('メッセージを入力...');
      const sendButton = screen.getByLabelText('メッセージを送信');

      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });
  });

  describe('UI状態の表示', () => {
    it('タイピングインジケーターが表示される', () => {
      const typingState = {
        ...mockChatState,
        uiState: {
          ...mockChatState.uiState,
          isTyping: true,
        },
      };
      (useChatStore as any).mockReturnValue(typingState);

      renderChatScreen();

      expect(screen.getByText('入力中...')).toBeInTheDocument();
    });

    it('エラーメッセージが表示される', () => {
      const errorState = {
        ...mockChatState,
        uiState: {
          ...mockChatState.uiState,
          error: 'テストエラーメッセージ',
        },
      };
      (useChatStore as any).mockReturnValue(errorState);

      renderChatScreen();

      expect(screen.getByText('テストエラーメッセージ')).toBeInTheDocument();
    });

    it('接続状態が表示される', () => {
      const disconnectedState = {
        ...mockChatState,
        uiState: {
          ...mockChatState.uiState,
          isConnected: false,
        },
      };
      (useChatStore as any).mockReturnValue(disconnectedState);

      renderChatScreen();

      expect(screen.getByText('接続を確認中...')).toBeInTheDocument();
    });
  });

  describe('アクション機能', () => {
    it('アクションボタンクリックで適切な処理が実行される', async () => {
      renderChatScreen();

      const actionButton = screen.getByText('詳細確認');
      fireEvent.click(actionButton);

      // メッセージが送信されることを確認
      await waitFor(() => {
        expect(mockChatState.sendMessage).toHaveBeenCalledWith('詳細確認について教えてください');
      });
    });

    it('エスカレーションボタンでエスカレーション処理が実行される', async () => {
      const messagesWithEscalation = [
        ...mockMessages,
        {
          id: 'msg-4',
          type: 'ai' as const,
          content: 'オペレーターにおつなぎしますか？',
          sender: 'ai' as const,
          timestamp: '2024-01-01T00:03:00Z',
          metadata: {
            sources: [
              {
                type: 'escalation' as const,
                label: 'オペレーターに相談',
                value: 'escalate'
              }
            ]
          }
        },
      ];

      const stateWithEscalation = {
        ...mockChatState,
        messages: messagesWithEscalation,
      };
      (useChatStore as any).mockReturnValue(stateWithEscalation);

      renderChatScreen();

      const escalationButton = screen.getByText('オペレーターに相談');
      fireEvent.click(escalationButton);

      await waitFor(() => {
        expect(mockChatState.initiateEscalation).toHaveBeenCalledWith('ユーザーからの要求');
      });
    });
  });

  describe('ナビゲーション', () => {
    it('設定ボタンで設定画面に遷移する', () => {
      renderChatScreen();

      const settingsButton = screen.getByLabelText('設定');
      fireEvent.click(settingsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });

    it('ロードマップボタンでロードマップ画面に遷移する', () => {
      renderChatScreen();

      const roadmapButton = screen.getByLabelText('ロードマップ');
      fireEvent.click(roadmapButton);

      expect(mockNavigate).toHaveBeenCalledWith('/roadmap');
    });

    it('モード切替ボタンでモードが変更される', () => {
      renderChatScreen();

      const modeButton = screen.getByText('ロードマップ表示');
      fireEvent.click(modeButton);

      expect(mockChatState.switchMode).toHaveBeenCalledWith('roadmap');
    });
  });

  describe('レスポンシブデザイン', () => {
    it('モバイル表示で適切なレイアウトが適用される', () => {
      // モバイル画面サイズをシミュレート
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderChatScreen();

      // モバイル向けクラスが適用されることを確認
      const container = screen.getByRole('main');
      expect(container).toHaveClass('max-w-md', 'mx-auto');
    });
  });

  describe('アクセシビリティ', () => {
    it('適切なARIAラベルが設定されている', () => {
      renderChatScreen();

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'チャットメイン');
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'メッセージ入力');
      expect(screen.getByLabelText('メッセージを送信')).toBeInTheDocument();
    });

    it('キーボードナビゲーションが正常に動作する', () => {
      renderChatScreen();

      const input = screen.getByPlaceholderText('メッセージを入力...');
      
      // Tabキーでフォーカス移動
      fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' });
      
      // フォーカスが送信ボタンに移動することを確認
      const sendButton = screen.getByLabelText('メッセージを送信');
      expect(sendButton).toHaveFocus();
    });
  });

  describe('エラーハンドリング', () => {
    it('メッセージ送信エラー時に適切なフィードバックが表示される', async () => {
      const errorState = {
        ...mockChatState,
        sendMessage: vi.fn().mockRejectedValue(new Error('送信エラー')),
      };
      (useChatStore as any).mockReturnValue(errorState);

      renderChatScreen();

      const input = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(input, { target: { value: 'テストメッセージ' } });

      const sendButton = screen.getByLabelText('メッセージを送信');
      fireEvent.click(sendButton);

      // エラー処理が実行されることを確認
      await waitFor(() => {
        expect(errorState.sendMessage).toHaveBeenCalled();
      });
    });
  });
});