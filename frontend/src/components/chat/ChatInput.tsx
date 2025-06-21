/**
 * チャット入力コンポーネント
 * Purpose: メッセージ入力とAI応答トリガー
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

/**
 * チャット入力コンポーネント
 * Features:
 * - マルチライン対応
 * - 送信ボタンのアニメーション
 * - 文字数制限
 * - Enterキーでの送信
 * - モバイル最適化
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'メッセージを入力...',
  maxLength = 1000
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  /**
   * テキストエリアの高さ自動調整
   */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  /**
   * 送信処理
   */
  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
    }
  };

  /**
   * キーボードイベント処理
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * 入力値変更処理
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= maxLength) {
      onChange(e.target.value);
    }
  };

  const canSend = value.trim().length > 0 && !disabled;
  const remainingChars = maxLength - value.length;

  return (
    <div className="flex flex-col">
      <div className="flex items-end space-x-3">
        {/* テキスト入力エリア */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className={`
              w-full px-4 py-3 rounded-2xl border resize-none
              transition-all duration-200 ease-in-out
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${isFocused ? 'border-blue-300' : 'border-gray-300'}
              ${disabled ? 'bg-gray-50 text-gray-400' : 'bg-white text-gray-900'}
            `}
            style={{
              minHeight: '48px',
              maxHeight: '120px'
            }}
            data-testid="message-input"
          />
          
          {/* 文字数カウンター */}
          {remainingChars < 100 && (
            <div className={`
              absolute bottom-2 right-2 text-xs
              ${remainingChars < 20 ? 'text-red-500' : 'text-gray-400'}
            `}>
              {remainingChars}
            </div>
          )}
        </div>

        {/* 送信ボタン */}
        <motion.button
          onClick={handleSend}
          disabled={!canSend}
          whileHover={canSend ? { scale: 1.05 } : {}}
          whileTap={canSend ? { scale: 0.95 } : {}}
          className={`
            flex items-center justify-center w-12 h-12 rounded-full
            transition-colors duration-200 ease-in-out
            ${canSend 
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
          data-testid="send-button"
        >
          ➤
        </motion.button>
      </div>

      {/* 入力ヒント */}
      {isFocused && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mt-2 text-xs text-gray-500 px-1"
        >
          Enterで送信、Shift+Enterで改行
        </motion.div>
      )}
    </div>
  );
};

export default ChatInput;