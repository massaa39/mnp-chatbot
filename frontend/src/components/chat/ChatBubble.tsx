import React from 'react';
import { motion } from 'framer-motion';
import { formatDate } from '../../utils/helpers';
import { useUserStore } from '../../store/userStore';
import type { Message } from '../../types/chat';

interface ChatBubbleProps {
  message: Message;
  isLastMessage?: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isLastMessage = false,
  showAvatar = true,
  showTimestamp = true,
}) => {
  const { preferences } = useUserStore();
  const isUser = message.sender === 'user';

  const bubbleVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.8 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }
    },
  };

  const formatTime = (timestamp: string): string => {
    return formatDate(new Date(timestamp), preferences.language);
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={bubbleVariants}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {showAvatar && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden">
            {isUser ? (
              <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                U
              </div>
            ) : (
              <div className="w-full h-full bg-gray-500 flex items-center justify-center text-white text-sm font-medium">
                B
              </div>
            )}
          </div>
        )}
        
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`px-4 py-2 rounded-2xl ${
              isUser
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-gray-100 text-gray-800 rounded-bl-md'
            } break-words max-w-full`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
          
          {showTimestamp && (
            <span className="text-xs text-gray-500 mt-1 px-1">
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
