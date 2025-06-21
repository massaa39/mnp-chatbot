import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon, ClockIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import { useChatStore } from '../store/chatStore';
import Button from '../components/common/Button';

/**
 * ロードマップ画面
 * MNP手続きの全体的な流れを表示
 */
const RoadmapScreen: React.FC = () => {
  const { currentSession, mode, switchMode } = useChatStore();

  // MNPロードマップのステップ定義
  const roadmapSteps = [
    {
      id: 'preparation',
      title: '事前準備',
      description: '必要書類とMNP予約番号の準備',
      details: ['本人確認書類の準備', 'MNP予約番号の取得', '支払い方法の確認'],
      estimatedTime: '30分',
      status: 'completed' as const
    },
    {
      id: 'application',
      title: '申込み手続き',
      description: '新しいキャリアへの申込み',
      details: ['オンラインまたは店舗で申込み', 'プラン・オプションの選択', 'SIMタイプの選択'],
      estimatedTime: '15分',
      status: 'in_progress' as const
    },
    {
      id: 'sim_setup',
      title: 'SIM設定',
      description: 'SIMカードの設定と開通',
      details: ['SIMカードの挿入', '開通手続き', 'APN設定'],
      estimatedTime: '30分',
      status: 'pending' as const
    },
    {
      id: 'verification',
      title: '動作確認',
      description: '通話・データ通信の確認',
      details: ['音声通話テスト', 'インターネット接続確認', 'メール設定'],
      estimatedTime: '15分',
      status: 'pending' as const
    },
    {
      id: 'completion',
      title: '完了',
      description: 'MNP手続き完了',
      details: ['前キャリアの自動解約', '初期設定の完了', 'サービス開始'],
      estimatedTime: '-',
      status: 'pending' as const
    }
  ];

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircleIcon;
      case 'in_progress':
        return PlayCircleIcon;
      default:
        return ClockIcon;
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'in_progress':
        return 'text-blue-600';
      default:
        return 'text-gray-400';
    }
  };

  const getStepBg = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'in_progress':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const currentStepIndex = roadmapSteps.findIndex(step => step.status === 'in_progress');
  const completedSteps = roadmapSteps.filter(step => step.status === 'completed').length;
  const progressPercentage = (completedSteps / roadmapSteps.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold text-center text-gray-900">
            MNP手続きロードマップ
          </h1>
          
          {/* プログレスバー */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>進捗状況</span>
              <span>{completedSteps}/{roadmapSteps.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className="bg-blue-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ロードマップステップ */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-4">
          {roadmapSteps.map((step, index) => {
            const StepIcon = getStepIcon(step.status);
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`border-2 rounded-xl p-4 ${getStepBg(step.status)}`}
              >
                <div className="flex items-start space-x-3">
                  {/* ステップアイコン */}
                  <div className="flex-shrink-0">
                    <StepIcon className={`h-6 w-6 ${getStepColor(step.status)}`} />
                  </div>

                  {/* ステップ内容 */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{step.title}</h3>
                      {step.estimatedTime !== '-' && (
                        <span className="text-xs bg-white px-2 py-1 rounded-full text-gray-600">
                          約{step.estimatedTime}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{step.description}</p>
                    
                    {/* 詳細リスト */}
                    <ul className="space-y-1">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-center text-xs text-gray-500">
                          <div className="w-1 h-1 bg-gray-400 rounded-full mr-2" />
                          {detail}
                        </li>
                      ))}
                    </ul>

                    {/* 現在のステップの場合、アクションボタンを表示 */}
                    {step.status === 'in_progress' && (
                      <div className="mt-4">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            if (mode !== 'step_by_step') {
                              switchMode('step_by_step');
                            }
                            // チャット画面に戻る
                            window.history.back();
                          }}
                        >
                          ステップガイドで進める
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* フッターアクション */}
        <div className="mt-8 space-y-3">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => {
              if (mode !== 'step_by_step') {
                switchMode('step_by_step');
              }
              window.history.back();
            }}
          >
            ステップバイステップで進める
          </Button>
          
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => window.history.back()}
          >
            チャットに戻る
          </Button>
        </div>

        {/* 補足情報 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 p-4 bg-blue-50 rounded-lg"
        >
          <h4 className="font-semibold text-blue-900 mb-2">📱 MNPとは？</h4>
          <p className="text-sm text-blue-700">
            携帯電話番号ポータビリティ（MNP）は、現在お使いの電話番号を変更することなく、
            他の携帯電話会社のサービスをご利用いただけるサービスです。
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RoadmapScreen;
