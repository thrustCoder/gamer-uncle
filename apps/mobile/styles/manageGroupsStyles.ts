import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const manageGroupsStyles = StyleSheet.create({
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
    marginBottom: 20,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  groupCard: {
    backgroundColor: 'rgba(139, 69, 19, 0.5)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  groupCardActive: {
    borderColor: Colors.themeYellow,
    backgroundColor: 'rgba(139, 69, 19, 0.7)',
  },
  groupCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    flex: 1,
  },
  groupPlayerCount: {
    fontSize: 13,
    color: Colors.grayLight,
    marginTop: 3,
  },
  activeLabel: {
    fontSize: 11,
    color: Colors.themeGreen,
    fontWeight: '600',
    marginTop: 2,
  },
  iconButton: {
    padding: 8,
    marginLeft: 6,
  },
  iconText: {
    fontSize: 18,
  },
  createButton: {
    backgroundColor: Colors.themeGreen,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(251, 232, 201, 0.2)',
    marginVertical: 16,
  },
  disableButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 30,
  },
  disableButtonText: {
    color: Colors.themeBrownDark,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  maxGroupsText: {
    color: Colors.grayDark,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
