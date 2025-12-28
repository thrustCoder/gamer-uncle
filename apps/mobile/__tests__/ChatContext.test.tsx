import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { ChatProvider, useChat, ChatMessage } from '../store/ChatContext';

// Wrapper component for testing hooks
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChatProvider>{children}</ChatProvider>
);

describe('ChatContext', () => {
  describe('useChat hook', () => {
    it('should throw error when used outside ChatProvider', () => {
      const { result } = renderHook(() => {
        try {
          return useChat();
        } catch (error) {
          return { error };
        }
      });
      
      expect((result.current as any).error).toBeTruthy();
    });

    it('should provide initial welcome message', () => {
      const { result } = renderHook(() => useChat(), { wrapper });
      
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].type).toBe('system');
      expect(result.current.messages[0].text).toContain('Hi there!');
    });

    it('should have null conversationId initially', () => {
      const { result } = renderHook(() => useChat(), { wrapper });
      
      expect(result.current.conversationId).toBeNull();
    });

    it('should allow adding messages', () => {
      const { result } = renderHook(() => useChat(), { wrapper });
      
      const newMessage: ChatMessage = {
        id: '2',
        type: 'user',
        text: 'Test message'
      };
      
      act(() => {
        result.current.setMessages(prev => [...prev, newMessage]);
      });
      
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].text).toBe('Test message');
    });

    it('should allow setting conversationId', () => {
      const { result } = renderHook(() => useChat(), { wrapper });
      
      act(() => {
        result.current.setConversationId('thread_123');
      });
      
      expect(result.current.conversationId).toBe('thread_123');
    });

    it('should clear chat and reset to initial state', () => {
      const { result } = renderHook(() => useChat(), { wrapper });
      
      // Add messages and set conversation ID
      act(() => {
        result.current.setMessages(prev => [...prev, {
          id: '2',
          type: 'user',
          text: 'User message'
        }]);
        result.current.setConversationId('thread_456');
      });
      
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.conversationId).toBe('thread_456');
      
      // Clear chat
      act(() => {
        result.current.clearChat();
      });
      
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].type).toBe('system');
      expect(result.current.conversationId).toBeNull();
    });

    it('should track voice messages correctly', () => {
      const { result } = renderHook(() => useChat(), { wrapper });
      
      const voiceMessage: ChatMessage = {
        id: '2',
        type: 'user',
        text: 'Voice transcribed message',
        isVoiceMessage: true
      };
      
      act(() => {
        result.current.setMessages(prev => [...prev, voiceMessage]);
      });
      
      expect(result.current.messages[1].isVoiceMessage).toBe(true);
    });

    it('should persist state between re-renders', () => {
      const { result, rerender } = renderHook(() => useChat(), { wrapper });
      
      act(() => {
        result.current.setMessages(prev => [...prev, {
          id: '2',
          type: 'user',
          text: 'Persisted message'
        }]);
      });
      
      rerender();
      
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].text).toBe('Persisted message');
    });
  });

  describe('ChatMessage type', () => {
    it('should accept valid message types', () => {
      const userMessage: ChatMessage = { id: '1', type: 'user', text: 'Hello' };
      const systemMessage: ChatMessage = { id: '2', type: 'system', text: 'Hi' };
      const typingMessage: ChatMessage = { id: '3', type: 'typing', text: '' };
      
      expect(userMessage.type).toBe('user');
      expect(systemMessage.type).toBe('system');
      expect(typingMessage.type).toBe('typing');
    });

    it('should support optional isVoiceMessage property', () => {
      const regularMessage: ChatMessage = { id: '1', type: 'user', text: 'Text' };
      const voiceMessage: ChatMessage = { id: '2', type: 'user', text: 'Voice', isVoiceMessage: true };
      
      expect(regularMessage.isVoiceMessage).toBeUndefined();
      expect(voiceMessage.isVoiceMessage).toBe(true);
    });
  });
});
