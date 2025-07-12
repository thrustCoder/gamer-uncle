import { StyleSheet, Dimensions } from 'react-native';
import { Colors } from './colors';
const screen = Dimensions.get('window');

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
  },
  diceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dice: {
    width: screen.width * 0.6,
    height: screen.width * 0.6,
    marginHorizontal: -25,
  },
});
