import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/global.css';

// React Query設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5分
      cacheTime: 10 * 60 * 1000, // 10分
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// 開発環境でのReact Query Devtools（本番ビルドでは除外）

// エラーハンドリングを追加
function initializeApp() {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    // ローディング画面を即座に非表示にする
    const loadingElement = document.getElementById('initial-loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    const root = ReactDOM.createRoot(rootElement);

    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </React.StrictMode>
    );

    console.log('✅ React アプリケーション初期化完了');
  } catch (error) {
    console.error('❌ React アプリケーション初期化失敗:', error);
    
    // フォールバック表示
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="
          padding: 40px 20px;
          text-align: center;
          font-family: 'M PLUS 1', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        ">
          <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
            <h1 style="margin-bottom: 20px; font-size: 24px; font-weight: 600;">🚀 MNP チャットサポート</h1>
            <div style="margin-bottom: 20px;">
              <div style="width: 60px; height: 60px; margin: 0 auto 20px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <p style="font-size: 16px; margin-bottom: 10px;">アプリケーションを初期化中...</p>
              <p style="font-size: 14px; opacity: 0.8;">しばらくお待ちください</p>
            </div>
            <button onclick="location.reload()" style="
              margin-top: 15px;
              padding: 12px 24px;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
            ">
              🔄 再読み込み
            </button>
          </div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }
  }
}

// DOM読み込み完了後に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}