/**
 * シナリオサービス
 * Purpose: MNPワークフロー管理とシナリオ処理
 */

import { logger } from '../utils/logger';
import { Message } from '../types/api';
import { DatabaseConnection } from '../types/database';

export interface ScenarioStep {
  id: string;
  name: string;
  description: string;
  type: 'info' | 'question' | 'action' | 'validation' | 'completion';
  content: string;
  options?: ScenarioOption[];
  validation?: ValidationRule[];
  nextStep?: string;
  conditions?: ScenarioCondition[];
  carrierSpecific?: string[];
  estimatedTime?: number;
  resources?: Resource[];
}

export interface ScenarioOption {
  id: string;
  label: string;
  value: string;
  nextStep?: string;
  requiresValidation?: boolean;
  metadata?: Record<string, any>;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'pattern' | 'custom';
  pattern?: string;
  message: string;
  customValidator?: string;
}

export interface ScenarioCondition {
  field: string;
  operator: 'equals' | 'contains' | 'not_equals' | 'greater_than' | 'less_than';
  value: any;
  action: 'skip' | 'branch' | 'require';
  target?: string;
}

export interface Resource {
  type: 'url' | 'phone' | 'document' | 'form';
  title: string;
  url?: string;
  phone?: string;
  description?: string;
}

export interface ScenarioProgress {
  sessionToken: string;
  currentStep: string;
  completedSteps: string[];
  collectedData: Record<string, any>;
  progress: number;
  estimatedCompletion: Date;
  lastUpdated: Date;
}

export interface MNPWorkflow {
  id: string;
  name: string;
  description: string;
  mode: 'roadmap' | 'step_by_step';
  steps: ScenarioStep[];
  metadata: {
    version: string;
    lastUpdated: Date;
    estimatedDuration: number;
  };
}

class ScenarioService {
  private db: DatabaseConnection;
  private workflows: Map<string, MNPWorkflow>;

  constructor(db: DatabaseConnection) {
    this.db = db;
    this.workflows = new Map();
    this.initializeWorkflows();
  }

  /**
   * シナリオ開始
   */
  async startScenario(
    sessionToken: string,
    mode: 'roadmap' | 'step_by_step',
    userPreferences?: Record<string, any>
  ): Promise<{ step: ScenarioStep; progress: ScenarioProgress }> {
    try {
      logger.info('シナリオ開始', { sessionToken, mode });

      const workflow = this.getWorkflow(mode);
      if (!workflow) {
        throw new Error(`ワークフロー '${mode}' が見つかりません`);
      }

      const firstStep = workflow.steps[0];
      const progress: ScenarioProgress = {
        sessionToken,
        currentStep: firstStep.id,
        completedSteps: [],
        collectedData: userPreferences || {},
        progress: 0,
        estimatedCompletion: this.calculateEstimatedCompletion(workflow),
        lastUpdated: new Date()
      };

      // プログレス保存
      await this.saveProgress(progress);

      // セッション更新
      await this.updateSessionScenario(sessionToken, mode, firstStep.id, progress.collectedData);

      return { step: firstStep, progress };
    } catch (error) {
      logger.error('シナリオ開始エラー', { error: error.message, sessionToken, mode });
      throw error;
    }
  }

  /**
   * 次のステップに進む
   */
  async proceedToNextStep(
    sessionToken: string,
    currentStepId: string,
    userInput?: string,
    selectedOption?: string
  ): Promise<{ step: ScenarioStep | null; progress: ScenarioProgress; completed: boolean }> {
    try {
      logger.info('次のステップ処理', { sessionToken, currentStepId, userInput, selectedOption });

      // 現在のプログレス取得
      const progress = await this.getProgress(sessionToken);
      if (!progress) {
        throw new Error('プログレスが見つかりません');
      }

      // 現在のステップ取得
      const currentStep = await this.getStep(progress.currentStep);
      if (!currentStep) {
        throw new Error('現在のステップが見つかりません');
      }

      // 入力検証
      if (currentStep.validation && userInput) {
        const validationResult = await this.validateInput(currentStep.validation, userInput);
        if (!validationResult.isValid) {
          throw new Error(`入力エラー: ${validationResult.errors.join(', ')}`);
        }
      }

      // データ収集
      if (userInput) {
        progress.collectedData[currentStep.id] = userInput;
      }
      if (selectedOption) {
        progress.collectedData[`${currentStep.id}_option`] = selectedOption;
      }

      // 次のステップ決定
      const nextStepId = await this.determineNextStep(currentStep, progress.collectedData, selectedOption);
      
      // 完了チェック
      if (!nextStepId) {
        progress.completedSteps.push(currentStep.id);
        progress.progress = 100;
        progress.lastUpdated = new Date();
        await this.saveProgress(progress);
        await this.markSessionCompleted(sessionToken);
        
        return { step: null, progress, completed: true };
      }

      // 次のステップ準備
      const nextStep = await this.getStep(nextStepId);
      if (!nextStep) {
        throw new Error('次のステップが見つかりません');
      }

      // プログレス更新
      progress.completedSteps.push(currentStep.id);
      progress.currentStep = nextStepId;
      progress.progress = this.calculateProgress(progress);
      progress.lastUpdated = new Date();

      await this.saveProgress(progress);
      await this.updateSessionScenario(sessionToken, undefined, nextStepId, progress.collectedData);

      return { step: nextStep, progress, completed: false };
    } catch (error) {
      logger.error('次のステップ処理エラー', { error: error.message, sessionToken, currentStepId });
      throw error;
    }
  }

  /**
   * 現在のステップ取得
   */
  async getCurrentStep(sessionToken: string): Promise<{ step: ScenarioStep; progress: ScenarioProgress } | null> {
    try {
      const progress = await this.getProgress(sessionToken);
      if (!progress) {
        return null;
      }

      const step = await this.getStep(progress.currentStep);
      if (!step) {
        return null;
      }

      return { step, progress };
    } catch (error) {
      logger.error('現在のステップ取得エラー', { error: error.message, sessionToken });
      return null;
    }
  }

  /**
   * ステップをスキップ
   */
  async skipStep(sessionToken: string, reason?: string): Promise<{ step: ScenarioStep | null; progress: ScenarioProgress }> {
    try {
      logger.info('ステップスキップ', { sessionToken, reason });

      const progress = await this.getProgress(sessionToken);
      if (!progress) {
        throw new Error('プログレスが見つかりません');
      }

      const currentStep = await this.getStep(progress.currentStep);
      if (!currentStep) {
        throw new Error('現在のステップが見つかりません');
      }

      // スキップ情報を記録
      progress.collectedData[`${currentStep.id}_skipped`] = true;
      progress.collectedData[`${currentStep.id}_skip_reason`] = reason || 'ユーザーによるスキップ';

      // 次のステップ決定
      const nextStepId = await this.determineNextStep(currentStep, progress.collectedData);
      
      if (!nextStepId) {
        progress.progress = 100;
        await this.saveProgress(progress);
        return { step: null, progress };
      }

      const nextStep = await this.getStep(nextStepId);
      progress.currentStep = nextStepId;
      progress.progress = this.calculateProgress(progress);
      progress.lastUpdated = new Date();

      await this.saveProgress(progress);

      return { step: nextStep, progress };
    } catch (error) {
      logger.error('ステップスキップエラー', { error: error.message, sessionToken });
      throw error;
    }
  }

  /**
   * シナリオリセット
   */
  async resetScenario(sessionToken: string, mode?: 'roadmap' | 'step_by_step'): Promise<{ step: ScenarioStep; progress: ScenarioProgress }> {
    try {
      logger.info('シナリオリセット', { sessionToken, mode });

      // 現在のモード取得
      const currentProgress = await this.getProgress(sessionToken);
      const workflowMode = mode || (currentProgress ? 'step_by_step' : 'roadmap');

      // 新しいシナリオ開始
      return await this.startScenario(sessionToken, workflowMode);
    } catch (error) {
      logger.error('シナリオリセットエラー', { error: error.message, sessionToken });
      throw error;
    }
  }

  /**
   * 利用可能なワークフロー一覧取得
   */
  getAvailableWorkflows(): { id: string; name: string; description: string; mode: string }[] {
    return Array.from(this.workflows.values()).map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      mode: workflow.mode
    }));
  }

  /**
   * ワークフロー取得
   */
  private getWorkflow(mode: 'roadmap' | 'step_by_step'): MNPWorkflow | null {
    return this.workflows.get(mode) || null;
  }

  /**
   * ステップ取得
   */
  private async getStep(stepId: string): Promise<ScenarioStep | null> {
    for (const workflow of this.workflows.values()) {
      const step = workflow.steps.find(s => s.id === stepId);
      if (step) {
        return step;
      }
    }
    return null;
  }

  /**
   * 次のステップ決定
   */
  private async determineNextStep(
    currentStep: ScenarioStep,
    collectedData: Record<string, any>,
    selectedOption?: string
  ): Promise<string | null> {
    // オプション選択による分岐
    if (selectedOption && currentStep.options) {
      const option = currentStep.options.find(opt => opt.value === selectedOption);
      if (option?.nextStep) {
        return option.nextStep;
      }
    }

    // 条件による分岐
    if (currentStep.conditions) {
      for (const condition of currentStep.conditions) {
        if (this.evaluateCondition(condition, collectedData)) {
          if (condition.action === 'branch' && condition.target) {
            return condition.target;
          }
          if (condition.action === 'skip') {
            continue;
          }
        }
      }
    }

    // デフォルトの次のステップ
    return currentStep.nextStep || null;
  }

  /**
   * 条件評価
   */
  private evaluateCondition(condition: ScenarioCondition, data: Record<string, any>): boolean {
    const fieldValue = data[condition.field];
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      default:
        return false;
    }
  }

  /**
   * 入力検証
   */
  private async validateInput(rules: ValidationRule[], input: string): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const rule of rules) {
      switch (rule.type) {
        case 'required':
          if (!input || input.trim() === '') {
            errors.push(rule.message);
          }
          break;
        case 'pattern':
          if (rule.pattern && !new RegExp(rule.pattern).test(input)) {
            errors.push(rule.message);
          }
          break;
        case 'custom':
          // カスタムバリデーター実装
          break;
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * プログレス保存
   */
  private async saveProgress(progress: ScenarioProgress): Promise<void> {
    const query = `
      INSERT INTO scenario_progress (session_token, current_step, completed_steps, collected_data, progress, estimated_completion, last_updated)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (session_token) 
      DO UPDATE SET 
        current_step = $2,
        completed_steps = $3,
        collected_data = $4,
        progress = $5,
        estimated_completion = $6,
        last_updated = $7
    `;

    await this.db.query(query, [
      progress.sessionToken,
      progress.currentStep,
      JSON.stringify(progress.completedSteps),
      JSON.stringify(progress.collectedData),
      progress.progress,
      progress.estimatedCompletion,
      progress.lastUpdated
    ]);
  }

  /**
   * プログレス取得
   */
  private async getProgress(sessionToken: string): Promise<ScenarioProgress | null> {
    const query = `
      SELECT * FROM scenario_progress WHERE session_token = $1
    `;
    const result = await this.db.query(query, [sessionToken]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      sessionToken: row.session_token,
      currentStep: row.current_step,
      completedSteps: JSON.parse(row.completed_steps || '[]'),
      collectedData: JSON.parse(row.collected_data || '{}'),
      progress: row.progress,
      estimatedCompletion: new Date(row.estimated_completion),
      lastUpdated: new Date(row.last_updated)
    };
  }

  /**
   * セッション更新
   */
  private async updateSessionScenario(
    sessionToken: string,
    mode?: 'roadmap' | 'step_by_step',
    currentStep?: string,
    scenarioData?: Record<string, any>
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (mode) {
      updates.push(`mode = $${paramIndex++}`);
      values.push(mode);
    }
    if (currentStep) {
      updates.push(`current_step = $${paramIndex++}`);
      values.push(currentStep);
    }
    if (scenarioData) {
      updates.push(`scenario_data = $${paramIndex++}`);
      values.push(JSON.stringify(scenarioData));
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(sessionToken);

    const query = `UPDATE chat_sessions SET ${updates.join(', ')} WHERE session_token = $${paramIndex}`;
    await this.db.query(query, values);
  }

  /**
   * セッション完了マーク
   */
  private async markSessionCompleted(sessionToken: string): Promise<void> {
    const query = `
      UPDATE chat_sessions 
      SET completed_at = $1, updated_at = $2 
      WHERE session_token = $3
    `;
    await this.db.query(query, [new Date(), new Date(), sessionToken]);

    const userQuery = `
      UPDATE users 
      SET status = 'completed', updated_at = $1
      WHERE session_id = $2
    `;
    await this.db.query(userQuery, [new Date(), sessionToken]);
  }

  /**
   * プログレス計算
   */
  private calculateProgress(progress: ScenarioProgress): number {
    const workflow = Array.from(this.workflows.values())
      .find(w => w.steps.some(s => s.id === progress.currentStep));
    
    if (!workflow) return 0;

    const totalSteps = workflow.steps.length;
    const completedSteps = progress.completedSteps.length;
    
    return Math.round((completedSteps / totalSteps) * 100);
  }

  /**
   * 完了予定時刻計算
   */
  private calculateEstimatedCompletion(workflow: MNPWorkflow): Date {
    const estimatedMinutes = workflow.metadata.estimatedDuration || 30;
    const now = new Date();
    return new Date(now.getTime() + estimatedMinutes * 60 * 1000);
  }

  /**
   * ワークフロー初期化
   */
  private initializeWorkflows(): void {
    // ロードマップモード
    const roadmapWorkflow: MNPWorkflow = {
      id: 'roadmap',
      name: 'MNP ロードマップ',
      description: 'MNP手続きの全体像を把握し、必要な手順を概観します',
      mode: 'roadmap',
      steps: [
        {
          id: 'overview',
          name: '概要説明',
          description: 'MNP手続きの全体像',
          type: 'info',
          content: 'MNP（携帯電話番号ポータビリティ）の手続きについて、全体の流れをご説明します。',
          nextStep: 'carrier_selection'
        },
        {
          id: 'carrier_selection',
          name: 'キャリア選択',
          description: '現在のキャリアと転出先の確認',
          type: 'question',
          content: '現在お使いのキャリアと、転出先のキャリアを教えてください。',
          options: [
            { id: 'docomo_to_au', label: 'docomo → au', value: 'docomo_au', nextStep: 'docomo_requirements' },
            { id: 'docomo_to_softbank', label: 'docomo → SoftBank', value: 'docomo_softbank', nextStep: 'docomo_requirements' },
            { id: 'au_to_docomo', label: 'au → docomo', value: 'au_docomo', nextStep: 'au_requirements' },
            { id: 'au_to_softbank', label: 'au → SoftBank', value: 'au_softbank', nextStep: 'au_requirements' },
            { id: 'softbank_to_docomo', label: 'SoftBank → docomo', value: 'softbank_docomo', nextStep: 'softbank_requirements' },
            { id: 'softbank_to_au', label: 'SoftBank → au', value: 'softbank_au', nextStep: 'softbank_requirements' }
          ]
        },
        {
          id: 'docomo_requirements',
          name: 'docomo転出手続き',
          description: 'docomoからの転出に必要な手続き',
          type: 'info',
          content: 'docomoからの転出には、MNP予約番号の取得が必要です。',
          nextStep: 'completion_summary',
          carrierSpecific: ['docomo']
        },
        {
          id: 'au_requirements',
          name: 'au転出手続き',
          description: 'auからの転出に必要な手続き',
          type: 'info',
          content: 'auからの転出には、MNP予約番号の取得が必要です。',
          nextStep: 'completion_summary',
          carrierSpecific: ['au']
        },
        {
          id: 'softbank_requirements',
          name: 'SoftBank転出手続き',
          description: 'SoftBankからの転出に必要な手続き',
          type: 'info',
          content: 'SoftBankからの転出には、MNP予約番号の取得が必要です。',
          nextStep: 'completion_summary',
          carrierSpecific: ['softbank']
        },
        {
          id: 'completion_summary',
          name: '手続き完了',
          description: 'MNP手続きの完了',
          type: 'completion',
          content: 'MNP手続きの概要説明が完了しました。詳細な手続きが必要な場合は、ステップバイステップモードをご利用ください。'
        }
      ],
      metadata: {
        version: '1.0.0',
        lastUpdated: new Date(),
        estimatedDuration: 15
      }
    };

    // ステップバイステップモード
    const stepByStepWorkflow: MNPWorkflow = {
      id: 'step_by_step',
      name: 'MNP ステップバイステップ',
      description: '詳細な手順に従って、MNP手続きを段階的に進めます',
      mode: 'step_by_step',
      steps: [
        {
          id: 'initial_check',
          name: '事前確認',
          description: 'MNP手続き前の確認事項',
          type: 'question',
          content: '契約者ご本人での手続きですか？',
          options: [
            { id: 'yes', label: 'はい', value: 'yes', nextStep: 'phone_number_check' },
            { id: 'no', label: 'いいえ', value: 'no', nextStep: 'proxy_info' }
          ],
          validation: [
            { field: 'contractor', type: 'required', message: '契約者確認は必須です' }
          ]
        },
        {
          id: 'proxy_info',
          name: '代理人手続き',
          description: '代理人での手続きについて',
          type: 'info',
          content: '代理人での手続きには追加の書類が必要です。委任状をご準備ください。',
          nextStep: 'phone_number_check'
        },
        {
          id: 'phone_number_check',
          name: '電話番号確認',
          description: '転出する電話番号の確認',
          type: 'question',
          content: '転出する電話番号を入力してください',
          validation: [
            { field: 'phone_number', type: 'pattern', pattern: '^(070|080|090)[0-9]{8}$', message: '正しい携帯電話番号を入力してください' }
          ],
          nextStep: 'current_carrier_check'
        },
        {
          id: 'current_carrier_check',
          name: '現在のキャリア確認',
          description: '現在契約中のキャリアの確認',
          type: 'question',
          content: '現在契約中のキャリアを選択してください',
          options: [
            { id: 'docomo', label: 'docomo', value: 'docomo', nextStep: 'target_carrier_check' },
            { id: 'au', label: 'au', value: 'au', nextStep: 'target_carrier_check' },
            { id: 'softbank', label: 'SoftBank', value: 'softbank', nextStep: 'target_carrier_check' }
          ],
          nextStep: 'target_carrier_check'
        },
        {
          id: 'target_carrier_check',
          name: '転出先キャリア確認',
          description: '転出先キャリアの確認',
          type: 'question',
          content: '転出先のキャリアを選択してください',
          options: [
            { id: 'docomo', label: 'docomo', value: 'docomo', nextStep: 'mnp_process_start' },
            { id: 'au', label: 'au', value: 'au', nextStep: 'mnp_process_start' },
            { id: 'softbank', label: 'SoftBank', value: 'softbank', nextStep: 'mnp_process_start' }
          ],
          nextStep: 'mnp_process_start'
        },
        {
          id: 'mnp_process_start',
          name: 'MNP手続き開始',
          description: 'MNP予約番号取得手続き',
          type: 'action',
          content: 'MNP予約番号の取得を開始します。現在のキャリアに連絡する必要があります。',
          nextStep: 'completion'
        },
        {
          id: 'completion',
          name: '手続き完了',
          description: 'MNP手続きの完了',
          type: 'completion',
          content: 'MNP手続きが完了しました。予約番号を取得後、転出先キャリアでの契約手続きを行ってください。'
        }
      ],
      metadata: {
        version: '1.0.0',
        lastUpdated: new Date(),
        estimatedDuration: 45
      }
    };

    this.workflows.set('roadmap', roadmapWorkflow);
    this.workflows.set('step_by_step', stepByStepWorkflow);

    logger.info('ワークフロー初期化完了', { 
      workflows: Array.from(this.workflows.keys()) 
    });
  }
}

export default ScenarioService;