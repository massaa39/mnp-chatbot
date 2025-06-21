import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // エラー報告のコールバック
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 本番環境でのエラーログ送信
    if (process.env.NODE_ENV === 'production') {
      this.reportError(error, errorInfo);
    }
  }

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // エラー報告APIにデータを送信
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // 実際のエラー報告サービスに送信
      // await fetch('/api/v1/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport),
      // });

      console.log('Error report prepared:', errorReport);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // カスタムフォールバックが提供されている場合
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // デフォルトのエラーUI
      return (
        <motion.div
          className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <motion.div
              className="text-center"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              {/* エラーアイコン */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              {/* エラーメッセージ */}
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                エラーが発生しました
              </h2>
              <p className="text-gray-600 mb-6">
                申し訳ございませんが、予期しないエラーが発生しました。
                しばらく経ってから再度お試しください。
              </p>

              {/* 開発環境でのエラー詳細 */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <motion.details
                  className="text-left mb-6 bg-gray-100 rounded p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                    エラー詳細（開発モード）
                  </summary>
                  <div className="text-xs text-gray-600 space-y-2">
                    <div>
                      <strong>エラーメッセージ:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{this.state.error.message}</pre>
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>スタックトレース:</strong>
                        <pre className="mt-1 whitespace-pre-wrap text-xs overflow-x-auto">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <strong>コンポーネントスタック:</strong>
                        <pre className="mt-1 whitespace-pre-wrap text-xs overflow-x-auto">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </motion.details>
              )}

              {/* アクションボタン */}
              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  onClick={this.handleRetry}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  再試行
                </motion.button>
                <motion.button
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-200 transition-colors"
                  onClick={this.handleReload}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  ページを再読み込み
                </motion.button>
              </div>

              {/* サポート情報 */}
              <p className="text-xs text-gray-500 mt-4">
                問題が続く場合は、サポートまでご連絡ください。
              </p>
            </motion.div>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// チャット専用のエラーバウンダリー
export const ChatErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-32 text-center">
          <div className="space-y-2">
            <div className="text-red-600 text-sm font-medium">チャットでエラーが発生しました</div>
            <button
              className="text-blue-600 text-sm underline"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

// API呼び出し用のエラーバウンダリー
export const ApiErrorBoundary: React.FC<{ 
  children: ReactNode;
  onRetry?: () => void;
}> = ({ children, onRetry }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                通信エラーが発生しました
              </h3>
              <div className="mt-2">
                {onRetry && (
                  <button
                    className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                    onClick={onRetry}
                  >
                    再試行
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};