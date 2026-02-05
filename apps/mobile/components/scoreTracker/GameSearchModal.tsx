import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { scoreTrackerStyles as styles } from '../../styles/scoreTrackerStyles';
import { Colors } from '../../styles/colors';
import { useDebounce } from '../../hooks/useDebounce';
import gameSearchService, { GameSearchResult } from '../../services/GameSearchService';
import type { GameInfo } from '../../types/scoreTracker';

interface GameSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGame: (game: GameInfo) => void;
}

export default function GameSearchModal({
  visible,
  onClose,
  onSelectGame,
}: GameSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setSearchError(null);
    }
  }, [visible]);

  // Search effect
  useEffect(() => {
    if (debouncedQuery.length >= 3) {
      performSearch(debouncedQuery);
    } else {
      setSearchResults([]);
      setSearchError(null);
    }
  }, [debouncedQuery]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);

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

  const handleSelectGame = (game: GameSearchResult) => {
    const gameInfo: GameInfo = {
      id: game.id,
      name: game.name,
      thumbnailUrl: game.imageUrl,
      isCustom: false,
    };
    onSelectGame(gameInfo);
  };

  const handleUseCustomName = () => {
    if (searchQuery.trim().length > 0) {
      const gameInfo: GameInfo = {
        id: `custom-${Date.now()}`,
        name: searchQuery.trim(),
        thumbnailUrl: undefined,
        isCustom: true,
      };
      onSelectGame(gameInfo);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Game</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textDark} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search"
              size={20}
              color={Colors.grayDark}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a game..."
              placeholderTextColor={Colors.grayDark}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              testID="game-search-modal-input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Ionicons name="close-circle" size={20} color={Colors.grayDark} />
              </TouchableOpacity>
            )}
          </View>

          {/* Loading */}
          {isSearching && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={Colors.themeBrown} />
              <Text style={{ marginTop: 8, color: Colors.grayDark }}>Searching...</Text>
            </View>
          )}

          {/* Error */}
          {searchError && (
            <View style={{ padding: 20 }}>
              <Text style={{ color: Colors.red, textAlign: 'center' }}>
                {searchError}
              </Text>
            </View>
          )}

          {/* Search Results */}
          {!isSearching && searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => handleSelectGame(item)}
                  testID={`search-result-${item.id}`}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.searchResultImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.searchResultImage,
                        {
                          backgroundColor: Colors.grayPlaceholder,
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="dice-multiple"
                        size={24}
                        color={Colors.grayDark}
                      />
                    </View>
                  )}
                  <Text style={styles.searchResultName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={Colors.grayDark} />
                </TouchableOpacity>
              )}
            />
          )}

          {/* No Results */}
          {!isSearching && debouncedQuery.length >= 3 && searchResults.length === 0 && !searchError && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: Colors.grayDark, textAlign: 'center' }}>
                No games found matching "{debouncedQuery}"
              </Text>
            </View>
          )}

          {/* Use Custom Name Button */}
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.customNameButton}
              onPress={handleUseCustomName}
              testID="use-custom-name-button"
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={Colors.themeBrown}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.customNameButtonText}>
                Use "{searchQuery.trim()}" as custom game
              </Text>
            </TouchableOpacity>
          )}

          {/* Initial State */}
          {searchQuery.length === 0 && (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <MaterialCommunityIcons
                name="dice-multiple"
                size={48}
                color={Colors.grayLight}
              />
              <Text
                style={{
                  marginTop: 12,
                  color: Colors.grayDark,
                  textAlign: 'center',
                }}
              >
                Search for a board game{'\n'}or enter a custom name
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
