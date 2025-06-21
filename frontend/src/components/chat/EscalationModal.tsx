import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PhoneIcon, ChatBubbleLeftRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Button from '../common/Button';

interface EscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEscalate: (reason: string, priority: 'low' | 'medium' | 'high' | 'urgent', details?: string) => void;
  sessionContext?: {
    currentStep?: string;
    messages?: any[];
    currentCarrier?: string;
    targetCarrier?: string;
  };
  className?: string;
}

/**
 * エスカレーションモーダル
 * ユーザーが人間のサポートに切り替えるためのインターフェース
 */
export const EscalationModal: React.FC<EscalationModalProps> = ({
  isOpen,
  onClose,
  onEscalate,
  sessionContext,
  className = ''
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const escalationReasons = [
    {
      id: 'complex_procedure',
      title: '手続きが複雑',
      description: 'AIでは対応できない複雑な手続きです',
      icon: '🔧',
      suggestedPriority: 'medium' as const
    },
    {
      id: 'technical_issue',
      title: '技術的な問題',
      description: 'システムやネットワークの技術的問題',
      icon: '⚙️',
      suggestedPriority: 'high' as const
    },
    {
      id: 'urgent_request',
      title: '緊急対応が必要',
      description: '今すぐ解決が必要な問題',
      icon: '🚨',
      suggestedPriority: 'urgent' as const
    },
    {
      id: 'dissatisfied',
      title: 'AI回答に不満',
      description: 'AIの回答では解決できませんでした',
      icon: '😔',
      suggestedPriority: 'medium' as const
    },
    {
      id: 'specific_carrier',
      title: 'キャリア固有の問題',
      description: '特定のキャリアに関する詳細な質問',
      icon: '📱',
      suggestedPriority: 'medium' as const
    },
    {
      id: 'other',
      title: 'その他',
      description: '上記以外の理由',
      icon: '💬',
      suggestedPriority: 'low' as const
    }
  ];

  const priorityLevels = [
    {
      id: 'low',
      title: '低',
      description: '時間に余裕がある',
      color: 'bg-green-100 text-green-800 border-green-200',
      estimatedWait: '1-2時間'
    },
    {
      id: 'medium',
      title: '中',
      description: '通常の対応',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      estimatedWait: '30-60分'
    },
    {
      id: 'high',
      title: '高',
      description: '優先的に対応',
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      estimatedWait: '15-30分'
    },
    {
      id: 'urgent',
      title: '緊急',
      description: '即座に対応が必要',
      color: 'bg-red-100 text-red-800 border-red-200',
      estimatedWait: '5-15分'
    }
  ];

  const handleReasonSelect = (reasonId: string) => {
    setSelectedReason(reasonId);
    const reason = escalationReasons.find(r => r.id === reasonId);
    if (reason) {
      setSelectedPriority(reason.suggestedPriority);
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    try {
      await onEscalate(selectedReason, selectedPriority, details);
      onClose();
    } catch (error) {
      console.error('Escalation failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedReasonData = escalationReasons.find(r => r.id === selectedReason);
  const selectedPriorityData = priorityLevels.find(p => p.id === selectedPriority);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* バックドロップ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          >
            {/* モーダル */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto ${className}`}
            >
              {/* ヘッダー */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <ExclamationTriangleIcon className="h-6 w-6 text-orange-500" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    オペレーターに相談
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* コンテンツ */}
              <div className="p-6 space-y-6">
                {/* 説明 */}
                <div className="text-sm text-gray-600">
                  <p>
                    AIでは解決できない問題について、人間のオペレーターがサポートいたします。
                    以下の情報を選択してください。
                  </p>
                </div>

                {/* 理由選択 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">
                    相談理由を選択してください
                  </h3>
                  <div className="space-y-2">
                    {escalationReasons.map((reason) => (
                      <motion.div
                        key={reason.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleReasonSelect(reason.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedReason === reason.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <span className="text-lg">{reason.icon}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {reason.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {reason.description}
                            </p>
                          </div>
                          {selectedReason === reason.id && (
                            <div className="text-blue-500">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* 優先度選択 */}
                {selectedReason && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      緊急度を選択してください
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {priorityLevels.map((priority) => (
                        <motion.div
                          key={priority.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedPriority(priority.id as any)}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedPriority === priority.id
                              ? `${priority.color} border-2`
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-center">
                            <p className="text-sm font-medium">
                              {priority.title}
                            </p>
                            <p className="text-xs mt-1">
                              {priority.description}
                            </p>
                            <p className="text-xs mt-1 text-gray-600">
                              待ち時間: {priority.estimatedWait}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 詳細入力 */}
                {selectedReason && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      詳細（任意）
                    </h3>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="具体的な問題や状況をお聞かせください..."
                      className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {details.length}/500文字
                    </p>
                  </motion.div>
                )}

                {/* セッション情報 */}
                {sessionContext && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="text-xs font-medium text-gray-700 mb-2">
                      現在の状況
                    </h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      {sessionContext.currentStep && (
                        <p>ステップ: {sessionContext.currentStep}</p>
                      )}
                      {sessionContext.currentCarrier && (
                        <p>現在のキャリア: {sessionContext.currentCarrier}</p>
                      )}
                      {sessionContext.targetCarrier && (
                        <p>移行先キャリア: {sessionContext.targetCarrier}</p>
                      )}
                      {sessionContext.messages && (
                        <p>メッセージ数: {sessionContext.messages.length}件</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* フッター */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-2">
                  {selectedPriorityData && (
                    <div className="text-xs text-gray-600">
                      <ChatBubbleLeftRightIcon className="h-4 w-4 inline mr-1" />
                      推定待ち時間: {selectedPriorityData.estimatedWait}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!selectedReason || isSubmitting}
                    className="flex items-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        />
                        <span>接続中...</span>
                      </>
                    ) : (
                      <>
                        <PhoneIcon className="h-4 w-4" />
                        <span>オペレーターに相談</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EscalationModal;