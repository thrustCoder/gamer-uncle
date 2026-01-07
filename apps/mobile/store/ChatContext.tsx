import React, { createContext, useContext, useState, ReactNode } from 'react';

// Message type definition
export interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'typing' | 'thinking';
  text: string;
  isVoiceMessage?: boolean;
}

interface ChatContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  conversationId: string | null;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  clearChat: () => void;
}

const initialMessage: ChatMessage = {
  id: '1',
  type: 'system',
  text: 'Hi there! 👋 Got a board game question? \n\nWhether you\'re looking for the perfect game, need help with tricky rules, or just some strategy advice - I\'m here to help! 🎲'
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const clearChat = () => {
    setMessages([initialMessage]);
    setConversationId(null);
  };

  return (
    <ChatContext.Provider value={{ 
      messages, 
      setMessages, 
      conversationId, 
      setConversationId,
      clearChat 
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
