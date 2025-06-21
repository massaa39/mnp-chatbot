import { chatApi } from './chatApi';
import type { EscalationRequest, EscalationResponse } from '../types/api';

export class EscalationService {
  async initiateEscalation(request: EscalationRequest): Promise<EscalationResponse> {
    try {
      const response = await chatApi.initiateEscalation(request);
      return response.data;
    } catch (error) {
      console.error('Escalation initiation failed:', error);
      throw new Error('エスカレーションの開始に失敗しました');
    }
  }

  async getEscalationStatus(ticketId: string): Promise<any> {
    try {
      const response = await chatApi.getEscalationStatus(ticketId);
      return response.data;
    } catch (error) {
      console.error('Failed to get escalation status:', error);
      throw new Error('エスカレーション状況の取得に失敗しました');
    }
  }

  async updateEscalationStatus(ticketId: string, status: string): Promise<any> {
    try {
      const response = await chatApi.updateEscalation(ticketId, { status });
      return response.data;
    } catch (error) {
      console.error('Failed to update escalation status:', error);
      throw new Error('エスカレーション状況の更新に失敗しました');
    }
  }

  async cancelEscalation(ticketId: string): Promise<any> {
    try {
      const response = await chatApi.updateEscalation(ticketId, { status: 'cancelled' });
      return response.data;
    } catch (error) {
      console.error('Failed to cancel escalation:', error);
      throw new Error('エスカレーションのキャンセルに失敗しました');
    }
  }
}

export const escalationService = new EscalationService();
export default escalationService;