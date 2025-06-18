import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Image,
  Alert,
} from 'react-native';
import { chatStyles as styles } from '../styles/chatStyles';
import BackButton from '../components/BackButton';
import { getRecommendations } from '../services/ApiClient';
import { useNavigation } from '@react-navigation/native';

// Generate a unique user ID that persists for the session
const generateUserId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Typing indicator component
const TypingIndicator = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.systemBubble}>
      <Text style={styles.bubbleText}>🤔{dots}</Text>
    </View>
  );
};

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    { id: '1', type: 'system', text: 'Hi! Need help finding a new board game?' },
    { id: '2', type: 'user', text: 'Ok!' },
    { id: '3', type: 'system', text: 'What kind of game are you looking for? Think about the number of players, mechanics, max play time, age restrictions etc.' }
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId] = useState(generateUserId()); // Generate once per session
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (flatListRef.current) {
      // Use a longer timeout to ensure the message is rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [messages.length]); // Only trigger when message count changes

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    const userMessageObj = { 
      id: Date.now().toString(), 
      type: 'user', 
      text: userMessage 
    };
    
    setMessages(prev => [...prev, userMessageObj]);
    setInput('');
    setIsLoading(true);

    // Add typing indicator
    const typingId = `typing-${Date.now()}`;
    setMessages(prev => [...prev, { id: typingId, type: 'typing', text: '' }]);

    try {
      // FIX: Use PascalCase keys to match backend
      const response = await getRecommendations({
        Query: userMessage,
        UserId: userId,
        ConversationId: conversationId
      });

      setMessages(prev => prev.filter(msg => msg.id !== typingId));

      if (response.threadId) {
        setConversationId(response.threadId);
      }

      if (response.responseText) {
        const systemMessage = {
          id: (Date.now() + 1).toString(),
          type: 'system',
          text: response.responseText
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    } catch (error) {
      console.error('Error calling API:', error);
      setMessages(prev => prev.filter(msg => msg.id !== typingId));
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        text: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.nativeEvent.key === 'Enter') {
      event.preventDefault();
      handleSend();
    }
  };

  const renderItem = ({ item }) => {
    if (item.type === 'typing') {
      return <TypingIndicator />;
    }
    
    return (
      <View style={item.type === 'user' ? styles.userBubble : styles.systemBubble}>
        <Text style={styles.bubbleText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ImageBackground
        source={require('../assets/images/wood_bg.png')}
        style={styles.background}
        resizeMode="repeat"
      >
        <BackButton onPress={() => {
          setConversationId(null);
          navigation.goBack(); // <-- Add this line to actually go back
        }} />

        <View style={styles.container}>
          <View style={styles.header}>
            <Image source={require('../assets/images/uncle_avatar.png')} style={styles.avatar} />
          </View>

          {/* This wrapper must have flex: 1 */}
          <View style={styles.messagesWrapper}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.messagesContainer}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="always"
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }}
            />
          </View>

          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onKeyPress={handleKeyPress}
              placeholder="Message"
              placeholderTextColor="#ddd"
              style={styles.input}
              editable={!isLoading}
              multiline
              maxLength={500}
              blurOnSubmit={false}
            />
            <TouchableOpacity 
              onPress={handleSend} 
              style={[styles.sendButton, isLoading && { opacity: 0.6 }]}
              disabled={isLoading}
            >
              <Text style={styles.sendText}>{isLoading ? '...' : '➤'}</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ImageBackground>
    </KeyboardAvoidingView>
  );
}