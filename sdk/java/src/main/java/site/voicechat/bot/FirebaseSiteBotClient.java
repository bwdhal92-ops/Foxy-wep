package site.voicechat.bot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.*;

/** Firebase-only client for the free plan. No Discord and no Cloud Functions. */
public final class FirebaseSiteBotClient implements AutoCloseable {
  private final String databaseUrl, appId, token, tokenHash;
  private final HttpClient http = HttpClient.newHttpClient();
  private final ObjectMapper json = new ObjectMapper();
  private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
  private final Map<String, SiteBotClient.CommandHandler> handlers = new ConcurrentHashMap<>();
  private ScheduledFuture<?> heartbeat;
  private ScheduledFuture<?> polling;
  private volatile boolean running;

  public FirebaseSiteBotClient(String databaseUrl, String appId, String token) {
    this.databaseUrl = databaseUrl.replaceAll("/$", "");
    this.appId = appId;
    this.token = token;
    this.tokenHash = sha256(token);
  }

  public FirebaseSiteBotClient onCommand(String name, SiteBotClient.CommandHandler handler) { handlers.put(name, handler); return this; }

  public void start() {
    if (running) return;
    running = true;
    heartbeat = scheduler.scheduleAtFixedRate(() -> put("status", object("status", "online")), 0, 25, TimeUnit.SECONDS);
    polling = scheduler.scheduleAtFixedRate(this::pollCommands, 2, 4, TimeUnit.SECONDS);
  }

  private void pollCommands() {
    try {
      JsonNode node = get("commands");
      if (node == null || !node.isArray()) return;
      for (JsonNode command : node) {
        String name = command.path("name").asText("");
        var handler = handlers.get(name);
        if (handler == null) continue;
        JsonNode result = handler.handle(new SiteBotClient.SiteCommand(command.path("id").asText(""), name, command.path("description").asText(""), command));
        put("results/" + command.path("id").asText(), object("result", result));
      }
    } catch (Exception ignored) { }
  }

  private ObjectNode object(String key, String value) { return json.createObjectNode().put(key, value).put("tokenHash", tokenHash); }
  private ObjectNode object(String key, JsonNode value) { return json.createObjectNode().set(key, value).put("tokenHash", tokenHash); }
  private JsonNode get(String path) throws IOException, InterruptedException { return request("GET", path, null); }
  private void put(String path, JsonNode body) { try { request("PUT", path, body.toString()); } catch (Exception ignored) { } }
  private JsonNode request(String method, String path, String body) throws IOException, InterruptedException {
    HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(databaseUrl + "/siteBots/" + appId + "/" + path + ".json"))
      .timeout(Duration.ofSeconds(10));
    if (body == null) request.GET(); else request.method(method, HttpRequest.BodyPublishers.ofString(body)).header("Content-Type", "application/json");
    HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 400) throw new IOException("Firebase returned " + response.statusCode());
    return response.body().equals("null") ? null : json.readTree(response.body());
  }
  private static String sha256(String value) {
    try { var digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); var out = new StringBuilder(); for (byte b : digest) out.append(String.format("%02x", b)); return out.toString(); }
    catch (Exception error) { throw new IllegalStateException(error); }
  }
  @Override public void close() { running = false; if (heartbeat != null) heartbeat.cancel(true); if (polling != null) polling.cancel(true); put("status", object("status", "offline")); scheduler.shutdownNow(); }
}
