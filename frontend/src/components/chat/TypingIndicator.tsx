import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  className?: string;
  message?: string;
  avatar?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * AIタイピングインジケーター
 * LINE風の「...」アニメーションを表示
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  className = '',
  message = 'AIが入力中',
  avatar,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base'
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5'
  };

  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      {/* AIアバター */}
      <div className="flex-shrink-0">
        {avatar ? (
          <img 
            src={avatar} 
            alt="AI Assistant" 
            className={`rounded-full ${sizeClasses[size]}`}
          />
        ) : (
          <div className={`bg-blue-500 rounded-full flex items-center justify-center ${sizeClasses[size]}`}>
            <span className="text-white font-semibold text-xs">AI</span>
          </div>
        )}
      </div>

      {/* タイピングバブル */}
      <div className="flex flex-col">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs"
        >
          <div className="flex items-center space-x-1">
            {/* 点滅ドット */}
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className={`bg-gray-400 rounded-full ${dotSizes[size]}`}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.2,
                  ease: 'easeInOut'
                }}
              />
            ))}
          </div>
        </motion.div>
        
        {/* メッセージテキスト */}
        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs text-gray-500 mt-1 ml-2"
          >
            {message}
          </motion.p>
        )}
      </div>
    </div>
  );
};

/**
 * より詳細なタイピングインジケーター
 * 処理状況を表示
 */
interface DetailedTypingIndicatorProps extends TypingIndicatorProps {
  stage?: 'thinking' | 'searching' | 'generating' | 'finalizing';
  progress?: number;
}

export const DetailedTypingIndicator: React.FC<DetailedTypingIndicatorProps> = ({
  className = '',
  stage = 'thinking',
  progress = 0,
  size = 'md',
  avatar
}) => {
  const stageMessages = {
    thinking: '考え中...',
    searching: 'FAQ検索中...',
    generating: '回答生成中...',
    finalizing: '最終調整中...'
  };

  const stageIcons = {
    thinking: '🤔',
    searching: '🔍',
    generating: '✨',
    finalizing: '✅'
  };

  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      <div className="flex-shrink-0">
        {avatar ? (
          <img 
            src={avatar} 
            alt="AI Assistant" 
            className={`rounded-full ${size === 'sm' ? 'h-8' : size === 'lg' ? 'h-12' : 'h-10'}`}
          />
        ) : (
          <div className={`bg-blue-500 rounded-full flex items-center justify-center ${
            size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'
          }`}>
            <span className="text-white font-semibold text-xs">AI</span>
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs"
      >
        <div className="flex items-center space-x-2">
          {/* ステージアイコン */}
          <motion.span
            animate={{ 
              rotate: stage === 'searching' || stage === 'generating' ? 360 : 0 
            }}
            transition={{ 
              duration: 2, 
              repeat: stage === 'searching' || stage === 'generating' ? Infinity : 0,
              ease: 'linear'
            }}
            className="text-lg"
          >
            {stageIcons[stage]}
          </motion.span>

          {/* ステージメッセージ */}
          <span className="text-sm text-gray-700">
            {stageMessages[stage]}
          </span>
        </div>

        {/* プログレスバー */}
        {progress > 0 && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <motion.div
                className="bg-blue-500 h-1.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {Math.round(progress)}%
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

/**
 * シンプルなドットタイピングインジケーター
 */
export const SimpleTypingIndicator: React.FC<{ className?: string }> = ({ 
  className = '' 
}) => {
  return (
    <div className={`flex justify-start ${className}`}>
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex space-x-1">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="w-2 h-2 bg-gray-400 rounded-full"
              animate={{
                y: [0, -8, 0],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: index * 0.2,
                ease: 'easeInOut'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;