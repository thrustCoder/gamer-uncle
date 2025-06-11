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
} from 'react-native';
import { chatStyles as styles } from '../styles/chatStyles';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    { id: '1', type: 'system', text: 'Hi! Need help finding a new board game?' },
    { id: '2', type: 'user', text: 'Ok!' },
    { id: '3', type: 'system', text: 'What kind of game are you looking for? Think about the number of players, mechanics, max play time, age restrictions etc.' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage = { id: Date.now().toString(), type: 'user', text: input.trim() };
    setMessages(prev => [...prev, newMessage]);
    setInput('');
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
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
            <Text style={styles.sendText}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}