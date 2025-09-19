# GitHub Copilot MCP Testing Guide - Gamer Uncle

This guide covers Phase 3 testing of the Gamer Uncle MCP (Model Context Protocol) server with GitHub Copilot using local endpoints.

## Prerequisites

1. **Gamer Uncle API running locally**
   - Ensure the API is running on `http://localhost:63602` (HTTP) or `https://localhost:63601` (HTTPS)
   - **Recommended**: Use HTTP endpoint to avoid SSL certificate issues with VS Code
   - Verify MCP endpoints are accessible

2. **GitHub Copilot enabled in VS Code**
   - GitHub Copilot extension installed and activated
   - Valid GitHub Copilot subscription

3. **MCP configuration in place**
   - `.vscode/mcp.json` file configured (already done)

## Step-by-Step Testing Process

### Step 1: Configure GitHub Copilot MCP Integration

#### Method 1: Using VS Code Command Palette
1. Open VS Code Command Palette (`Ctrl+Shift+P`)
2. Type `MCP: Add Server`
3. Choose `HTTP` transport
4. Enter URL: `https://localhost:63601/mcp/sse`
5. Name the server: `gamer-uncle-local`

#### Method 2: Using existing configuration
The `.vscode/mcp.json` file is already configured:
```json
{
  "servers": {
    "gamer-uncle-local": {
      "type": "sse",
      "url": "http://localhost:63602/mcp/sse"
    }
  }
}
```

### Step 2: Verify GitHub Copilot Integration

1. **Check Tool Discovery**
   - Click on the tool icon in GitHub Copilot chat
   - Look for `gamer-uncle-local` server in the list
   - Ensure `board_game_query` tool is enabled

2. **Grant Consent (First Time)**
   - When using the MCP tool for the first time
   - You'll be prompted to grant consent
   - Accept the consent dialog

### Step 3: Test Board Game Queries with GitHub Copilot

Try these test queries in GitHub Copilot chat:

#### Basic Queries
1. **Simple Recommendation**
   ```
   #board_game_query Find me cooperative board games for 3 players
   ```

2. **Specific Game Rules**
   ```
   Explain the rules of Settlers of Catan
   ```

3. **Strategy Advice**
   ```
   #board_game_query What are some good strategies for playing Splendor?
   ```

4. **Game Discovery**
   ```
   Recommend board games similar to Ticket to Ride
   ```

#### Advanced Queries
5. **Complex Recommendations**
   ```
   I need a board game for 4-6 players that takes about 60-90 minutes and isn't too complex
   ```

6. **Theme-Based Queries**
   ```
   What are some good sci-fi themed board games?
   ```

7. **Follow-up Questions**
   - After getting recommendations, ask follow-up questions:
   ```
   Tell me more about the first game you recommended
   ```

### Step 4: Verify Conversation Context

Test that conversation context is maintained:

1. Ask for game recommendations
2. Follow up with: "Tell me more about the second game"
3. Then ask: "What about for 2 players instead?"

The MCP server should maintain context across these queries.

## Expected Behavior

### ✅ Success Indicators
- GitHub Copilot uses the `board_game_query` tool automatically
- Responses include relevant board game information
- Conversation context is maintained across queries
- Tool calls complete within reasonable time (< 30 seconds)
- Responses are substantial and helpful (not generic fallbacks)

### ⚠️ Troubleshooting

**If GitHub Copilot doesn't use the MCP tool:**
1. Check that the server is running (`https://localhost:63601`)
2. Verify MCP configuration in VS Code settings
3. Restart VS Code to reload MCP configuration
4. Check VS Code output panel for MCP errors

**If tool calls fail:**
1. Run the test script to verify endpoint health
2. Check API logs for errors
3. Verify network connectivity to localhost
4. **SSL Certificate Issues**: If using HTTPS, ensure certificate is trusted, or switch to HTTP configuration
5. **Server Configuration**: Ensure `DisableHttpsRedirection` is set to `true` in `appsettings.Development.json` for HTTP connections

**If you see JSON-RPC ID parsing errors:**
- This has been fixed in the latest code
- Restart the API server to apply the fix
- The issue was that JSON-RPC allows IDs to be strings or numbers

**If responses are generic:**
- This indicates the agent service fallback is being used
- Check that the MCP tool is being called (look for MCP logs)
- Verify the agent service is properly configured

## Success Criteria for Phase 3

- [ ] SSE connection establishes successfully
- [ ] GitHub Copilot connects and queries games successfully
- [ ] Messages endpoint processes JSON-RPC requests
- [ ] `board_game_query` tool is discoverable and callable
- [ ] Conversation context persists across queries
- [ ] Responses are meaningful and game-related
- [ ] Tool calls complete within acceptable timeframes
- [ ] No memory leaks or connection issues during extended use

## Test Results Documentation

When testing, document:

1. **Connection Status**: Can GitHub Copilot connect to the MCP server?
2. **Tool Discovery**: Is the `board_game_query` tool visible and enabled?
3. **Query Success**: Do board game queries return relevant results?
4. **Response Quality**: Are responses substantial and helpful?
5. **Context Persistence**: Does conversation context work across multiple queries?
6. **Performance**: How long do tool calls take to complete?
7. **Error Handling**: How does the system handle invalid queries or failures?

## Next Steps After Successful Testing

Once local testing is successful:

1. **Document successful test cases**
2. **Note any issues or limitations found**
3. **Prepare for deployment to development environment**
4. **Consider implementing Phase 4 (Rate Limiting) if needed**
5. **Plan for production deployment testing**

---

**Note**: This testing focuses specifically on GitHub Copilot integration as specified in Phase 3. Other MCP clients (Claude Desktop, MCP Inspector) are not covered in this phase.