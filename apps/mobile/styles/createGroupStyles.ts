import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const createGroupStyles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: 'cover',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    textAlign: 'center',
    marginBottom: 24,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  label: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    marginBottom: 8,
    marginTop: 16,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  textInput: {
    backgroundColor: Colors.whiteTransparent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textDark,
  },
  playerCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  playerCountButton: {
    backgroundColor: Colors.themeBrownDark,
    borderRadius: 7,
    width: 48,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.themeYellow,
  },
  playerCountText: {
    color: Colors.themeYellow,
    fontSize: 15,
    fontWeight: 'bold',
  },
  nameInputsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  nameInput: {
    backgroundColor: Colors.whiteTransparent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 16,
    width: '48%',
  },
  nameInputNarrow: {
    width: '31%',
  },
  manyPlayersText: {
    color: Colors.grayDark,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: Colors.themeGreen,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginTop: 4,
  },
});
