import { useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

export const useChat = () => {
  const {
    messages,
    currentSession,
    mode,
    uiState,
    escalationState,
    sendMessage,
    addMessage,
    clearMessages,
    startNewSession,
    setLoading,
    setTyping,
    switchMode,
    initiateEscalation,
  } = useChatStore();

  const { sessionToken } = useAuthStore();

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [sendMessage]);

  const handleNewSession = useCallback(async () => {
    try {
      await startNewSession();
    } catch (error) {
      console.error('Failed to start new session:', error);
    }
  }, [startNewSession]);

  const handleModeSwitch = useCallback((newMode: 'step_by_step' | 'roadmap') => {
    switchMode(newMode);
  }, [switchMode]);

  const handleEscalation = useCallback(async (reason: string) => {
    try {
      await initiateEscalation(reason);
    } catch (error) {
      console.error('Failed to initiate escalation:', error);
    }
  }, [initiateEscalation]);

  return {
    // State
    messages,
    currentSession,
    mode,
    uiState,
    escalationState,
    sessionToken,
    
    // Actions
    sendMessage: handleSendMessage,
    addMessage,
    clearMessages,
    startNewSession: handleNewSession,
    setLoading,
    setTyping,
    switchMode: handleModeSwitch,
    initiateEscalation: handleEscalation,
    
    // Computed
    isLoading: uiState.isLoading,
    isTyping: uiState.isTyping,
    isConnected: uiState.isConnected,
    error: uiState.error,
    hasMessages: messages.length > 0,
    isEscalated: escalationState.isEscalated,
  };
};

export default useChat;