import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../common/Button';
import { useChatStore } from '../../store/chatStore';
import { QuickReplyOption } from '../../types/chat';

interface QuickReplyProps {
  options: QuickReplyOption[];
  onSelect: (option: QuickReplyOption) => void;
  className?: string;
}

export const QuickReply: React.FC<QuickReplyProps> = ({
  options,
  onSelect,
  className = ''
}) => {
  const uiState = useChatStore(state => state.uiState);
  const isTyping = uiState?.isTyping || false;

  if (!options.length || isTyping) {
    return null;
  }

  const handleSelect = (option: QuickReplyOption) => {
    onSelect(option);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`quick-reply-container ${className}`}
      >
        <div className="quick-reply-label">
          <span>よく使われる質問:</span>
        </div>
        
        <div className="quick-reply-options">
          {options.map((option, index) => (
            <motion.div
              key={option.id || index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 0.2, 
                delay: index * 0.1,
                ease: 'easeOut'
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelect(option)}
                className="quick-reply-button"
                disabled={option.disabled}
              >
                <span className="quick-reply-text">
                  {option.title}
                </span>
                {option.description && (
                  <span className="quick-reply-description">
                    {option.description}
                  </span>
                )}
              </Button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// カテゴリ別QuickReplyコンポーネント
interface CategoryQuickReplyProps {
  category: 'mnp_basic' | 'carrier_specific' | 'troubleshooting' | 'technical';
  onSelect: (option: QuickReplyOption) => void;
  className?: string;
}

export const CategoryQuickReply: React.FC<CategoryQuickReplyProps> = ({
  category,
  onSelect,
  className = ''
}) => {
  // カテゴリ別のクイックリプライオプション
  const quickReplyOptions: Record<string, QuickReplyOption[]> = {
    mnp_basic: [
      {
        id: 'mnp-what-is',
        title: 'MNPとは？',
        description: 'MNPの基本的な説明',
        payload: { type: 'faq_search', query: 'MNPとは 基本説明', category: 'mnp_basic' }
      },
      {
        id: 'mnp-procedure',
        title: '手続きの流れ',
        description: 'MNP手続きの基本的な流れ',
        payload: { type: 'faq_search', query: 'MNP手続き 流れ', category: 'mnp_basic' }
      },
      {
        id: 'mnp-fee',
        title: '手数料について',
        description: 'MNPに関わる費用',
        payload: { type: 'faq_search', query: 'MNP手数料 費用', category: 'mnp_basic' }
      },
      {
        id: 'mnp-time',
        title: '所要時間',
        description: 'MNP完了までの時間',
        payload: { type: 'faq_search', query: 'MNP 所要時間 期間', category: 'mnp_basic' }
      }
    ],
    carrier_specific: [
      {
        id: 'docomo-mnp',
        title: 'ドコモから転出',
        description: 'ドコモからのMNP手続き',
        payload: { type: 'faq_search', query: 'ドコモ MNP転出', carrier: 'docomo' }
      },
      {
        id: 'au-mnp',
        title: 'auから転出',
        description: 'auからのMNP手続き',
        payload: { type: 'faq_search', query: 'au MNP転出', carrier: 'au' }
      },
      {
        id: 'softbank-mnp',
        title: 'ソフトバンクから転出',
        description: 'ソフトバンクからのMNP手続き',
        payload: { type: 'faq_search', query: 'ソフトバンク MNP転出', carrier: 'softbank' }
      },
      {
        id: 'rakuten-mnp',
        title: '楽天モバイルから転出',
        description: '楽天モバイルからのMNP手続き',
        payload: { type: 'faq_search', query: '楽天モバイル MNP転出', carrier: 'rakuten' }
      }
    ],
    troubleshooting: [
      {
        id: 'mnp-not-working',
        title: 'MNPできない',
        description: 'MNP手続きができない場合',
        payload: { type: 'faq_search', query: 'MNP できない 失敗', category: 'troubleshooting' }
      },
      {
        id: 'mnp-delayed',
        title: '手続きが遅れている',
        description: 'MNP完了が遅れている場合',
        payload: { type: 'faq_search', query: 'MNP 遅れ 完了しない', category: 'troubleshooting' }
      },
      {
        id: 'mnp-error',
        title: 'エラーが発生',
        description: 'MNP手続き中のエラー',
        payload: { type: 'faq_search', query: 'MNP エラー 問題', category: 'troubleshooting' }
      },
      {
        id: 'mnp-cancel',
        title: 'MNPをキャンセル',
        description: 'MNP手続きのキャンセル方法',
        payload: { type: 'faq_search', query: 'MNP キャンセル 取り消し', category: 'troubleshooting' }
      }
    ],
    technical: [
      {
        id: 'mnp-system',
        title: 'MNPシステム',
        description: 'MNPの仕組みについて',
        payload: { type: 'faq_search', query: 'MNP システム 仕組み', category: 'technical' }
      },
      {
        id: 'mnp-network',
        title: 'ネットワーク設定',
        description: 'MNP後のネットワーク設定',
        payload: { type: 'faq_search', query: 'MNP ネットワーク設定 APN', category: 'technical' }
      },
      {
        id: 'mnp-sim-card',
        title: 'SIMカード',
        description: 'MNPとSIMカードについて',
        payload: { type: 'faq_search', query: 'MNP SIMカード 交換', category: 'technical' }
      },
      {
        id: 'mnp-esim',
        title: 'eSIM',
        description: 'eSIMでのMNP手続き',
        payload: { type: 'faq_search', query: 'MNP eSIM 電子SIM', category: 'technical' }
      }
    ]
  };

  const options = quickReplyOptions[category] || [];

  return <QuickReply options={options} onSelect={onSelect} className={className} />;
};

// 状況別QuickReplyコンポーネント
interface SituationQuickReplyProps {
  situation: 'initial' | 'in_progress' | 'help_needed' | 'escalation';
  onSelect: (option: QuickReplyOption) => void;
  className?: string;
}

export const SituationQuickReply: React.FC<SituationQuickReplyProps> = ({
  situation,
  onSelect,
  className = ''
}) => {
  const situationOptions: Record<string, QuickReplyOption[]> = {
    initial: [
      {
        id: 'start-mnp',
        title: 'MNPを始めたい',
        description: 'MNP手続きを開始',
        payload: { type: 'start_mnp_flow' }
      },
      {
        id: 'mnp-info',
        title: 'MNPについて知りたい',
        description: 'MNPの基本情報',
        payload: { type: 'show_mnp_info' }
      },
      {
        id: 'carrier-info',
        title: '各キャリアの情報',
        description: 'キャリア別の手続き',
        payload: { type: 'show_carrier_info' }
      },
      {
        id: 'help',
        title: 'サポートが必要',
        description: '担当者につなぐ',
        payload: { type: 'request_help' }
      }
    ],
    in_progress: [
      {
        id: 'check-status',
        title: '進捗を確認',
        description: 'MNP手続きの進捗確認',
        payload: { type: 'check_mnp_status' }
      },
      {
        id: 'next-step',
        title: '次のステップ',
        description: '次に何をすれば良いか',
        payload: { type: 'show_next_step' }
      },
      {
        id: 'problem',
        title: '問題が発生',
        description: 'トラブルシューティング',
        payload: { type: 'troubleshoot' }
      },
      {
        id: 'need-help',
        title: 'ヘルプが必要',
        description: '担当者に相談',
        payload: { type: 'escalate' }
      }
    ],
    help_needed: [
      {
        id: 'faq-search',
        title: 'FAQを検索',
        description: 'よくある質問から探す',
        payload: { type: 'search_faq' }
      },
      {
        id: 'step-guide',
        title: 'ステップガイド',
        description: '段階的な手順を見る',
        payload: { type: 'show_step_guide' }
      },
      {
        id: 'contact-agent',
        title: '担当者に連絡',
        description: '人間のサポートを受ける',
        payload: { type: 'escalate_to_human' }
      },
      {
        id: 'callback',
        title: 'コールバック依頼',
        description: '電話での対応を依頼',
        payload: { type: 'request_callback' }
      }
    ],
    escalation: [
      {
        id: 'urgent',
        title: '緊急',
        description: '緊急度：高',
        payload: { type: 'escalate', priority: 'urgent' }
      },
      {
        id: 'high',
        title: '高',
        description: '緊急度：高',
        payload: { type: 'escalate', priority: 'high' }
      },
      {
        id: 'medium',
        title: '中',
        description: '緊急度：中',
        payload: { type: 'escalate', priority: 'medium' }
      },
      {
        id: 'low',
        title: '低',
        description: '緊急度：低',
        payload: { type: 'escalate', priority: 'low' }
      }
    ]
  };

  const options = situationOptions[situation] || [];

  return <QuickReply options={options} onSelect={onSelect} className={className} />;
};

export default QuickReply;
