import React from 'react';
import { Dimensions } from 'react-native';

/**
 * Test suite for diceRollerStyles
 * 
 * These tests verify that the dice roller styles are correctly configured
 * for tablet form factors, ensuring both dice are visible when 2 dice are selected.
 * 
 * The key fix was:
 * 1. Using the smaller screen dimension to calculate dice size (works for any orientation)
 * 2. Capping dice size at 200px max to prevent overflow on tablets
 * 3. Using positive horizontal margin instead of negative to ensure proper spacing
 * 4. Adding full width to arena for proper centering
 */

describe('diceRollerStyles', () => {
  // Test that dice size is calculated correctly for different screen sizes
  
  it('should have dice size capped at 200 for tablets', () => {
    // Import the styles to verify the dice size calculation
    const { diceRollerStyles } = require('../styles/diceRollerStyles');
    
    // Dice size should be at most 200 (the max cap)
    expect(diceRollerStyles.dice.width).toBeLessThanOrEqual(200);
    expect(diceRollerStyles.dice.height).toBeLessThanOrEqual(200);
  });

  it('should have positive horizontal margin for dice spacing', () => {
    const { diceRollerStyles } = require('../styles/diceRollerStyles');
    
    // Margin should be positive to ensure spacing between dice
    expect(diceRollerStyles.dice.marginHorizontal).toBeGreaterThan(0);
  });

  it('should have diceRow with row flex direction and center alignment', () => {
    const { diceRollerStyles } = require('../styles/diceRollerStyles');
    
    expect(diceRollerStyles.diceRow.flexDirection).toBe('row');
    expect(diceRollerStyles.diceRow.justifyContent).toBe('center');
    expect(diceRollerStyles.diceRow.alignItems).toBe('center');
  });

  it('should have arena with full width for proper centering', () => {
    const { diceRollerStyles } = require('../styles/diceRollerStyles');
    
    expect(diceRollerStyles.arena.width).toBe('100%');
    expect(diceRollerStyles.arena.justifyContent).toBe('center');
    expect(diceRollerStyles.arena.alignItems).toBe('center');
  });

  it('should have dice dimensions that fit 2 dice on screen with spacing', () => {
    const { diceRollerStyles } = require('../styles/diceRollerStyles');
    const screen = Dimensions.get('window');
    
    const diceWidth = diceRollerStyles.dice.width;
    const diceMargin = diceRollerStyles.dice.marginHorizontal;
    
    // Calculate total width for 2 dice with margins
    // Each die has margin on both sides, so total = 2 * (width + 2 * margin)
    const totalWidthFor2Dice = 2 * diceWidth + 4 * diceMargin;
    
    // Should fit within screen width
    expect(totalWidthFor2Dice).toBeLessThan(screen.width);
  });

  it('should have equal width and height for square dice', () => {
    const { diceRollerStyles } = require('../styles/diceRollerStyles');
    
    expect(diceRollerStyles.dice.width).toBe(diceRollerStyles.dice.height);
  });
});;
