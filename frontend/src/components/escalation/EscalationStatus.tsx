import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { chatApi } from '../../services/chatApi';
import { logger } from '../../utils/logger';

interface EscalationStatusData {
  ticketId: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedWaitTime: number;
  assignedAgent?: string;
  createdAt: string;
  updatedAt: string;
  queuePosition?: number;
}

interface EscalationStatusProps {
  className?: string;
  onStatusUpdate?: (status: EscalationStatusData) => void;
  onClose?: () => void;
}

const statusConfig = {
  pending: {
    label: '受付中',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  assigned: {
    label: '担当者決定',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  },
  in_progress: {
    label: '対応中',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  waiting_customer: {
    label: 'お客様回答待ち',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )
  },
  resolved: {
    label: '解決済み',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  cancelled: {
    label: 'キャンセル',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
};

const priorityConfig = {
  urgent: { label: '緊急', color: 'text-red-600', bgColor: 'bg-red-100' },
  high: { label: '高', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  medium: { label: '中', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  low: { label: '低', color: 'text-green-600', bgColor: 'bg-green-100' }
};

export const EscalationStatus: React.FC<EscalationStatusProps> = ({
  className = '',
  onStatusUpdate,
  onClose
}) => {
  const [statusData, setStatusData] = useState<EscalationStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { sessionToken, escalationInfo } = useChatStore();

  useEffect(() => {
    if (escalationInfo?.ticketNumber) {
      fetchEscalationStatus();
      
      // 定期的に状態を更新（30秒間隔）
      const interval = setInterval(fetchEscalationStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [escalationInfo?.ticketNumber]);

  const fetchEscalationStatus = async () => {
    if (!sessionToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.getEscalationStatus(sessionToken);
      
      if (response.success && response.data) {
        setStatusData(response.data);
        setLastUpdated(new Date());
        onStatusUpdate?.(response.data);
      } else {
        throw new Error(response.error?.message || 'エスカレーション状態の取得に失敗しました');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMessage);
      logger.error('エスカレーション状態取得エラー', { error: err });
    } finally {
      setLoading(false);
    }
  };

  const formatWaitTime = (minutes: number): string => {
    if (minutes < 60) {
      return `約${minutes}分`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `約${hours}時間${remainingMinutes}分` : `約${hours}時間`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `約${days}日`;
    }
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!escalationInfo?.isActive || !statusData) {
    return null;
  }

  const config = statusConfig[statusData.status];
  const priorityConf = priorityConfig[statusData.priority];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`escalation-status ${className}`}
      >
        <div className={`bg-white rounded-xl shadow-lg border-2 ${config.borderColor} p-6`}>
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
                {config.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  サポート対応状況
                </h3>
                <p className="text-sm text-gray-500">
                  チケット: {statusData.ticketId}
                </p>
              </div>
            </div>
            
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* 状態情報 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">対応状況</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}>
                  {config.label}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">優先度</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityConf.bgColor} ${priorityConf.color}`}>
                  {priorityConf.label}
                </span>
              </div>

              {statusData.assignedAgent && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">担当者</span>
                  <span className="text-sm text-gray-900">{statusData.assignedAgent}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {statusData.estimatedWaitTime > 0 && statusData.status === 'pending' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">推定待ち時間</span>
                  <span className="text-sm text-gray-900">
                    {formatWaitTime(statusData.estimatedWaitTime)}
                  </span>
                </div>
              )}

              {statusData.queuePosition && statusData.status === 'pending' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">待ち順番</span>
                  <span className="text-sm text-gray-900">
                    {statusData.queuePosition}番目
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">受付時刻</span>
                <span className="text-sm text-gray-900">
                  {formatDateTime(statusData.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* プログレスバー */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">対応進捗</span>
              <span className="text-sm text-gray-500">
                {statusData.status === 'resolved' ? '100%' : 
                 statusData.status === 'in_progress' ? '75%' :
                 statusData.status === 'assigned' ? '50%' : '25%'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className={`h-2 rounded-full ${
                  statusData.status === 'resolved' ? 'bg-green-500' :
                  statusData.status === 'in_progress' ? 'bg-blue-500' :
                  statusData.status === 'assigned' ? 'bg-indigo-500' : 'bg-yellow-500'
                }`}
                initial={{ width: 0 }}
                animate={{ 
                  width: statusData.status === 'resolved' ? '100%' : 
                         statusData.status === 'in_progress' ? '75%' :
                         statusData.status === 'assigned' ? '50%' : '25%'
                }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center justify-between">
            <button
              onClick={fetchEscalationStatus}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <motion.svg
                  className="w-4 h-4"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </motion.svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>状況更新</span>
            </button>

            {lastUpdated && (
              <p className="text-xs text-gray-500">
                最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
              </p>
            )}
          </div>

          {/* エラー表示 */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </motion.div>
          )}

          {/* 連絡先情報（解決済み以外） */}
          {statusData.status !== 'resolved' && statusData.status !== 'cancelled' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
            >
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    担当者からの連絡について
                  </h4>
                  <p className="text-sm text-blue-700">
                    担当者からはチャット、またはご提供いただいた連絡先に直接ご連絡いたします。
                    緊急の場合は、お客様サポートセンター（0120-XXX-XXX）までお電話ください。
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EscalationStatus;