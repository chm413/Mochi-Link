package com.mochilink.connector.protocol;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.config.PluginConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UWBPv2ProtocolTest {
    private UWBPv2Protocol protocol;

    @BeforeEach
    void setUp() {
        MochiLinkPlugin plugin = mock(MochiLinkPlugin.class);
        PluginConfig config = mock(PluginConfig.class);
        when(plugin.getLogger()).thenReturn(Logger.getLogger("UWBPv2ProtocolTest"));
        when(plugin.getPluginConfig()).thenReturn(config);
        when(config.getServerId()).thenReturn("java-test");
        protocol = new UWBPv2Protocol(plugin);
    }

    @Test
    void createsCanonicalCorrelatedResponse() {
        JsonObject data = new JsonObject();
        data.addProperty("status", "online");
        data.addProperty("online", true);

        JsonObject response = JsonParser.parseString(
            protocol.createResponseMessage("request-1", "server.getStatus", data, true, null)
        ).getAsJsonObject();

        assertEquals("response", response.get("type").getAsString());
        assertEquals("request-1", response.get("requestId").getAsString());
        assertNotEquals("request-1", response.get("id").getAsString());
        assertEquals("2.0", response.get("version").getAsString());
        assertTrue(response.get("timestamp").getAsJsonPrimitive().isNumber());
        assertTrue(response.get("success").getAsBoolean());
        assertTrue(response.getAsJsonObject("data").get("online").getAsBoolean());
    }

    @Test
    void createsChallengeHandshakeWithExpectedHmac() throws Exception {
        String token = "java-secret";
        String challenge = "nonce-123";
        long timestamp = 1_725_000_000_123L;

        JsonObject message = JsonParser.parseString(protocol.createChallengeAuthenticationMessage(
            token, "java-test", challenge, timestamp, "challenge-request"
        )).getAsJsonObject();
        JsonObject data = message.getAsJsonObject("data");

        assertEquals("system", message.get("type").getAsString());
        assertEquals("handshake", message.get("systemOp").getAsString());
        assertEquals("challenge-request", message.get("requestId").getAsString());
        assertEquals("challenge", data.getAsJsonObject("authentication").get("method").getAsString());
        assertEquals(challenge, data.get("challenge").getAsString());
        assertEquals(timestamp, data.get("challengeTimestamp").getAsLong());
        assertEquals(hmac(token, challenge + ":" + token + ":" + timestamp),
            data.get("challengeResponse").getAsString());
        assertArrayEquals(new String[] {
            "player_management", "command_execution", "performance_monitoring",
            "event_streaming", "whitelist_management", "server_control"
        }, protocol.getDeclaredCapabilities());
    }

    @Test
    void parsesLegacyIsoTimestampWithoutChangingTheEnvelope() {
        UWBPv2Protocol.ProtocolMessage message = protocol.parseMessage(
            "{\"type\":\"request\",\"id\":\"legacy-1\",\"op\":\"player.list\"," +
                "\"data\":{},\"timestamp\":\"2026-08-30T00:00:00Z\"}"
        );

        assertNotNull(message);
        assertEquals("legacy-1", message.getId());
        assertEquals(Instant.parse("2026-08-30T00:00:00Z").toEpochMilli(), message.getTimestamp());
    }

    private static String hmac(String key, String value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        StringBuilder result = new StringBuilder();
        for (byte item : mac.doFinal(value.getBytes(StandardCharsets.UTF_8))) {
            result.append(String.format("%02x", item & 0xff));
        }
        return result.toString();
    }
}
