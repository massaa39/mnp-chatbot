import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatApi } from '../../services/chatApi';
import { logger } from '../../utils/logger';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'mnp_basic' | 'carrier_specific' | 'troubleshooting' | 'technical';
  carrier?: 'docomo' | 'au' | 'softbank' | 'rakuten';
  tags: string[];
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FAQFormData {
  question: string;
  answer: string;
  category: FAQ['category'];
  carrier?: FAQ['carrier'];
  tags: string[];
  priority: number;
  isActive: boolean;
}

export const FAQManager: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('all');

  const [formData, setFormData] = useState<FAQFormData>({
    question: '',
    answer: '',
    category: 'mnp_basic',
    carrier: undefined,
    tags: [],
    priority: 5,
    isActive: true
  });

  const categories = [
    { value: 'mnp_basic', label: 'MNP基本情報' },
    { value: 'carrier_specific', label: 'キャリア固有情報' },
    { value: 'troubleshooting', label: 'トラブルシューティング' },
    { value: 'technical', label: '技術的な情報' }
  ];

  const carriers = [
    { value: 'docomo', label: 'NTTドコモ' },
    { value: 'au', label: 'au' },
    { value: 'softbank', label: 'ソフトバンク' },
    { value: 'rakuten', label: '楽天モバイル' }
  ];

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.getFAQStats();
      
      // Mock data for development
      setFaqs([
        {
          id: '1',
          question: 'MNPとは何ですか？',
          answer: 'MNP（携帯番号ポータビリティ）とは、携帯電話番号をそのまま他のキャリアで使用できるサービスです。',
          category: 'mnp_basic',
          tags: ['MNP', '基本'],
          priority: 10,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMessage);
      logger.error('FAQ取得エラー', { error: err });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.question.trim() || !formData.answer.trim()) {
      setError('質問と回答は必須です');
      return;
    }

    try {
      const response = editingFAQ
        ? await chatApi.updateFAQ(editingFAQ.id, formData)
        : await chatApi.createFAQ(formData);

      // Simulate success for development
      await fetchFAQs();
      handleCloseForm();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMessage);
      logger.error('FAQ保存エラー', { error: err });
    }
  };

  const handleDelete = async (faqId: string) => {
    if (!confirm('このFAQを削除しますか？')) {
      return;
    }

    try {
      await chatApi.deleteFAQ(faqId);
      // Simulate success for development
      await fetchFAQs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMessage);
      logger.error('FAQ削除エラー', { error: err });
    }
  };

  const handleEdit = (faq: FAQ) => {
    setEditingFAQ(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      carrier: faq.carrier,
      tags: faq.tags,
      priority: faq.priority,
      isActive: faq.isActive
    });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingFAQ(null);
    setFormData({
      question: '',
      answer: '',
      category: 'mnp_basic',
      carrier: undefined,
      tags: [],
      priority: 5,
      isActive: true
    });
    setError(null);
  };

  const handleAddTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tag.trim()] });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesCarrier = selectedCarrier === 'all' || faq.carrier === selectedCarrier;

    return matchesSearch && matchesCategory && matchesCarrier;
  });

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">FAQ管理</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          新しいFAQを追加
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              検索
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="質問、回答、タグで検索..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              カテゴリ
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">すべて</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              キャリア
            </label>
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">すべて</option>
              {carriers.map(carrier => (
                <option key={carrier.value} value={carrier.value}>{carrier.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchFAQs}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              更新
            </button>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </motion.div>
      )}

      {/* FAQ一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            FAQ一覧 ({filteredFAQs.length}件)
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredFAQs.map((faq) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-lg font-medium text-gray-900 truncate">
                        {faq.question}
                      </h4>
                      {!faq.isActive && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          非アクティブ
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 mb-3 line-clamp-2">
                      {faq.answer}
                    </p>

                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {categories.find(c => c.value === faq.category)?.label}
                      </span>
                      
                      {faq.carrier && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                          {carriers.find(c => c.value === faq.carrier)?.label}
                        </span>
                      )}

                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        優先度: {faq.priority}
                      </span>
                    </div>

                    {faq.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {faq.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="ml-4 flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(faq)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleDelete(faq.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {filteredFAQs.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500">
                FAQが見つかりませんでした
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAQフォーム */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <form onSubmit={handleSubmit} className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingFAQ ? 'FAQ編集' : '新しいFAQ作成'}
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 質問 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      質問 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="よくある質問を入力してください"
                    />
                  </div>

                  {/* 回答 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      回答 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.answer}
                      onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                      required
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="詳しい回答を入力してください"
                    />
                  </div>

                  {/* カテゴリとキャリア */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        カテゴリ <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as FAQ['category'] })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        キャリア（任意）
                      </label>
                      <select
                        value={formData.carrier || ''}
                        onChange={(e) => setFormData({ ...formData, carrier: e.target.value as FAQ['carrier'] || undefined })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">すべて</option>
                        {carriers.map(carrier => (
                          <option key={carrier.value} value={carrier.value}>{carrier.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 優先度とアクティブ */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        優先度
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="mr-2 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">アクティブ</span>
                      </label>
                    </div>
                  </div>

                  {/* タグ */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      タグ
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="タグを入力してEnterで追加"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-8">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingFAQ ? '更新' : '作成'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FAQManager;