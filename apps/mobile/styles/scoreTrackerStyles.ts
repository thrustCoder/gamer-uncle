import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const scoreTrackerStyles = StyleSheet.create({
  // === Container Styles ===
  background: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // === Title Styles ===
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    textAlign: 'center',
    marginBottom: 20,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },

  // === Player Names Section ===
  playerSection: {
    marginBottom: 20,
  },
  playerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  playerCountButton: {
    backgroundColor: Colors.themeBrownDark,
    borderRadius: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    width: 80,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.themeYellow,
  },
  playerCountText: {
    color: Colors.themeYellow,
    fontSize: 18,
    fontWeight: 'bold',
  },
  playerNamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  playerNameInput: {
    backgroundColor: Colors.whiteTransparent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  playerNameInputNarrow: {
    width: '31%',
  },
  playerNameInputWide: {
    width: '48%',
  },

  // === Section Container (Game Score / Leaderboard) ===
  sectionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
    marginLeft: 10,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },

  // === Game Thumbnail ===
  gameThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.grayPlaceholder,
  },
  gameThumbnailPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.grayPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // === Stack Ranking Chart ===
  rankingContainer: {
    marginBottom: 16,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rankingInitials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.wheelLightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankingInitialsText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  rankingBarContainer: {
    flex: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  rankingBar: {
    height: '100%',
    backgroundColor: Colors.wheelGreen,
    borderRadius: 14,
    justifyContent: 'center',
    paddingRight: 8,
    minWidth: 40,
  },
  rankingScore: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },

  // === Score Table ===
  tableContainer: {
    backgroundColor: Colors.wheelGray,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.wheelLightGray,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: Colors.themeYellow,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableHeaderCellFirst: {
    width: 120,
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableCell: {
    color: Colors.white,
    fontSize: 14,
    textAlign: 'center',
  },
  tableCellFirst: {
    width: 120,
    textAlign: 'left',
    fontWeight: 'bold',
  },
  swipeActions: {
    flexDirection: 'row',
  },
  swipeActionButton: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionEdit: {
    backgroundColor: Colors.wheelOrange,
  },
  swipeActionDelete: {
    backgroundColor: Colors.wheelRed,
  },
  swipeActionText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },

  // === Add Row Button ===
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.wheelGreen,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  addRowButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  addRowIcon: {
    marginRight: 8,
  },

  // === Empty State Buttons ===
  emptyStateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  emptyStateButton: {
    flex: 1,
    backgroundColor: Colors.wheelGreen,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 8,
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyStateButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // === Score Input Screen ===
  inputScreenContainer: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  inputTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    textAlign: 'center',
    marginBottom: 24,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  scoreInputRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
    flex: 1,
  },
  scoreInputControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.themeBrownDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreInput: {
    width: 80,
    height: 44,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.grayLight,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 12,
    color: Colors.textDark,
  },
  saveButton: {
    backgroundColor: Colors.wheelGreen,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.grayDisabled,
  },

  // === Game Search Modal ===
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  modalCloseButton: {
    padding: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: Colors.textDark,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchResultImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  searchResultName: {
    flex: 1,
    fontSize: 16,
    color: Colors.textDark,
  },
  customNameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  customNameButtonText: {
    color: Colors.themeBrown,
    fontSize: 16,
    fontWeight: '600',
  },

  // === Leaderboard Table Game Cell ===
  gameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
  },
  gameCellThumbnail: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginRight: 6,
  },
  gameCellName: {
    fontSize: 12,
    color: Colors.white,
    flex: 1,
  },

  // === Game Info Card (Score Input Screen) ===
  gameInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameInfoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  gameInfoThumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.grayPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameInfoContent: {
    flex: 1,
    marginLeft: 12,
  },
  gameInfoName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  gameInfoTapHint: {
    fontSize: 13,
    color: Colors.grayDark,
    marginTop: 4,
  },

  // === Secondary Button (Dark Brown) ===
  secondaryButton: {
    backgroundColor: Colors.themeBrownDark,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
    alignSelf: 'center',
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  secondaryButtonText: {
    color: Colors.themeYellow,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
