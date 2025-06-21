import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { chatApi } from '../services/chatApi';
import { logger } from '../utils/logger';

interface EscalationStats {
  totalEscalations: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  averageWaitTime: number;
  averageResolutionTime: number;
  satisfactionRating: number;
  activeAgents: number;
  queueLength: number;
}

interface EscalationItem {
  id: string;
  ticketId: string;
  sessionToken: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved' | 'cancelled';
  assignedAgent?: string;
  estimatedWaitTime: number;
  createdAt: string;
  updatedAt: string;
}

interface FAQStats {
  totalFAQs: number;
  categoryStats: Array<{ category: string; count: number }>;
  carrierStats: Array<{ carrier: string; count: number }>;
  popularFAQs: Array<{ id: string; question: string; views: number }>;
}

export const AdminDashboard: React.FC = () => {
  const [escalationStats, setEscalationStats] = useState<EscalationStats | null>(null);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [faqStats, setFaqStats] = useState<FAQStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'escalations' | 'faqs'>('overview');

  useEffect(() => {
    fetchDashboardData();
    
    // 30秒間隔で自動更新
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [escalationStatsRes, escalationsRes, faqStatsRes] = await Promise.all([
        chatApi.getEscalationStats(selectedPeriod),
        chatApi.getEscalations({ limit: 20, orderBy: 'created_at DESC' }),
        chatApi.getFAQStats()
      ]);

      if (escalationStatsRes.success) {
        setEscalationStats(escalationStatsRes.data);
      }

      if (escalationsRes.success) {
        setEscalations(escalationsRes.data.escalations || []);
      }

      if (faqStatsRes.success) {
        setFaqStats(faqStatsRes.data);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(errorMessage);
      logger.error('管理画面データ取得エラー', { error: err });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (ticketId: string, newStatus: string) => {
    try {
      const response = await chatApi.updateEscalation(ticketId, { status: newStatus });
      
      if (response.success) {
        // ローカル状態を更新
        setEscalations(prev => 
          prev.map(item => 
            item.ticketId === ticketId 
              ? { ...item, status: newStatus as any, updatedAt: new Date().toISOString() }
              : item
          )
        );
        
        // 統計情報を再取得
        fetchDashboardData();
      }
    } catch (err) {
      logger.error('エスカレーション更新エラー', { error: err, ticketId });
    }
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-indigo-100 text-indigo-800',
      waiting_customer: 'bg-purple-100 text-purple-800',
      resolved: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                MNPサポート管理画面
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="rounded-lg border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="1d">過去24時間</option>
                <option value="7d">過去7日間</option>
                <option value="30d">過去30日間</option>
                <option value="90d">過去90日間</option>
              </select>
              
              <button
                onClick={fetchDashboardData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                更新
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* タブナビゲーション */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: '概要' },
              { id: 'escalations', label: 'エスカレーション管理' },
              { id: 'faqs', label: 'FAQ管理' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
          </motion.div>
        )}

        {/* 概要タブ */}
        {selectedTab === 'overview' && escalationStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* 統計カード */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">総エスカレーション数</p>
                    <p className="text-2xl font-bold text-gray-900">{escalationStats.totalEscalations}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">待機中</p>
                    <p className="text-2xl font-bold text-gray-900">{escalationStats.queueLength}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">平均解決時間</p>
                    <p className="text-2xl font-bold text-gray-900">{escalationStats.averageResolutionTime}分</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">満足度</p>
                    <p className="text-2xl font-bold text-gray-900">{escalationStats.satisfactionRating.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ステータス別グラフ */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">ステータス別分布</h3>
              <div className="space-y-3">
                {Object.entries(escalationStats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center">
                    <div className="w-24 text-sm text-gray-600 capitalize">{status}</div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${escalationStats.totalEscalations > 0 ? (count / escalationStats.totalEscalations) * 100 : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-12 text-sm text-gray-900 text-right">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* エスカレーション管理タブ */}
        {selectedTab === 'escalations' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow"
          >
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">エスカレーション一覧</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      チケットID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      優先度
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      担当者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      作成日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {escalations.map((escalation) => (
                    <tr key={escalation.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {escalation.ticketId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(escalation.priority)}`}>
                          {escalation.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(escalation.status)}`}>
                          {escalation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {escalation.assignedAgent || '未割当'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(escalation.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <select
                          value={escalation.status}
                          onChange={(e) => handleStatusUpdate(escalation.ticketId, e.target.value)}
                          className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="pending">受付中</option>
                          <option value="assigned">担当者決定</option>
                          <option value="in_progress">対応中</option>
                          <option value="waiting_customer">顧客回答待ち</option>
                          <option value="resolved">解決済み</option>
                          <option value="cancelled">キャンセル</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* FAQ管理タブ */}
        {selectedTab === 'faqs' && faqStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* カテゴリ別統計 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ別FAQ数</h3>
                <div className="space-y-3">
                  {faqStats.categoryStats.map((item) => (
                    <div key={item.category} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{item.category}</span>
                      <span className="text-sm font-medium text-gray-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* キャリア別統計 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">キャリア別FAQ数</h3>
                <div className="space-y-3">
                  {faqStats.carrierStats.map((item) => (
                    <div key={item.carrier} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{item.carrier}</span>
                      <span className="text-sm font-medium text-gray-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 人気FAQ */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">人気FAQ</h3>
              <div className="space-y-3">
                {faqStats.popularFAQs.map((faq, index) => (
                  <div key={faq.id} className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {faq.question}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-sm text-gray-500">{faq.views} views</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;