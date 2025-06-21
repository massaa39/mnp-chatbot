import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BellIcon, 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  MoonIcon, 
  SunIcon,
  GlobeAltIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useChatStore } from '../store/chatStore';
import Button from '../components/common/Button';

/**
 * 設定画面
 * ユーザーの個人設定とアプリの設定を管理
 */
const SettingsScreen: React.FC = () => {
  const { preferences, exportChatHistory, clearMessages } = useChatStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 設定の更新（実装が必要な場合）
  const updatePreference = (key: keyof typeof preferences, value: any) => {
    // 実際の実装では useChatStore に updatePreferences メソッドを追加する必要があります
    console.log(`Setting ${key} to ${value}`);
  };

  const handleExportHistory = () => {
    try {
      const historyData = exportChatHistory();
      const blob = new Blob([historyData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mnp-chat-history-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('履歴エクスポートエラー:', error);
    }
  };

  const handleClearHistory = () => {
    if (showDeleteConfirm) {
      clearMessages();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold text-center text-gray-900">
            設定
          </h1>
        </div>
      </div>

      {/* 設定項目 */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-6">
          
          {/* 通知設定 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-4 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">通知設定</h2>
            
            <div className="space-y-4">
              {/* プッシュ通知 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <BellIcon className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">プッシュ通知</p>
                    <p className="text-sm text-gray-500">新しいメッセージの通知</p>
                  </div>
                </div>
                <button
                  onClick={() => updatePreference('notifications', !preferences.notifications)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.notifications ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* サウンド */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {preferences.sound ? (
                    <SpeakerWaveIcon className="h-5 w-5 text-gray-600" />
                  ) : (
                    <SpeakerXMarkIcon className="h-5 w-5 text-gray-600" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">サウンド</p>
                    <p className="text-sm text-gray-500">通知音とタイピング音</p>
                  </div>
                </div>
                <button
                  onClick={() => updatePreference('sound', !preferences.sound)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.sound ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.sound ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </motion.div>

          {/* 表示設定 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-4 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">表示設定</h2>
            
            <div className="space-y-4">
              {/* テーマ */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {preferences.theme === 'dark' ? (
                    <MoonIcon className="h-5 w-5 text-gray-600" />
                  ) : (
                    <SunIcon className="h-5 w-5 text-gray-600" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">テーマ</p>
                    <p className="text-sm text-gray-500">
                      {preferences.theme === 'dark' ? 'ダークモード' : 'ライトモード'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updatePreference('theme', preferences.theme === 'light' ? 'dark' : 'light')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 言語 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <GlobeAltIcon className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">言語</p>
                    <p className="text-sm text-gray-500">
                      {preferences.language === 'ja' ? '日本語' : 'English'}
                    </p>
                  </div>
                </div>
                <select
                  value={preferences.language}
                  onChange={(e) => updatePreference('language', e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* データ管理 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-4 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">データ管理</h2>
            
            <div className="space-y-3">
              {/* 履歴エクスポート */}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleExportHistory}
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                チャット履歴をエクスポート
              </Button>

              {/* 履歴削除 */}
              <Button
                variant={showDeleteConfirm ? "danger" : "outline"}
                size="sm"
                className="w-full justify-start"
                onClick={handleClearHistory}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                {showDeleteConfirm ? '本当に削除しますか？' : 'チャット履歴を削除'}
              </Button>

              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex space-x-2"
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    onClick={handleClearHistory}
                  >
                    削除する
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* アプリ情報 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl p-4 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">アプリ情報</h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">バージョン</span>
                <span className="font-medium text-gray-900">1.0.0</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">最終更新</span>
                <span className="font-medium text-gray-900">2024-01-15</span>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/privacy', '_blank')}
                >
                  <InformationCircleIcon className="h-4 w-4 mr-2" />
                  プライバシーポリシー
                </Button>
              </div>
            </div>
          </motion.div>

          {/* フッター */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center pt-4"
          >
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => window.history.back()}
            >
              チャットに戻る
            </Button>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
