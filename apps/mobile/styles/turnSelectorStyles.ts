// File: apps/mobile/styles/turnSelectorStyles.ts
import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const turnSelectorStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.titleLight,
    marginBottom: 20,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  inputBox: {
    backgroundColor: Colors.teamTitleYellow,
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    width: '100%',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  label: {
    fontSize: 18,
    color: Colors.textDark,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.grayLight,
    marginBottom: 12,
  },
  picker: {
    width: '100%',
    height: 44,
    fontSize: 16,
  },
  nameInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  nameInput: {
    backgroundColor: Colors.teamTitleYellow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 4,
    width: 100,
    textAlign: 'center',
  },
});
