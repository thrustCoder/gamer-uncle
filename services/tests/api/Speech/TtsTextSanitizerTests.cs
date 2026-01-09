using Xunit;
using GamerUncle.Api.Services.Speech;

namespace GamerUncle.Api.Tests.Speech;

/// <summary>
/// Unit tests for TtsTextSanitizer to ensure emojis and markdown
/// are properly stripped before text-to-speech processing.
/// </summary>
public class TtsTextSanitizerTests
{
    #region Emoji Stripping Tests

    [Fact]
    public void StripEmojis_WithNoEmojis_ReturnsOriginalText()
    {
        // Arrange
        var text = "This is a regular sentence without emojis.";

        // Act
        var result = TtsTextSanitizer.StripEmojis(text);

        // Assert
        Assert.Equal(text, result);
    }

    [Fact]
    public void StripEmojis_WithSingleEmoji_RemovesEmoji()
    {
        // Arrange
        var text = "Great game! 🎲";

        // Act
        var result = TtsTextSanitizer.StripEmojis(text);

        // Assert
        Assert.Equal("Great game!", result);
    }

    [Fact]
    public void StripEmojis_WithMultipleEmojis_RemovesAllEmojis()
    {
        // Arrange
        var text = "🎮 Board games are fun! 🎲🃏 Let's play! 🎯";

        // Act
        var result = TtsTextSanitizer.StripEmojis(text);

        // Assert
        Assert.Equal("Board games are fun!  Let's play!", result);
    }

    [Fact]
    public void StripEmojis_WithEmojisInMiddle_RemovesAndPreservesText()
    {
        // Arrange
        var text = "I recommend 🌟 Catan 🌟 for beginners.";

        // Act
        var result = TtsTextSanitizer.StripEmojis(text);

        // Assert
        Assert.Equal("I recommend  Catan  for beginners.", result);
    }

    [Fact]
    public void StripEmojis_WithCommonGameEmojis_RemovesAll()
    {
        // Arrange - emojis commonly used in board game context
        var text = "🎲 Dice games ♠️ Card games ♟️ Strategy games 🏆 Winners";

        // Act
        var result = TtsTextSanitizer.StripEmojis(text);

        // Assert
        Assert.DoesNotContain("🎲", result);
        Assert.DoesNotContain("♠️", result);
        Assert.DoesNotContain("♟️", result);
        Assert.DoesNotContain("🏆", result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void StripEmojis_WithNullOrEmpty_ReturnsSameValue(string? input)
    {
        // Act
        var result = TtsTextSanitizer.StripEmojis(input!);

        // Assert
        Assert.Equal(input, result);
    }

    #endregion

    #region Markdown Stripping Tests

    [Fact]
    public void StripMarkdown_WithHeaders_RemovesHashSymbols()
    {
        // Arrange
        var text = "# Game Recommendations\n\nHere are some games.";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.Equal("Game Recommendations\n\nHere are some games.", result);
    }

    [Fact]
    public void StripMarkdown_WithMultipleLevelHeaders_RemovesAll()
    {
        // Arrange
        var text = "# Main Title\n## Subtitle\n### Section\nContent here.";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.DoesNotContain("#", result);
        Assert.Contains("Main Title", result);
        Assert.Contains("Subtitle", result);
        Assert.Contains("Section", result);
    }

    [Fact]
    public void StripMarkdown_WithBoldText_RemovesAsterisks()
    {
        // Arrange
        var text = "This is **bold** text and also **important**.";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.Equal("This is bold text and also important.", result);
    }

    [Fact]
    public void StripMarkdown_WithItalicText_RemovesAsterisks()
    {
        // Arrange
        var text = "This is *italic* text.";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.Equal("This is italic text.", result);
    }

    [Fact]
    public void StripMarkdown_WithBulletPoints_RemovesBullets()
    {
        // Arrange
        var text = "Games to try:\n- Catan\n- Ticket to Ride\n- Pandemic";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.DoesNotContain("- ", result);
        Assert.Contains("Catan", result);
        Assert.Contains("Ticket to Ride", result);
        Assert.Contains("Pandemic", result);
    }

    [Fact]
    public void StripMarkdown_WithNumberedList_RemovesNumbers()
    {
        // Arrange
        var text = "Top games:\n1. Catan\n2. Wingspan\n3. Azul";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.DoesNotMatch(@"^\d+\.\s", result);
        Assert.Contains("Catan", result);
        Assert.Contains("Wingspan", result);
        Assert.Contains("Azul", result);
    }

    [Fact]
    public void StripMarkdown_WithInlineCode_RemovesBackticks()
    {
        // Arrange
        var text = "The game `Catan` is great for `3-4 players`.";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.DoesNotContain("`", result);
        Assert.Contains("Catan", result);
        Assert.Contains("3-4 players", result);
    }

    [Fact]
    public void StripMarkdown_WithCodeBlock_RemovesEntireBlock()
    {
        // Arrange
        var text = "Here's an example:\n```\nsome code\nmore code\n```\nEnd of example.";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.DoesNotContain("```", result);
        Assert.DoesNotContain("some code", result);
        Assert.Contains("Here's an example:", result);
        Assert.Contains("End of example.", result);
    }

    [Fact]
    public void StripMarkdown_WithLinks_KeepsTextRemovesUrl()
    {
        // Arrange
        var text = "Check out [BoardGameGeek](https://boardgamegeek.com) for more.";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.DoesNotContain("https://", result);
        Assert.DoesNotContain("[", result);
        Assert.DoesNotContain("]", result);
        Assert.Contains("BoardGameGeek", result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void StripMarkdown_WithNullOrEmpty_ReturnsSameValue(string? input)
    {
        // Act
        var result = TtsTextSanitizer.StripMarkdown(input!);

        // Assert
        Assert.Equal(input, result);
    }

    #endregion

    #region Combined Sanitization Tests

    [Fact]
    public void SanitizeForTts_WithEmojisAndMarkdown_RemovesBoth()
    {
        // Arrange
        var text = "# 🎲 Game Recommendations\n\n**Great choices:**\n- 🌟 Catan\n- 🎯 Ticket to Ride";

        // Act
        var result = TtsTextSanitizer.SanitizeForTts(text);

        // Assert
        Assert.DoesNotContain("#", result);
        Assert.DoesNotContain("**", result);
        Assert.DoesNotContain("-", result);
        Assert.DoesNotContain("🎲", result);
        Assert.DoesNotContain("🌟", result);
        Assert.DoesNotContain("🎯", result);
        Assert.Contains("Game Recommendations", result);
        Assert.Contains("Great choices", result);
        Assert.Contains("Catan", result);
        Assert.Contains("Ticket to Ride", result);
    }

    [Fact]
    public void SanitizeForTts_WithRealWorldResponse_ProducesCleanText()
    {
        // Arrange - realistic AI response with emojis and formatting
        var text = @"# 🎮 Perfect Game for You!

**I recommend Catan!** 🌟

Here's why it's great:
- 🎲 **Easy to learn** - Simple rules for beginners
- 👥 **Social gameplay** - Great for 3-4 players  
- ⏱️ **Quick games** - About 60-90 minutes

Check out [Catan on BGG](https://boardgamegeek.com/boardgame/13/catan) for more details!

Have fun playing! 🎉";

        // Act
        var result = TtsTextSanitizer.SanitizeForTts(text);

        // Assert - should be readable plain text
        Assert.DoesNotContain("🎮", result);
        Assert.DoesNotContain("🌟", result);
        Assert.DoesNotContain("🎲", result);
        Assert.DoesNotContain("👥", result);
        Assert.DoesNotContain("⏱️", result);
        Assert.DoesNotContain("🎉", result);
        Assert.DoesNotContain("#", result);
        Assert.DoesNotContain("**", result);
        Assert.DoesNotContain("[Catan on BGG]", result);
        Assert.DoesNotContain("https://", result);
        
        // Content should be preserved
        Assert.Contains("Perfect Game for You", result);
        Assert.Contains("I recommend Catan", result);
        Assert.Contains("Easy to learn", result);
        Assert.Contains("Social gameplay", result);
        Assert.Contains("Have fun playing", result);
    }

    [Fact]
    public void SanitizeForTts_WithPlainText_ReturnsUnchanged()
    {
        // Arrange
        var text = "Catan is a great game for 3 to 4 players. It takes about 60 minutes to play.";

        // Act
        var result = TtsTextSanitizer.SanitizeForTts(text);

        // Assert
        Assert.Equal(text, result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void SanitizeForTts_WithNullOrEmpty_ReturnsSameValue(string? input)
    {
        // Act
        var result = TtsTextSanitizer.SanitizeForTts(input!);

        // Assert
        Assert.Equal(input, result);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void StripEmojis_WithVariationSelectors_RemovesCompletely()
    {
        // Arrange - some emojis use variation selectors (FE0F)
        var text = "Playing cards: ♠️♣️♥️♦️";

        // Act
        var result = TtsTextSanitizer.StripEmojis(text);

        // Assert
        Assert.Equal("Playing cards:", result);
    }

    [Fact]
    public void StripMarkdown_WithNestedFormatting_HandlesGracefully()
    {
        // Arrange
        var text = "This is ***bold and italic*** text.";

        // Act
        var result = TtsTextSanitizer.StripMarkdown(text);

        // Assert
        Assert.DoesNotContain("*", result);
        Assert.Contains("bold and italic", result);
    }

    [Fact]
    public void SanitizeForTts_PreservesNaturalPunctuation()
    {
        // Arrange
        var text = "Great question! Here are my thoughts: first, consider the player count. Second, think about complexity.";

        // Act
        var result = TtsTextSanitizer.SanitizeForTts(text);

        // Assert
        Assert.Equal(text, result);
    }

    [Fact]
    public void SanitizeForTts_HandlesUnicodeTextProperly()
    {
        // Arrange - non-emoji unicode characters should be preserved
        var text = "Résumé of games: Café Games™ — great options!";

        // Act
        var result = TtsTextSanitizer.SanitizeForTts(text);

        // Assert
        Assert.Equal(text, result);
    }

    #endregion
}
