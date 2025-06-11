import { StyleSheet } from 'react-native';

export const chatStyles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    alignItems: 'center',
    paddingTop: 35,
    marginBottom: 10,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fbe8c9',
  },
  avatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: '#fbe8c9',
    marginTop: 10,
  },
  messagesWrapper: {
    flex: 1, // This takes up remaining space
    paddingHorizontal: 16,
  },
  messagesContainer: {
    paddingVertical: 10,
  },
  systemBubble: {
    backgroundColor: '#D68F20',
    borderRadius: 24,
    padding: 16,
    marginVertical: 10,
    alignSelf: 'flex-start',
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#265C2E',
    borderRadius: 24,
    padding: 16,
    marginVertical: 10,
    alignSelf: 'flex-end',
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleText: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 24,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#265C2E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#3E7A4A',
    borderRadius: 32,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#3E7A4A',
    borderRadius: 24,
    padding: 10,
  },
  sendText: {
    fontSize: 20,
    color: '#fff',
  },
});