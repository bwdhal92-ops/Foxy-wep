# Site Bot SDK for Java

هذا SDK خاص بموقع Voice Chat ولا يعتمد على Discord أو OAuth2. للاستخدام المجاني استخدم `FirebaseSiteBotClient`، ولا تحتاج إلى Cloud Functions.

لخطة Firebase المجانية:

```java
try (var bot = new FirebaseSiteBotClient(
    "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    "APP_ID",
    System.getenv("SITE_BOT_TOKEN"))) {
  bot.onCommand("ping", command -> new ObjectMapper().createObjectNode().put("reply", "Pong!"));
  bot.start();
  Thread.currentThread().join();
}
```

البوت يعمل على سيرفر المطور، ويرسل heartbeat كل 25 ثانية، ويفحص الأوامر كل 3 ثوانٍ.
