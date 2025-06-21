/**
 * チャットメッセージコンポーネント
 * Purpose: LINE風メッセージバブルの表示
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Message } from '../../types/chat';

interface ChatMessageProps {
  message: Message;
  isLastMessage?: boolean;
  onActionClick?: (action: any) => void;
  className?: string;
}

/**
 * チャットメッセージコンポーネント
 * Features:
 * - LINE風デザイン
 * - ユーザー/AIメッセージの区別
 * - アクションボタン表示
 * - 時刻表示
 * - 長文の展開/折りたたみ
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLastMessage = false,
  onActionClick,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  
  // メッセージの長さ判定（150文字超で折りたたみ対象）
  const isLongMessage = message.content.length > 150;
  const shouldShowExpanded = isExpanded || !isLongMessage;
  const displayContent = shouldShowExpanded 
    ? message.content 
    : message.content.substring(0, 150) + '...';

  /**
   * メッセージのスタイルクラス生成
   */
  const getMessageStyles = () => {
    if (isSystem) {
      return {
        container: 'flex justify-center',
        bubble: 'bg-gray-100 text-gray-600 px-3 py-2 rounded-full text-sm max-w-xs',
        textAlign: 'text-center'
      };
    }

    if (isUser) {
      return {
        container: 'flex justify-end',
        bubble: 'bg-blue-500 text-white px-4 py-3 rounded-l-2xl rounded-tr-2xl max-w-xs md:max-w-sm shadow-sm',
        textAlign: 'text-left'
      };
    }

    return {
      container: 'flex justify-start',
      bubble: 'bg-white text-gray-800 px-4 py-3 rounded-r-2xl rounded-tl-2xl max-w-xs md:max-w-sm shadow-sm border border-gray-100',
      textAlign: 'text-left'
    };
  };

  const styles = getMessageStyles();

  /**
   * アクションボタンレンダリング
   */
  const renderActions = () => {
    if (!message.metadata?.actions || message.metadata.actions.length === 0) {
      return null;
    }

    return (
      <div className="mt-3 space-y-2">
        {message.metadata.actions.map((action: any, index: number) => (
          <motion.button
            key={index}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onActionClick?.(action)}
            className={`
              w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${action.type === 'escalation' 
                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
              }
            `}
          >
            {action.label}
          </motion.button>
        ))}
      </div>
    );
  };

  /**
   * 時刻フォーマット
   */
  const formatTime = (date: Date) => {
    return format(date, 'HH:mm', { locale: ja });
  };

  return (
    <motion.div
      className={`${styles.container} ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      data-testid={`${message.type}-message`}
    >
      <div className="flex flex-col space-y-1 max-w-full">
        {/* AIアバター（AI メッセージの場合のみ） */}
        {!isUser && !isSystem && (
          <div className="flex items-start space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex-shrink-0 flex items-center justify-center">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div className="flex-1">
              {/* メッセージバブル */}
              <div className={`${styles.bubble} ${styles.textAlign}`} data-testid="ai-message">
                <div className="whitespace-pre-wrap break-words">
                  {displayContent}
                </div>
                
                {/* 展開/折りたたみボタン */}
                {isLongMessage && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-blue-300 hover:text-blue-100 text-sm mt-2 underline"
                  >
                    {isExpanded ? '折りたたむ' : 'もっと読む'}
                  </button>
                )}
              </div>

              {/* アクションボタン */}
              {renderActions()}

              {/* 時刻表示（最後のメッセージのみ） */}
              {isLastMessage && (
                <div className="text-xs text-gray-400 mt-1 ml-1">
                  {formatTime(message.timestamp)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ユーザー・システムメッセージ */}
        {(isUser || isSystem) && (
          <div>
            <div className={`${styles.bubble} ${styles.textAlign}`}>
              <div className="whitespace-pre-wrap break-words">
                {displayContent}
              </div>
              
              {/* 展開/折りたたみボタン */}
              {isLongMessage && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`
                    text-sm mt-2 underline
                    ${isUser ? 'text-blue-200 hover:text-blue-100' : 'text-gray-500 hover:text-gray-400'}
                  `}
                >
                  {isExpanded ? '折りたたむ' : 'もっと読む'}
                </button>
              )}
            </div>

            {/* 時刻表示（最後のメッセージのみ） */}
            {isLastMessage && !isSystem && (
              <div className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right mr-1' : 'text-left ml-1'}`}>
                {formatTime(message.timestamp)}
                {/* 既読マーク（ユーザーメッセージの場合） */}
                {isUser && (
                  <span className="ml-1 text-blue-400">✓</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatMessage;