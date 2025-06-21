import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../common/Button';
import { useChatStore } from '../../store/chatStore';
import { chatApi } from '../../services/chatApi';
import { logger } from '../../utils/logger';

interface EscalationButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onEscalationStart?: () => void;
  onEscalationComplete?: (ticketId: string) => void;
  onError?: (error: string) => void;
}

interface EscalationFormData {
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  contactInfo: {
    email?: string;
    phone?: string;
  };
  context?: Record<string, any>;
}

export const EscalationButton: React.FC<EscalationButtonProps> = ({
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  onEscalationStart,
  onEscalationComplete,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<EscalationFormData>({
    reason: '',
    priority: 'medium',
    contactInfo: {},
    context: {}
  });

  const sessionToken = useChatStore(state => state.currentSession?.sessionToken);
  const messages = useChatStore(state => state.messages);
  const escalationState = useChatStore(state => state.escalationState);
  const updateEscalationState = useChatStore(state => state.updateEscalationState);

  const handleEscalationStart = () => {
    setShowForm(true);
    onEscalationStart?.();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionToken) {
      onError?.('セッショントークンが見つかりません');
      return;
    }

    if (!formData.reason.trim()) {
      onError?.('エスカレーション理由を入力してください');
      return;
    }

    setIsLoading(true);

    try {
      const response = await chatApi.initiateEscalation({
        sessionToken,
        reason: formData.reason,
        priority: formData.priority,
        contactInfo: formData.contactInfo,
        context: {
          ...formData.context,
          messageCount: messages.length,
          lastMessage: messages[messages.length - 1]?.content || '',
          timestamp: new Date().toISOString()
        }
      });

      if (response.data) {
        updateEscalationState({
          isEscalated: true,
          reason: formData.reason,
          timestamp: new Date().toISOString(),
          ticketId: response.data.ticketId,
          estimatedWaitTime: response.data.estimatedWaitTime,
          status: 'pending'
        });

        setShowForm(false);
        onEscalationComplete?.(response.data.ticketId);

        logger.info('エスカレーション開始完了', {
          ticketId: response.data.ticketId,
          priority: formData.priority
        });
      } else {
        throw new Error('エスカレーションの開始に失敗しました');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'エスカレーションの開始に失敗しました';
      onError?.(errorMessage);
      logger.error('エスカレーション開始エラー', { error });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setFormData({
      reason: '',
      priority: 'medium',
      contactInfo: {},
      context: {}
    });
  };

  if (escalationState?.isEscalated) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="escalation-active bg-amber-50 border border-amber-200 rounded-lg p-4"
      >
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              サポートに転送済み
            </p>
            <p className="text-xs text-amber-600">
              チケット番号: {escalationState.ticketId}
              {escalationState.estimatedWaitTime && (
                <span className="ml-2">
                  推定待ち時間: {escalationState.estimatedWaitTime}分
                </span>
              )}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleEscalationStart}
        disabled={disabled || isLoading}
        className={`escalation-button ${className}`}
      >
        <span className="flex items-center space-x-2">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>担当者に相談</span>
        </span>
      </Button>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleFormCancel();
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <form onSubmit={handleFormSubmit} className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    担当者へのエスカレーション
                  </h3>
                  <button
                    type="button"
                    onClick={handleFormCancel}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 理由 */}
                  <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                      相談内容 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      rows={4}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="どのようなことでお困りですか？具体的にお聞かせください。"
                    />
                  </div>

                  {/* 優先度 */}
                  <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                      緊急度
                    </label>
                    <select
                      id="priority"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as EscalationFormData['priority'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">低（一般的な質問）</option>
                      <option value="medium">中（通常対応）</option>
                      <option value="high">高（優先対応）</option>
                      <option value="urgent">緊急（即座に対応が必要）</option>
                    </select>
                  </div>

                  {/* 連絡先情報 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      連絡先情報（任意）
                    </label>
                    <div className="space-y-3">
                      <input
                        type="email"
                        value={formData.contactInfo.email || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: { ...formData.contactInfo, email: e.target.value }
                        })}
                        placeholder="メールアドレス"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="tel"
                        value={formData.contactInfo.phone || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: { ...formData.contactInfo, phone: e.target.value }
                        })}
                        placeholder="電話番号"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 mt-8">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleFormCancel}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? '送信中...' : '担当者に相談'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EscalationButton;