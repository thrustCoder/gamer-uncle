import React from 'react';
import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Colors } from '../styles/colors';

/**
 * MarkdownText component for rendering markdown-formatted text in chat messages.
 * 
 * Supports common markdown elements:
 * - **bold** text
 * - *italic* text
 * - Bullet lists (- item)
 * - Numbered lists (1. item)
 * - Headers (# ## ###)
 * - Links [text](url)
 * - Inline code `code`
 * 
 * Emojis are passed through unchanged (rendered natively by the device).
 */

interface MarkdownTextProps {
  /** The markdown text to render */
  text: string;
  /** Base text style (optional) */
  style?: TextStyle;
  /** Whether this is a user message (affects styling) */
  isUserMessage?: boolean;
}

export default function MarkdownText({ text, style, isUserMessage = false }: MarkdownTextProps) {
  // Use theme yellow to match bubble text color
  const textColor = Colors.themeYellow;
  
  // Custom styles for markdown elements
  const markdownStyles = StyleSheet.create({
    body: {
      color: textColor,
      fontSize: 18,
      lineHeight: 24,
      paddingBottom: 2, // Prevent text clipping at bottom
      ...(style as ViewStyle),
    },
    textgroup: {
      marginTop: 0,
      marginBottom: 0,
    },
    strong: {
      fontWeight: 'bold' as const,
      color: textColor,
    },
    em: {
      fontStyle: 'italic' as const,
      color: textColor,
    },
    bullet_list: {
      marginLeft: 8,
      marginVertical: 4,
    },
    ordered_list: {
      marginLeft: 8,
      marginVertical: 4,
    },
    list_item: {
      marginVertical: 2,
    },
    bullet_list_icon: {
      marginRight: 4,
      color: textColor,
    },
    heading1: {
      fontSize: 20,
      fontWeight: 'bold' as const,
      marginVertical: 6,
      color: textColor,
    },
    heading2: {
      fontSize: 18,
      fontWeight: 'bold' as const,
      marginVertical: 5,
      color: textColor,
    },
    heading3: {
      fontSize: 17,
      fontWeight: 'bold' as const,
      marginVertical: 4,
      color: textColor,
    },
    code_inline: {
      backgroundColor: 'rgba(0,0,0,0.1)',
      borderRadius: 3,
      paddingHorizontal: 4,
      fontFamily: 'monospace',
    },
    link: {
      color: Colors.themeGreen,
      textDecorationLine: 'underline' as const,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 0,
    },
    text: {
      color: textColor,
    },
  });

  return (
    <Markdown style={markdownStyles}>
      {text}
    </Markdown>
  );
}
