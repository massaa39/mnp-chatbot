/**
 * メインチャット画面コンポーネント
 * Purpose: LINE風UIでユーザーとAIの対話を表示・管理
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../store/chatStore';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { ChatMessage } from './chat/ChatMessage';
import { ChatInput } from './chat/ChatInput';
import { QuickReply } from './chat/QuickReply';
import { TypingIndicator } from './chat/TypingIndicator';
import { EscalationModal } from './chat/EscalationModal';

interface ChatScreenProps {
  onSwipeToRoadmap?: () => void;
  className?: string;
}

/**
 * チャット画面コンポーネント
 * Features:
 * - LINE風メッセージ表示
 * - 自動スクロール
 * - タイピング表示
 * - クイックリプライ
 * - エスカレーション対応
 */
export const ChatScreen: React.FC<ChatScreenProps> = ({
  onSwipeToRoadmap,
  className = ''
}) => {
  // Store state
  const {
    messages,
    currentSession,
    uiState,
    sendMessage,
    startNewSession,
    initiateEscalation
  } = useChatStore();
  
  const { isLoading, isTyping } = uiState;

  // Local state
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [quickReplies, setQuickReplies] = useState<string[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // スワイプジェスチャー
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: onSwipeToRoadmap,
    threshold: 100,
    velocity: 0.3
  });

  /**
   * メッセージエリアの自動スクロール
   */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    });
  }, []);

  /**
   * 新着メッセージ時の自動スクロール
   */
  useEffect(() => {
    if (messages.length > 0) {
      // 少し遅延させてDOMの更新を待つ
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, scrollToBottom]);

  /**
   * セッション初期化
   */
  useEffect(() => {
    if (!currentSession) {
      const initializeSession = async () => {
        try {
          await startNewSession('step_by_step');
        } catch (error) {
          console.error('Failed to initialize session:', error);
        }
      };
      initializeSession();
    }
  }, [currentSession, startNewSession]);

  /**
   * メッセージ送信処理
   */
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || !currentSession) return;

    try {
      setInputValue('');
      
      await sendMessage(message);
      
      // Mock quick replies for development
      setQuickReplies([
        'MNPの手続き方法',
        '必要な書類',
        '手数料について',
        '担当者に相談'
      ]);

    } catch (error: any) {
      console.error('Message send failed:', error);
    }
  }, [currentSession, sendMessage]);

  /**
   * クイックリプライ選択処理
   */
  const handleQuickReply = useCallback((reply: string) => {
    handleSendMessage(reply);
    setQuickReplies([]); // クイックリプライをクリア
  }, [handleSendMessage]);

  /**
   * エスカレーション処理
   */
  const handleEscalation = useCallback(async (reason: string, priority: 'low' | 'medium' | 'high' | 'urgent', details?: string) => {
    if (!currentSession) return;

    try {
      await initiateEscalation(reason);
      setShowEscalationModal(false);
    } catch (error) {
      console.error('Escalation failed:', error);
    }
  }, [currentSession, initiateEscalation]);

  /**
   * メッセージ表示用のアニメーション設定
   */
  const messageAnimationVariants = {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.95 }
  };

  return (
    <div 
      className={`flex flex-col h-full bg-gray-50 ${className}`}
      {...swipeHandlers}
      data-testid="chat-screen"
    >
      {/* チャットヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">AI</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                MNPサポート
              </h1>
              <p className="text-xs text-gray-500">
                {currentSession?.mode === 'roadmap' ? 'ロードマップモード' : 'ステップガイド'}
              </p>
            </div>
          </div>
          
          {/* スワイプヒント */}
          {onSwipeToRoadmap && (
            <motion.div
              className="text-xs text-gray-400 flex items-center space-x-1"
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <span>←</span>
              <span>スワイプ</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* メッセージエリア */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ height: 'calc(100vh - 180px)' }}
        data-testid="chat-container"
      >
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              variants={messageAnimationVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <ChatMessage
                message={message as any}
                isLastMessage={index === messages.length - 1}
                onActionClick={(action) => {
                  if (action.type === 'escalation') {
                    setShowEscalationModal(true);
                  } else if (action.type === 'button') {
                    handleSendMessage(action.value);
                  }
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* タイピングインジケーター */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 自動スクロール用のダミー要素 */}
        <div ref={messagesEndRef} />
      </div>

      {/* クイックリプライ */}
      <AnimatePresence>
        {quickReplies.length > 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-4 py-2"
          >
            <QuickReply
              options={quickReplies.map((text, index) => ({
                id: `quick-${index}`,
                title: text,
                payload: { type: 'quick_reply', value: text }
              }))}
              onSelect={(option) => handleQuickReply(option.payload.value)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 入力エリア */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          disabled={isLoading}
          placeholder="メッセージを入力..."
        />
      </div>

      {/* エスカレーションモーダル */}
      <EscalationModal
        isOpen={showEscalationModal}
        onClose={() => setShowEscalationModal(false)}
        onEscalate={handleEscalation}
        sessionContext={{
          currentStep: currentSession?.currentStep,
          messages: messages.slice(-3) // 直近3件のメッセージ
        }}
      />
    </div>
  );
};

export default ChatScreen;