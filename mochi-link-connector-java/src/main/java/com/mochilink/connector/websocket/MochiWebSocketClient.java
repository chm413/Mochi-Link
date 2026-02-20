package com.mochilink.connector.websocket;

import com.mochilink.connector.connection.ConnectionManager;
import com.mochilink.connector.protocol.MessageHandler;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.util.concurrent.TimeUnit;

/**
 * WebSocket client implementation for connecting to Mochi-Link management server
 * 
 * Extends Java-WebSocket library client with custom connection handling
 * and message processing for the U-WBP v2 protocol.
 */
public class MochiWebSocketClient extends org.java_websocket.client.WebSocketClient {
    
    private final ConnectionManager connectionManager;
    private final MessageHandler messageHandler;
    
    private long connectionStartTime;
    private long lastMessageTime;
    
    public MochiWebSocketClient(URI serverUri, ConnectionManager connectionManager, MessageHandler messageHandler) {
        super(serverUri);
        this.connectionManager = connectionManager;
        this.messageHandler = messageHandler;
        
        // Set connection timeout
        setConnectionLostTimeout(30);
    }
    
    @Override
    public void onOpen(ServerHandshake handshake) {
        connectionStartTime = System.currentTimeMillis();
        lastMessageTime = connectionStartTime;
        
        connectionManager.onConnectionOpened();
    }
    
    @Override
    public void onMessage(String message) {
        lastMessageTime = System.currentTimeMillis();
        connectionManager.onMessageReceived(message);
    }
    
    @Override
    public void onClose(int code, String reason, boolean remote) {
        connectionManager.onConnectionClosed(code, reason, remote);
    }
    
    @Override
    public void onError(Exception ex) {
        connectionManager.onConnectionError(ex);
    }
    
    /**
     * Connect with blocking and timeout
     */
    public boolean connectBlocking() throws InterruptedException {
        return connectBlocking(10, TimeUnit.SECONDS);
    }
    
    /**
     * Get connection uptime in milliseconds
     */
    public long getConnectionTime() {
        if (connectionStartTime == 0) {
            return 0;
        }
        return System.currentTimeMillis() - connectionStartTime;
    }
    
    /**
     * Get time since last message in milliseconds
     */
    public long getTimeSinceLastMessage() {
        if (lastMessageTime == 0) {
            return 0;
        }
        return System.currentTimeMillis() - lastMessageTime;
    }
    
    /**
     * Check if connection is healthy (recent message activity)
     */
    public boolean isConnectionHealthy(long maxIdleTime) {
        return getTimeSinceLastMessage() < maxIdleTime;
    }
}