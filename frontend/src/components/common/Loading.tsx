import React from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  text?: string;
  overlay?: boolean;
  className?: string;
}

const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  color = 'primary',
  text,
  overlay = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const colorClasses = {
    primary: 'border-blue-600',
    white: 'border-white',
    gray: 'border-gray-400',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const spinnerVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      },
    },
  };

  const dotsVariants = {
    animate: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const dotVariants = {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  const LoadingSpinner = () => (
    <motion.div
      className={`
        inline-block border-2 border-transparent border-t-current rounded-full
        ${sizeClasses[size]}
        ${colorClasses[color]}
        ${className}
      `}
      variants={spinnerVariants}
      animate="animate"
      role="status"
      aria-label="読み込み中"
    />
  );

  const LoadingDots = () => (
    <motion.div
      className="flex space-x-1"
      variants={dotsVariants}
      animate="animate"
    >
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={`
            w-2 h-2 rounded-full bg-current
            ${color === 'primary' ? 'text-blue-600' : ''}
            ${color === 'white' ? 'text-white' : ''}
            ${color === 'gray' ? 'text-gray-400' : ''}
          `}
          variants={dotVariants}
        />
      ))}
    </motion.div>
  );

  const LoadingContent = () => (
    <div className="flex flex-col items-center justify-center space-y-3">
      <LoadingSpinner />
      {text && (
        <motion.p
          className={`
            text-center font-medium
            ${textSizeClasses[size]}
            ${color === 'primary' ? 'text-gray-600' : ''}
            ${color === 'white' ? 'text-white' : ''}
            ${color === 'gray' ? 'text-gray-400' : ''}
          `}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );

  const ChatTypingIndicator = () => (
    <motion.div
      className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl max-w-fit shadow-sm border border-gray-200"
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <motion.div
        className="flex space-x-1"
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="w-2 h-2 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full shadow-sm"
            animate={{
              y: [0, -6, 0],
              opacity: [0.6, 1, 0.6],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: index * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
      <motion.span
        className="text-sm text-gray-600 font-medium"
        animate={{
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        AIが入力中...
      </motion.span>
    </motion.div>
  );

  // オーバーレイモード
  if (overlay) {
    return (
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-lg p-6 shadow-lg"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <LoadingContent />
        </motion.div>
      </motion.div>
    );
  }

  // チャット用タイピングインジケーター
  if (text === 'typing') {
    return <ChatTypingIndicator />;
  }

  // インラインモード
  return <LoadingContent />;
};

export default Loading;

// 使いやすいプリセット
export const LoadingSpinner: React.FC<{ size?: LoadingProps['size']; className?: string }> = ({
  size,
  className,
}) => <Loading size={size} className={className} />;

export const LoadingOverlay: React.FC<{ text?: string }> = ({ text }) => (
  <Loading overlay text={text} />
);

export const TypingIndicator: React.FC = () => <Loading text="typing" />;

export const PageLoading: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loading size="lg" text="読み込み中..." />
  </div>
);

export const ButtonLoading: React.FC<{ size?: LoadingProps['size'] }> = ({ size = 'sm' }) => (
  <Loading size={size} color="white" />
);