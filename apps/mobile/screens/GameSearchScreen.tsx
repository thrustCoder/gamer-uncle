import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Image,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { gameSearchStyles as styles } from '../styles/gameSearchStyles';
import { Colors } from '../styles/colors';
import BackButton from '../components/BackButton';
import StarRating from '../components/StarRating';
import { useDebounce } from '../hooks/useDebounce';
import gameSearchService, {
  GameSearchResult,
  GameDetails,
} from '../services/GameSearchService';

type ViewState = 'search' | 'details';

export default function GameSearchScreen() {
  const navigation = useNavigation<any>();
  
  // View state
  const [viewState, setViewState] = useState<ViewState>('search');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Game details state
  const [selectedGame, setSelectedGame] = useState<GameDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  
  // Debounced search query
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Search effect
  useEffect(() => {
    if (debouncedQuery.length >= 3) {
      performSearch(debouncedQuery);
    } else {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
    }
  }, [debouncedQuery]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    
    try {
      const response = await gameSearchService.searchGames(query);
      setSearchResults(response.results);
    } catch (error: any) {
      setSearchError(error.message || 'Failed to search games');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectGame = async (game: GameSearchResult) => {
    setIsLoadingDetails(true);
    setDetailsError(null);
    
    try {
      const details = await gameSearchService.getGameDetails(game.id);
      setSelectedGame(details);
      setViewState('details');
    } catch (error: any) {
      setDetailsError(error.message || 'Failed to load game details');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleBackToSearch = () => {
    setViewState('search');
    setSelectedGame(null);
    setDetailsError(null);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setSearchError(null);
  };

  const handleOpenRules = useCallback((url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open rules URL:', err);
    });
  }, []);

  const handleAskUncle = (gameName?: string) => {
    if (gameName) {
      // Navigate to chat with game context
      navigation.navigate('Chat', {
        gameContext: {
          gameName: gameName,
          fromGameSearch: true,
        },
      });
    } else {
      // Navigate to chat with the search query
      navigation.navigate('Chat', {
        prefillContext: {
          searchQuery: searchQuery,
          fromGameSearchNoResults: true,
        },
      });
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const renderSearchView = () => (
    <>
      {/* Title */}
      <Text style={styles.title}>Game Search</Text>
      <Text style={styles.subtitle}>Find information about any board game</Text>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Ionicons 
            name="search" 
            size={20} 
            color={Colors.grayDark} 
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Type game name..."
            placeholderTextColor={Colors.grayDark}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
            autoCorrect={false}
            testID="game-search-input"
            {...(Platform.OS === 'web' && { 'data-testid': 'game-search-input' })}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={Colors.grayDark} />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading indicator */}
        {isSearching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.themeYellow} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {/* Error state */}
        {searchError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={Colors.white} />
            <Text style={styles.errorText}>{searchError}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => performSearch(searchQuery)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Results */}
        {!isSearching && searchResults.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              scrollEnabled={searchResults.length > 4}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.suggestionItem,
                    index === searchResults.length - 1 && styles.suggestionItemLast,
                  ]}
                  onPress={() => handleSelectGame(item)}
                  testID={`search-result-${index}`}
                >
                  {item.imageUrl ? (
                    <Image 
                      source={{ uri: item.imageUrl }} 
                      style={styles.suggestionImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.suggestionImagePlaceholder}>
                      <MaterialCommunityIcons 
                        name="dice-multiple" 
                        size={24} 
                        color={Colors.grayDark} 
                      />
                    </View>
                  )}
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.suggestionMeta}>
                      {item.minPlayers}-{item.maxPlayers} players • ⭐ {(item.averageRating / 2).toFixed(1)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.grayDark} />
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* No Results State */}
        {!isSearching && hasSearched && searchResults.length === 0 && !searchError && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsEmoji}>😕</Text>
            <Text style={styles.noResultsText}>
              We couldn't find a game matching your search.
            </Text>
            <Text style={styles.noResultsSubtext}>
              Try a different spelling or ask Gamer Uncle!
            </Text>
            <TouchableOpacity 
              style={styles.askUncleButton}
              onPress={() => handleAskUncle()}
              testID="ask-uncle-no-results"
            >
              <Text style={styles.askUncleButtonText}>Want to ask Gamer Uncle?</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Initial State */}
      {!hasSearched && searchQuery.length < 3 && (
        <View style={styles.initialStateContainer}>
          <Text style={styles.initialStateEmoji}>🔍</Text>
          <Text style={styles.initialStateText}>
            Start typing to search for games{'\n'}(minimum 3 characters)
          </Text>
        </View>
      )}

      {/* Loading Details Overlay */}
      {isLoadingDetails && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.themeYellow} />
          <Text style={styles.loadingText}>Loading game details...</Text>
        </View>
      )}

      {/* Details Error */}
      {detailsError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={Colors.white} />
          <Text style={styles.errorText}>{detailsError}</Text>
        </View>
      )}
    </>
  );

  const renderDetailsView = () => {
    if (!selectedGame) return null;

    return (
      <View style={styles.detailsSection}>
        {/* Game Image */}
        {selectedGame.imageUrl ? (
          <Image
            source={{ uri: selectedGame.imageUrl }}
            style={styles.gameImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.gameImagePlaceholder}>
            <MaterialCommunityIcons
              name="dice-multiple"
              size={64}
              color={Colors.themeYellow}
              style={styles.gameImagePlaceholderIcon}
            />
          </View>
        )}

        {/* Back to Search Button */}
        <TouchableOpacity
          style={styles.backToSearchButton}
          onPress={handleBackToSearch}
          testID="back-to-search"
        >
          <Ionicons name="search" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.detailsContent}>
          {/* Game Name */}
          <Text style={styles.gameName}>{selectedGame.name}</Text>

          {/* Average Rating */}
          <View style={styles.ratingsRow}>
            <StarRating 
              rating={selectedGame.averageRating} 
              size={20}
              showValue={true}
            />
            <Text style={styles.votesText}>
              ({formatNumber(selectedGame.numVotes)} votes)
            </Text>
          </View>

          {/* BGG Rating */}
          <View style={[styles.ratingsRow, styles.bggRatingRow]}>
            <Text style={styles.ratingsLabel}>BGG Rating:</Text>
            <StarRating 
              rating={selectedGame.bggRating} 
              size={16}
              showValue={true}
            />
          </View>

          {/* Overview */}
          {selectedGame.overview && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="document-text" size={18} color={Colors.themeYellow} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Overview</Text>
              </View>
              <Text style={styles.overviewText}>{selectedGame.overview}</Text>
            </>
          )}

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={styles.statBox}>
                <Ionicons name="people" size={24} color={Colors.themeYellow} style={styles.statIcon} />
                <Text style={styles.statValue}>
                  {selectedGame.minPlayers === selectedGame.maxPlayers 
                    ? selectedGame.minPlayers 
                    : `${selectedGame.minPlayers}-${selectedGame.maxPlayers}`}
                </Text>
                <Text style={styles.statLabel}>Players</Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <View style={styles.statBox}>
                <Ionicons name="person" size={24} color={Colors.themeYellow} style={styles.statIcon} />
                <Text style={styles.statValue}>{selectedGame.ageRequirement}+</Text>
                <Text style={styles.statLabel}>Age</Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <View style={styles.statBox}>
                <Ionicons name="time" size={24} color={Colors.themeYellow} style={styles.statIcon} />
                <Text style={styles.statValue}>
                  {selectedGame.minPlaytime === selectedGame.maxPlaytime
                    ? `${selectedGame.minPlaytime}`
                    : `${selectedGame.minPlaytime}-${selectedGame.maxPlaytime}`}
                </Text>
                <Text style={styles.statLabel}>Minutes</Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <View style={styles.statBox}>
                <MaterialCommunityIcons name="weight" size={24} color={Colors.themeYellow} style={styles.statIcon} />
                <Text style={styles.statValue}>{selectedGame.weight.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Complexity</Text>
              </View>
            </View>
          </View>

          {/* Rules Link */}
          {selectedGame.rulesUrl && (
            <TouchableOpacity
              style={styles.rulesButton}
              onPress={() => handleOpenRules(selectedGame.rulesUrl!)}
              testID="view-rules-button"
            >
              <Ionicons name="book-outline" size={20} color={Colors.themeYellow} />
              <Text style={styles.rulesButtonText}>View Rules</Text>
            </TouchableOpacity>
          )}

          {/* Ask Questions Button */}
          <TouchableOpacity
            style={styles.questionButton}
            onPress={() => handleAskUncle(selectedGame.name)}
            testID="ask-questions-button"
          >
            <Text style={styles.questionButtonText}>
              Have questions about this game?
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground
      source={require('../assets/images/tool_background.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BackButton />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {viewState === 'search' ? renderSearchView() : renderDetailsView()}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
