using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace GamerUncle.Mcp.Services
{
    public interface ISseConnectionManager
    {
        Task HandleSseConnection(HttpContext context);
        Task QueueOrSend(object eventData);
    }

    public class SseConnectionManager : ISseConnectionManager, IDisposable
    {
        private readonly ConcurrentDictionary<string, SseConnection> _connections = new();
        private readonly ConcurrentQueue<QueuedItem> _pending = new();
        private readonly ILogger<SseConnectionManager> _logger;
        private readonly int _heartbeatIntervalSeconds;
        private readonly int _maxRequeueAttempts;
        private readonly Timer _heartbeatTimer;
        private volatile string? _latestConnectionId;

        public SseConnectionManager(ILogger<SseConnectionManager> logger, IConfiguration configuration)
        {
            _logger = logger;
            _heartbeatIntervalSeconds = configuration.GetValue<int>("Mcp:SseHeartbeatIntervalSeconds", 30);
            _maxRequeueAttempts = configuration.GetValue<int>("Mcp:SseMaxRequeueAttempts", 3);

            _heartbeatTimer = new Timer(
                SendHeartbeats,
                null,
                TimeSpan.FromSeconds(_heartbeatIntervalSeconds),
                TimeSpan.FromSeconds(_heartbeatIntervalSeconds));
        }

        public async Task HandleSseConnection(HttpContext context)
        {
            var connectionId = Guid.NewGuid().ToString();
            var response = context.Response;

            response.Headers["Content-Type"] = "text/event-stream";
            response.Headers["Cache-Control"] = "no-cache";
            response.Headers["Connection"] = "keep-alive";
            response.Headers["Access-Control-Allow-Origin"] = "*";
            response.Headers["Access-Control-Allow-Headers"] = "Cache-Control";

            var sseConnection = new SseConnection
            {
                ConnectionId = connectionId,
                HttpContext = context,
                ConnectedAt = DateTime.UtcNow
            };

            _connections[connectionId] = sseConnection;
            _latestConnectionId = connectionId;

            _logger.LogInformation("SSE connection established: {ConnectionId}", connectionId);

            try
            {
                await SendEvent(response, "connection", new {
                    connectionId,
                    status = "connected",
                    messageEndpoint = "/mcp/sse", // legacy POST endpoint used for messages
                    protocol = "jsonrpc2",
                    transport = "sse"
                });

                // Drain queued messages
                while (_pending.TryDequeue(out var queued))
                {
                    try
                    {
                        await SendEvent(response, "message", queued.Payload);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed sending queued message on connection {ConnectionId}; attempt={Attempt}", connectionId, queued.Attempts);
                        RequeueOrDrop(queued);
                        break; // exit drain loop; connection likely unhealthy
                    }
                }

                while (!context.RequestAborted.IsCancellationRequested)
                {
                    await Task.Delay(1000, context.RequestAborted);
                }
            }
            catch (OperationCanceledException)
            {
                // normal disconnect
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SSE connection {ConnectionId} error", connectionId);
            }
            finally
            {
                RemoveConnection(connectionId);
                _logger.LogInformation("SSE connection closed: {ConnectionId}", connectionId);
            }
        }

        public async Task QueueOrSend(object eventData)
        {
            var target = _latestConnectionId;
            if (target is null || !_connections.ContainsKey(target))
            {
                _pending.Enqueue(new QueuedItem(eventData, 0));
                _logger.LogDebug("Queued MCP response (no active SSE connection)");
                return;
            }
            if (_connections.TryGetValue(target, out var connection))
            {
                try
                {
                    await SendEvent(connection.HttpContext.Response, "message", eventData);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send event to connection {ConnectionId}; will requeue attempt 1", target);
                    RemoveConnection(target);
                    _pending.Enqueue(new QueuedItem(eventData, 1));
                }
            }
            else
            {
                _pending.Enqueue(new QueuedItem(eventData, 0));
            }
        }

        private void RemoveConnection(string connectionId) => _connections.TryRemove(connectionId, out _);

        private void RequeueOrDrop(QueuedItem item)
        {
            if (item.Attempts >= _maxRequeueAttempts)
            {
                _logger.LogWarning("Dropping SSE message after {Attempts} failed attempts", item.Attempts);
                return;
            }
            _pending.Enqueue(new QueuedItem(item.Payload, item.Attempts + 1));
        }

        private async Task SendEvent(HttpResponse response, string eventType, object data)
        {
            var json = JsonSerializer.Serialize(data,
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            var payload = $"event: {eventType}\ndata: {json}\n\n";
            var bytes = Encoding.UTF8.GetBytes(payload);
            await response.Body.WriteAsync(bytes);
            await response.Body.FlushAsync();
        }

        private async void SendHeartbeats(object? state)
        {
            if (_connections.IsEmpty) return;
            var bytes = Encoding.UTF8.GetBytes(":heartbeat\n\n");
            var dead = new List<string>();

            foreach (var c in _connections.Values)
            {
                try
                {
                    await c.HttpContext.Response.Body.WriteAsync(bytes);
                    await c.HttpContext.Response.Body.FlushAsync();
                }
                catch
                {
                    dead.Add(c.ConnectionId);
                }
            }

            foreach (var id in dead) RemoveConnection(id);
        }

        public void Dispose() => _heartbeatTimer.Dispose();
    }

    internal class SseConnection
    {
        public required string ConnectionId { get; set; }
        public required HttpContext HttpContext { get; set; }
        public DateTime ConnectedAt { get; set; }
    }

    internal readonly record struct QueuedItem(object Payload, int Attempts);
}