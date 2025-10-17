using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using Grpc.Net.Client;

namespace V2rayClient.Services;

/// <summary>
/// Client for querying v2ray statistics via gRPC API
/// </summary>
public class V2rayStatsClient : IDisposable
{
    private readonly GrpcChannel _channel;
    private readonly HttpClient _httpClient;
    private bool _disposed;

    public V2rayStatsClient(string apiAddress = "http://127.0.0.1:10085")
    {
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(apiAddress),
            Timeout = TimeSpan.FromSeconds(5)
        };

        _channel = GrpcChannel.ForAddress(apiAddress, new GrpcChannelOptions
        {
            HttpHandler = new SocketsHttpHandler
            {
                PooledConnectionIdleTimeout = Timeout.InfiniteTimeSpan,
                KeepAlivePingDelay = TimeSpan.FromSeconds(60),
                KeepAlivePingTimeout = TimeSpan.FromSeconds(30),
                EnableMultipleHttp2Connections = true
            }
        });
    }

    /// <summary>
    /// Query statistics for a specific pattern
    /// </summary>
    /// <param name="pattern">Pattern to match (e.g., "inbound>>>socks-in>>>traffic>>>uplink")</param>
    /// <param name="reset">Whether to reset the counter after querying</param>
    /// <returns>Statistics value in bytes</returns>
    public async Task<long> QueryStatsAsync(string pattern, bool reset = false)
    {
        try
        {
            // V2ray stats API uses gRPC with the following service:
            // service StatsService {
            //   rpc QueryStats(QueryStatsRequest) returns (QueryStatsResponse) {}
            //   rpc GetStats(GetStatsRequest) returns (GetStatsResponse) {}
            // }
            
            // Since we don't have the compiled protobuf, we'll use a workaround
            // by directly calling the v2ray command line to get stats
            // In production, you should use proper gRPC with protobuf definitions
            
            // For now, return 0 as placeholder
            // This will be replaced with actual gRPC call when protobuf is set up
            await Task.CompletedTask;
            return 0;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Error querying stats for pattern '{pattern}': {ex.Message}");
            return 0;
        }
    }

    /// <summary>
    /// Get all statistics
    /// </summary>
    /// <returns>Dictionary of stat names to values</returns>
    public async Task<Dictionary<string, long>> GetAllStatsAsync()
    {
        try
        {
            // This would use the GetStats RPC method
            // For now, return empty dictionary
            await Task.CompletedTask;
            return new Dictionary<string, long>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Error getting all stats: {ex.Message}");
            return new Dictionary<string, long>();
        }
    }

    /// <summary>
    /// Get traffic statistics for inbound connections
    /// </summary>
    public async Task<(long Uplink, long Downlink)> GetInboundTrafficAsync(string tag)
    {
        var uplink = await QueryStatsAsync($"inbound>>>{tag}>>>traffic>>>uplink");
        var downlink = await QueryStatsAsync($"inbound>>>{tag}>>>traffic>>>downlink");
        return (uplink, downlink);
    }

    /// <summary>
    /// Get traffic statistics for outbound connections
    /// </summary>
    public async Task<(long Uplink, long Downlink)> GetOutboundTrafficAsync(string tag)
    {
        var uplink = await QueryStatsAsync($"outbound>>>{tag}>>>traffic>>>uplink");
        var downlink = await QueryStatsAsync($"outbound>>>{tag}>>>traffic>>>downlink");
        return (uplink, downlink);
    }

    /// <summary>
    /// Get total traffic statistics across all inbounds and outbounds
    /// </summary>
    public async Task<(long Upload, long Download)> GetTotalTrafficAsync()
    {
        try
        {
            // Query stats for main inbounds
            var (socksUp, socksDown) = await GetInboundTrafficAsync("socks-in");
            var (httpUp, httpDown) = await GetInboundTrafficAsync("http-in");

            // Total is sum of all inbound traffic
            var totalUpload = socksUp + httpUp;
            var totalDownload = socksDown + httpDown;

            return (totalUpload, totalDownload);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Error getting total traffic: {ex.Message}");
            return (0, 0);
        }
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        _httpClient?.Dispose();
        _channel?.Dispose();
        
        _disposed = true;
        GC.SuppressFinalize(this);
    }
}
