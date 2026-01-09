import React from 'react';
import { render } from '@testing-library/react-native';
import MarkdownText from '../components/MarkdownText';

describe('MarkdownText', () => {
  describe('rendering', () => {
    it('renders plain text correctly', () => {
      const { getByText } = render(<MarkdownText text="Hello World" />);
      expect(getByText('Hello World')).toBeTruthy();
    });

    it('renders text with emojis', () => {
      const { getByText } = render(<MarkdownText text="Hello 🎮 World 🎲" />);
      expect(getByText('Hello 🎮 World 🎲')).toBeTruthy();
    });

    it('renders without crashing when text is empty', () => {
      const { toJSON } = render(<MarkdownText text="" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders bold text', () => {
      const { toJSON } = render(<MarkdownText text="This is **bold** text" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
      // The markdown library parses **bold** into styled text
    });

    it('renders italic text', () => {
      const { toJSON } = render(<MarkdownText text="This is *italic* text" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('renders bullet lists', () => {
      const text = '- Item 1\n- Item 2\n- Item 3';
      const { toJSON } = render(<MarkdownText text={text} />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('renders numbered lists', () => {
      const text = '1. First\n2. Second\n3. Third';
      const { toJSON } = render(<MarkdownText text={text} />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('renders headers', () => {
      const text = '# Heading 1\n## Heading 2\n### Heading 3';
      const { toJSON } = render(<MarkdownText text={text} />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('renders inline code', () => {
      const { toJSON } = render(<MarkdownText text="Use `code` here" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });

    it('renders links', () => {
      const { toJSON } = render(<MarkdownText text="Click [here](https://example.com)" />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });
  });

  describe('isUserMessage prop', () => {
    it('renders with isUserMessage=true', () => {
      const { toJSON } = render(<MarkdownText text="User message" isUserMessage={true} />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with isUserMessage=false', () => {
      const { toJSON } = render(<MarkdownText text="System message" isUserMessage={false} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('style prop', () => {
    it('accepts custom style prop', () => {
      const customStyle = { fontSize: 20 };
      const { toJSON } = render(<MarkdownText text="Styled text" style={customStyle} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('complex markdown scenarios', () => {
    it('renders mixed formatting with emojis', () => {
      const text = 'Winning **Camel Up** is all about coins! 🏆\n- Bet correctly on which camel will finish first\n- Make smart bets during each leg\n\n💡 Pro tip: Track which camels are likely to be carried forward';
      const { toJSON } = render(<MarkdownText text={text} />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders game recommendation format', () => {
      const text = '**Great choice!** 🎲\n\nHere are my top picks:\n1. **Ticket to Ride** - Easy to learn\n2. **Catan** - Classic strategy\n3. **Azul** - Beautiful patterns\n\n*Enjoy your game night!*';
      const { toJSON } = render(<MarkdownText text={text} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles paragraphs correctly', () => {
      const text = 'First paragraph.\n\nSecond paragraph with **bold**.\n\nThird paragraph with 🎮 emoji.';
      const { toJSON } = render(<MarkdownText text={text} />);
      expect(toJSON()).toBeTruthy();
    });
  });
});
