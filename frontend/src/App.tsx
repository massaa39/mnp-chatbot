import React, { Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loading from './components/common/Loading';
import ChatScreen from './screens/ChatScreen';
import EscalationScreen from './screens/EscalationScreen';
import RoadmapScreen from './screens/RoadmapScreen';
import SettingsScreen from './screens/SettingsScreen';
import AdminDashboard from './pages/AdminDashboard';
import TabBar from './components/navigation/TabBar';
import { useAuthStore } from './store/authStore';
import { chatApi } from './services/chatApi';

// ページ遷移アニメーション
const pageVariants = {
  initial: {
    opacity: 0,
    x: -20,
  },
  in: {
    opacity: 1,
    x: 0,
  },
  out: {
    opacity: 0,
    x: 20,
  },
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3,
};

function App() {
  const { sessionToken, isAuthenticated, isLoading, createSession } = useAuthStore();
  const [appInitialized, setAppInitialized] = useState(true); // 初期状態をtrueに変更
  const [initError, setInitError] = useState<string | null>(null);

  // アプリケーション初期化
  useEffect(() => {
    // Reactアプリが読み込まれたことをマーク
    document.body.classList.add('app-loaded');
    console.log('✅ App component mounted');
    
    const initializeApp = async () => {
      try {
        console.log('アプリケーション初期化開始');
        setInitError(null);
        
        // バックグラウンドでセッション処理（UI表示は妨げない）
        if (!sessionToken) {
          console.log('ゲストセッション作成');
          try {
            await createSession({
              mode: 'step_by_step',
              preferences: {
                language: 'ja',
                deviceType: 'mobile',
                isGuest: true
              }
            });
          } catch (error) {
            console.warn('セッション作成失敗、デモモードで継続:', error);
          }
        }
        
        console.log('アプリケーション初期化完了');
      } catch (error) {
        console.error('初期化エラー:', error);
        setInitError(error instanceof Error ? error.message : '初期化に失敗しました');
      }
    };

    // バックグラウンドで初期化（UI表示をブロックしない）
    initializeApp();
    
  }, [sessionToken, createSession]);

  return (
    <div className="app min-h-screen bg-gray-50 flex flex-col">
      <ErrorBoundary>
        <main className="flex-1 overflow-hidden pb-16">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route
                path="/"
                element={
                  <motion.div
                    initial="initial"
                    animate="in"
                    exit="out"
                    variants={pageVariants}
                    transition={pageTransition}
                    className="h-full"
                  >
                    <ChatScreen />
                  </motion.div>
                }
              />
              <Route
                path="/escalation"
                element={
                  <motion.div
                    initial="initial"
                    animate="in"
                    exit="out"
                    variants={pageVariants}
                    transition={pageTransition}
                    className="h-full"
                  >
                    <EscalationScreen />
                  </motion.div>
                }
              />
              <Route
                path="/roadmap"
                element={
                  <motion.div
                    initial="initial"
                    animate="in"
                    exit="out"
                    variants={pageVariants}
                    transition={pageTransition}
                    className="h-full"
                  >
                    <RoadmapScreen />
                  </motion.div>
                }
              />
              <Route
                path="/settings"
                element={
                  <motion.div
                    initial="initial"
                    animate="in"
                    exit="out"
                    variants={pageVariants}
                    transition={pageTransition}
                    className="h-full"
                  >
                    <SettingsScreen />
                  </motion.div>
                }
              />
              <Route
                path="/admin"
                element={
                  <motion.div
                    initial="initial"
                    animate="in"
                    exit="out"
                    variants={pageVariants}
                    transition={pageTransition}
                    className="h-full"
                  >
                    <AdminDashboard />
                  </motion.div>
                }
              />
              {/* デフォルトルート */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        {/* モバイル向けタブバー */}
        <TabBar />

        {/* PWA用メタ情報 */}
        <div
          id="pwa-meta"
          data-theme="light"
          data-user-authenticated={isAuthenticated}
          data-session-token={sessionToken ? 'present' : 'none'}
        />
      </ErrorBoundary>
    </div>
  );
}

export default App;