package site.voicechat.bot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

/** Client for bots hosted on the Voice Chat site. It has no Discord dependency. */
public final class SiteBotClient implements AutoCloseable {
  public record SiteCommand(String id, String name, String description, JsonNode data) {}
  public interface CommandHandler { JsonNode handle(SiteCommand command) throws Exception; }

  private final String apiBase;
  private final String appId;
  private final String token;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper json = new ObjectMapper();
  private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
  private final Map<String, CommandHandler> handlers = new ConcurrentHashMap<>();
  private volatile boolean running;
  private ScheduledFuture<?> heartbeatTask;
  private ScheduledFuture<?> commandTask;

  public SiteBotClient(String apiBase, String appId, String token) {
    this.apiBase = apiBase.replaceAll("/$", "");
    this.appId = appId;
    this.token = token;
  }

  public SiteBotClient onCommand(String name, CommandHandler handler) { handlers.put(name, handler); return this; }

  public void start() {
    if (running) return;
    running = true;
    heartbeatTask = scheduler.scheduleAtFixedRate(() -> postHeartbeat("online"), 0, 25, TimeUnit.SECONDS);
    commandTask = scheduler.scheduleAtFixedRate(this::pollCommands, 2, 3, TimeUnit.SECONDS);
  }

  private void postHeartbeat(String status) {
    try {
      ObjectNode body = json.createObjectNode().put("appId", appId).put("token", token).put("status", status);
      request("POST", "/bot/heartbeat", body.toString());
    } catch (Exception ignored) { }
  }

  private void pollCommands() {
    if (!running) return;
    try {
      JsonNode response = request("GET", "/bot/commands?appId=" + enc(appId) + "&token=" + enc(token), null);
      for (JsonNode item : response.path("queue")) {
        String name = item.path("name").asText("");
        CommandHandler handler = handlers.get(name);
        if (handler == null) continue;
        JsonNode result;
        try { result = handler.handle(new SiteCommand(item.path("id").asText(), name, item.path("description").asText(), item.path("data"))); }
        catch (Exception error) { result = json.createObjectNode().put("error", error.getMessage() == null ? "command failed" : error.getMessage()); }
        ObjectNode ack = json.createObjectNode().put("appId", appId).put("token", token).set("result", result);
        request("POST", "/bot/commands/" + enc(item.path("id").asText()) + "/ack", ack.toString());
      }
    } catch (Exception ignored) { }
  }

  private JsonNode request(String method, String path, String body) throws IOException, InterruptedException {
    HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(apiBase + path)).timeout(Duration.ofSeconds(15));
    if (body == null) builder.GET(); else builder.method(method, HttpRequest.BodyPublishers.ofString(body)).header("Content-Type", "application/json");
    HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 400) throw new IOException("Site Bot API returned " + response.statusCode());
    return json.readTree(response.body());
  }

  private static String enc(String value) { return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8); }

  @Override public void close() {
    running = false;
    if (heartbeatTask != null) heartbeatTask.cancel(true);
    if (commandTask != null) commandTask.cancel(true);
    postHeartbeat("offline");
    scheduler.shutdownNow();
  }
}
