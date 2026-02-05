import { StyleSheet, Dimensions } from 'react-native';
import { Colors } from './colors';
const screen = Dimensions.get('window');

// Calculate dice size based on screen dimensions
// Use the smaller dimension to ensure dice fit on tablets in any orientation
const smallerDimension = Math.min(screen.width, screen.height);
// Cap the dice size at 200 for tablets, and use 40% of smaller dimension for phones
const maxDiceSize = 200;
const calculatedSize = smallerDimension * 0.4;
const diceSize = Math.min(calculatedSize, maxDiceSize);

export const diceRollerStyles = StyleSheet.create({
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.themePurple,
    borderRadius: 20,
    padding: 10,
    marginTop: 150,
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 15,
    backgroundColor: Colors.themePurpleDark,
  },
  activeToggle: {
    backgroundColor: Colors.themeBrown,
  },
  toggleText: {
    fontSize: 20,
    color: Colors.themeYellow,
  },
  arena: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  diceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  dice: {
    width: diceSize,
    height: diceSize,
    marginHorizontal: 10,
  },
});
