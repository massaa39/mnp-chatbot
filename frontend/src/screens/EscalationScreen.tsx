import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneIcon, ChatBubbleLeftRightIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useChatStore } from '../store/chatStore';
import Button from '../components/common/Button';

/**
 * エスカレーション画面
 * オペレーターとの接続状況を表示
 */
const EscalationScreen: React.FC = () => {
  const { escalationState, currentSession } = useChatStore();
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number>(0);

  useEffect(() => {
    // 待ち時間のカウントダウン
    if (escalationState.estimatedWaitTime && escalationState.status === 'pending') {
      const interval = setInterval(() => {
        setEstimatedWaitTime(prev => Math.max(0, prev - 1));
      }, 60000); // 1分ごとに更新

      setEstimatedWaitTime(escalationState.estimatedWaitTime);
      return () => clearInterval(interval);
    }
  }, [escalationState.estimatedWaitTime, escalationState.status]);

  const getStatusInfo = () => {
    switch (escalationState.status) {
      case 'pending':
        return {
          icon: ClockIcon,
          title: 'オペレーター接続待ち',
          description: 'しばらくお待ちください',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50'
        };
      case 'connected':
        return {
          icon: ChatBubbleLeftRightIcon,
          title: 'オペレーターに接続中',
          description: 'オペレーターとお話しいただけます',
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        };
      case 'resolved':
        return {
          icon: CheckCircleIcon,
          title: '対応完了',
          description: 'お問い合わせありがとうございました',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        };
      default:
        return {
          icon: PhoneIcon,
          title: 'サポート待機中',
          description: 'サポートをお待ちしています',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold text-center text-gray-900">
            オペレーターサポート
          </h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${statusInfo.bgColor} rounded-2xl p-8 text-center`}
          >
            {/* ステータスアイコン */}
            <motion.div
              animate={{
                scale: escalationState.status === 'pending' ? [1, 1.1, 1] : 1,
              }}
              transition={{
                duration: 2,
                repeat: escalationState.status === 'pending' ? Infinity : 0,
              }}
              className="flex justify-center mb-6"
            >
              <StatusIcon className={`h-16 w-16 ${statusInfo.color}`} />
            </motion.div>

            {/* ステータステキスト */}
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {statusInfo.title}
            </h2>
            <p className="text-gray-600 mb-6">
              {statusInfo.description}
            </p>

            {/* 詳細情報 */}
            <div className="space-y-4">
              {escalationState.ticketId && (
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-500">チケット番号</p>
                  <p className="font-mono text-lg">{escalationState.ticketId}</p>
                </div>
              )}

              {escalationState.reason && (
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-500">お問い合わせ内容</p>
                  <p className="text-gray-900">{escalationState.reason}</p>
                </div>
              )}

              {estimatedWaitTime > 0 && escalationState.status === 'pending' && (
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-500">予想待ち時間</p>
                  <p className="text-xl font-semibold text-gray-900">
                    約 {estimatedWaitTime} 分
                  </p>
                </div>
              )}
            </div>

            {/* アクションボタン */}
            <div className="mt-8 space-y-3">
              {escalationState.status === 'pending' && (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      // LINE URLへのリダイレクト（実装が必要）
                      if (escalationState.status === 'pending') {
                        window.open('https://line.me/ti/p/@mnp-support', '_blank');
                      }
                    }}
                  >
                    <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                    LINEで今すぐ相談
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={() => window.history.back()}
                  >
                    チャットに戻る
                  </Button>
                </>
              )}

              {escalationState.status === 'connected' && (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    // オペレーターチャット画面への切り替え
                    window.open('https://line.me/ti/p/@mnp-support', '_blank');
                  }}
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                  オペレーターと話す
                </Button>
              )}

              {escalationState.status === 'resolved' && (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => window.history.back()}
                >
                  チャットに戻る
                </Button>
              )}
            </div>
          </motion.div>

          {/* 補足情報 */}
          {escalationState.status === 'pending' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 text-center"
            >
              <p className="text-sm text-gray-500">
                混雑状況により、お待ちいただく場合があります。
                <br />
                緊急でない場合は、チャットでのサポートもご利用いただけます。
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EscalationScreen;