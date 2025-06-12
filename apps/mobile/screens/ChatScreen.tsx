import React, { useState } from 'react';
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

// Generate a unique user ID that persists for the session
const generateUserId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    const userMessageObj = { 
      id: Date.now().toString(), 
      type: 'user', 
      text: userMessage 
    };
    
    // Add user message immediately
    setMessages(prev => [...prev, userMessageObj]);
    setInput('');
    setIsLoading(true);

    try {
      // Call the API
      const response = await getRecommendations({
        query: userMessage,
        userId: userId,
        conversationId: conversationId
      });

      // Update conversation ID from response
      if (response.threadId) {
        setConversationId(response.threadId);
      }

      // Add system response
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
      
      // Add error message
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

  const renderItem = ({ item }) => (
    <View style={item.type === 'user' ? styles.userBubble : styles.systemBubble}>
      <Text style={styles.bubbleText}>{item.text}</Text>
    </View>
  );

  return (
    <ImageBackground
      source={require('../assets/images/wood_bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <BackButton onPress={() => {
        // Reset conversation when navigating away
        setConversationId(null);
      }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Explore Games</Text>
          <Image source={require('../assets/images/uncle_avatar.png')} style={styles.avatar} />
        </View>

        <View style={styles.messagesWrapper}>
          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
          />
        </View>

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message"
            placeholderTextColor="#ddd"
            style={styles.input}
            editable={!isLoading}
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
  );
}