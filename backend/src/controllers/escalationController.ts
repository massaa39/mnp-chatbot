import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { escalationService } from '../services/escalationService';
import { chatRepository } from '../repositories/chatRepository';
import { userRepository } from '../repositories/userRepository';
import { logger } from '../utils/logger';
import { APIResponse } from '../types/api';
import type { EscalationPriority, EscalationStatus } from '../types/database';

/**
 * エスカレーション開始
 */
export const initiateEscalation = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { sessionToken, reason, priority = 'medium', contactInfo, context } = req.body;

    if (!sessionToken || !reason) {
      logger.warn('エスカレーション開始: 必要なパラメータが不足', { 
        sessionToken: !!sessionToken, 
        reason: !!reason 
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'セッショントークンと理由は必須です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    // セッション検証
    const session = await chatRepository.getSessionByToken(sessionToken);
    if (!session) {
      logger.warn('エスカレーション開始: 無効なセッション', { sessionToken });
      
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: '指定されたセッションが見つかりません'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    // 既存のエスカレーションチェック
    if (session.escalated_at) {
      logger.info('エスカレーション開始: 既にエスカレーション済み', { 
        sessionToken, 
        escalatedAt: session.escalated_at 
      });
      
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_ESCALATED',
          message: 'このセッションは既にエスカレーション済みです'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    // エスカレーション処理実行
    const escalationResult = await escalationService.initiateEscalation({
      sessionId: session.id,
      sessionToken,
      reason,
      priority: priority as EscalationPriority,
      contactInfo,
      context: {
        ...context,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        timestamp: new Date().toISOString()
      }
    });

    // セッション更新
    await chatRepository.updateSession(sessionToken, {
      escalated_at: new Date(),
      escalation_reason: reason,
      escalation_ticket_id: escalationResult.ticketId
    });

    const responseTime = Date.now() - startTime;
    
    logger.info('エスカレーション開始完了', {
      sessionToken,
      ticketId: escalationResult.ticketId,
      priority,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: {
        ticketId: escalationResult.ticketId,
        status: escalationResult.status,
        estimatedWaitTime: escalationResult.estimatedWaitTime,
        assignedAgent: escalationResult.assignedAgent,
        priority: escalationResult.priority,
        createdAt: escalationResult.createdAt,
        message: 'エスカレーションが開始されました。担当者から連絡いたします。'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<typeof escalationResult>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('エスカレーション開始エラー', { 
      error, 
      sessionToken: req.body.sessionToken,
      responseTime 
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ESCALATION_ERROR',
        message: 'エスカレーションの開始に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * エスカレーション状態取得
 */
export const getEscalationStatus = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { sessionToken } = req.params;

    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SESSION_TOKEN',
          message: 'セッショントークンが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    // セッション検証
    const session = await chatRepository.getSessionByToken(sessionToken);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: '指定されたセッションが見つかりません'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    // エスカレーション状態取得
    const escalationStatus = await escalationService.getEscalationStatus(session.id);

    const responseTime = Date.now() - startTime;

    logger.info('エスカレーション状態取得', {
      sessionToken,
      status: escalationStatus?.status || 'none',
      responseTime
    });

    res.status(200).json({
      success: true,
      data: escalationStatus || {
        status: 'none' as EscalationStatus,
        ticketId: null,
        estimatedWaitTime: null,
        assignedAgent: null,
        priority: null,
        createdAt: null,
        updatedAt: null
      },
      timestamp: new Date().toISOString()
    } as APIResponse<typeof escalationStatus>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('エスカレーション状態取得エラー', { 
      error, 
      sessionToken: req.params.sessionToken,
      responseTime 
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_FETCH_ERROR',
        message: 'エスカレーション状態の取得に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * エスカレーション更新
 */
export const updateEscalation = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { ticketId } = req.params;
    const { status, assignedAgent, notes, estimatedWaitTime } = req.body;

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TICKET_ID',
          message: 'チケットIDが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    // エスカレーション更新
    const updatedEscalation = await escalationService.updateEscalation(ticketId, {
      status: status as EscalationStatus,
      assignedAgent,
      notes,
      estimatedWaitTime
    });

    if (!updatedEscalation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ESCALATION_NOT_FOUND',
          message: '指定されたエスカレーションが見つかりません'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const responseTime = Date.now() - startTime;

    logger.info('エスカレーション更新完了', {
      ticketId,
      status,
      assignedAgent,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: updatedEscalation,
      timestamp: new Date().toISOString()
    } as APIResponse<typeof updatedEscalation>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('エスカレーション更新エラー', { 
      error, 
      ticketId: req.params.ticketId,
      responseTime 
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: 'エスカレーションの更新に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * エスカレーション一覧取得
 */
export const getEscalations = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { 
      status, 
      priority, 
      assignedAgent,
      limit = 20, 
      offset = 0,
      orderBy = 'created_at DESC'
    } = req.query;

    const escalations = await escalationService.getEscalations({
      status: status as EscalationStatus,
      priority: priority as EscalationPriority,
      assignedAgent: assignedAgent as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      orderBy: orderBy as string
    });

    const responseTime = Date.now() - startTime;

    logger.info('エスカレーション一覧取得', {
      count: escalations.length,
      filters: { status, priority, assignedAgent },
      responseTime
    });

    res.status(200).json({
      success: true,
      data: {
        escalations,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: escalations.length
        }
      },
      timestamp: new Date().toISOString()
    } as APIResponse<{ escalations: typeof escalations; pagination: any }>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('エスカレーション一覧取得エラー', { error, responseTime });

    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_FETCH_ERROR',
        message: 'エスカレーション一覧の取得に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * エスカレーション詳細取得
 */
export const getEscalationDetails = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TICKET_ID',
          message: 'チケットIDが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const escalationDetails = await escalationService.getEscalationDetails(ticketId);

    if (!escalationDetails) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ESCALATION_NOT_FOUND',
          message: '指定されたエスカレーションが見つかりません'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const responseTime = Date.now() - startTime;

    logger.info('エスカレーション詳細取得', {
      ticketId,
      status: escalationDetails.status,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: escalationDetails,
      timestamp: new Date().toISOString()
    } as APIResponse<typeof escalationDetails>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('エスカレーション詳細取得エラー', { 
      error, 
      ticketId: req.params.ticketId,
      responseTime 
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'DETAILS_FETCH_ERROR',
        message: 'エスカレーション詳細の取得に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * エスカレーション統計取得
 */
export const getEscalationStats = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { period = '7d' } = req.query;

    const stats = await escalationService.getEscalationStats(period as string);

    const responseTime = Date.now() - startTime;

    logger.info('エスカレーション統計取得', {
      period,
      totalEscalations: stats.totalEscalations,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    } as APIResponse<typeof stats>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('エスカレーション統計取得エラー', { error, responseTime });

    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_ERROR',
        message: 'エスカレーション統計の取得に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * エスカレーション終了
 */
export const resolveEscalation = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { ticketId } = req.params;
    const { resolution, feedback, rating } = req.body;

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TICKET_ID',
          message: 'チケットIDが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const resolvedEscalation = await escalationService.resolveEscalation(ticketId, {
      resolution,
      feedback,
      rating: rating ? parseInt(rating) : undefined,
      resolvedAt: new Date()
    });

    if (!resolvedEscalation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ESCALATION_NOT_FOUND',
          message: '指定されたエスカレーションが見つかりません'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const responseTime = Date.now() - startTime;

    logger.info('エスカレーション終了完了', {
      ticketId,
      rating,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: {
        ...resolvedEscalation,
        message: 'エスカレーションが正常に終了されました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<typeof resolvedEscalation>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('エスカレーション終了エラー', { 
      error, 
      ticketId: req.params.ticketId,
      responseTime 
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'RESOLVE_ERROR',
        message: 'エスカレーションの終了に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};