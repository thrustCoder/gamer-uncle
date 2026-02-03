import { StyleSheet, Dimensions } from 'react-native';
import { Colors } from './colors';

const screenWidth = Dimensions.get('window').width;

export const gameSearchStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  scrollContentDetails: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  
  // Header/Title Section
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.themeYellow,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // Search Section
  searchSection: {
    backgroundColor: Colors.themeBrownDark,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.whiteTransparent,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textDark,
  },
  clearButton: {
    padding: 8,
  },

  // Suggestions List
  suggestionsContainer: {
    marginTop: 12,
    backgroundColor: Colors.whiteTransparent,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 280,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.grayLight,
  },
  suggestionImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionContent: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 2,
  },
  suggestionMeta: {
    fontSize: 13,
    color: Colors.grayDark,
  },

  // Loading State
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.themeYellow,
    marginTop: 8,
    fontSize: 14,
  },

  // No Results State
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noResultsEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 18,
    color: Colors.themeYellow,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: Colors.themeYellow,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 20,
  },
  askUncleButton: {
    backgroundColor: Colors.themeGreen,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  askUncleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.themeYellow,
  },

  // Error State
  errorContainer: {
    backgroundColor: 'rgba(192, 57, 43, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 12,
  },
  retryButtonText: {
    color: Colors.red,
    fontWeight: '600',
    fontSize: 13,
  },

  // Game Details Section
  detailsContainer: {
    flex: 1,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  detailsBackButton: {
    backgroundColor: Colors.themeYellow,
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  detailsBackArrow: {
    fontSize: 30,
    color: Colors.themeBrownDark,
    fontWeight: '900',
    lineHeight: 30,
    marginTop: 5,
    textAlign: 'center',
  },
  detailsSearchButton: {
    backgroundColor: Colors.themeYellow,
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  detailsSection: {
    backgroundColor: Colors.themeBrownDark,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 16,
  },
  gameImage: {
    width: '100%',
    height: 220,
    marginBottom: 12,
    resizeMode: 'contain',
  },
  gameImagePlaceholder: {
    width: '100%',
    height: 220,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameImagePlaceholderIcon: {
    opacity: 0.6,
  },
  detailsContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  gameName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    marginBottom: 12,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // Ratings Section
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  ratingsLabel: {
    color: Colors.themeYellow,
    fontSize: 14,
    marginRight: 8,
    opacity: 0.9,
  },
  votesText: {
    color: Colors.themeYellow,
    fontSize: 14,
    marginLeft: 8,
    opacity: 0.8,
  },
  bggRatingRow: {
    marginBottom: 16,
  },

  // Overview Section
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.themeYellow,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 8,
  },
  overviewText: {
    fontSize: 15,
    color: Colors.themeYellow,
    lineHeight: 22,
    opacity: 0.95,
    marginBottom: 4,
  },

  // Stats Section
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    marginHorizontal: -6,
  },
  statsGridOutside: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    paddingHorizontal: 4,
  },
  statBox: {
    backgroundColor: Colors.themeBrownDark,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: Colors.themeYellow,
    opacity: 0.8,
    textAlign: 'center',
  },

  // Rules Link
  rulesButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.themePurple,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  rulesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.themeYellow,
    marginLeft: 8,
  },

  // Question Button
  questionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.themeGreen,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  questionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.themeYellow,
    textAlign: 'center',
    marginLeft: 8,
  },

  // Buttons container for details view
  detailsButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 16,
    gap: 12,
  },

  // Back to Search Button (legacy - no longer used but kept for reference)
  backToSearchButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },

  // Initial State (empty search)
  initialStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  initialStateEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  initialStateText: {
    fontSize: 18,
    color: Colors.themeYellow,
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
