package com.mochilink.connector.fabric.utils;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Input validation utility for security and data integrity
 */
public class InputValidator {
    
    // Maximum lengths for various inputs
    private static final int MAX_PLAYER_NAME_LENGTH = 16;
    private static final int MAX_MESSAGE_LENGTH = 256;
    private static final int MAX_COMMAND_LENGTH = 512;
    private static final int MAX_REASON_LENGTH = 256;
    
    // Patterns for validation
    private static final Pattern PLAYER_NAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_]{1,16}$");
    private static final Pattern SAFE_STRING_PATTERN = Pattern.compile("^[a-zA-Z0-9_ \\-.,!?()\\[\\]]+$");
    
    /**
     * Validate and sanitize player ID (UUID)
     */
    public static ValidationResult<String> validatePlayerId(String playerId) {
        if (playerId == null || playerId.trim().isEmpty()) {
            return ValidationResult.error("Player ID cannot be empty");
        }
        
        try {
            UUID.fromString(playerId);
            return ValidationResult.success(playerId);
        } catch (IllegalArgumentException e) {
            return ValidationResult.error("Invalid UUID format: " + playerId);
        }
    }
    
    /**
     * Validate and sanitize player name
     */
    public static ValidationResult<String> validatePlayerName(String playerName) {
        if (playerName == null || playerName.trim().isEmpty()) {
            return ValidationResult.error("Player name cannot be empty");
        }
        
        if (playerName.length() > MAX_PLAYER_NAME_LENGTH) {
            return ValidationResult.error("Player name too long (max " + MAX_PLAYER_NAME_LENGTH + " characters)");
        }
        
        if (!PLAYER_NAME_PATTERN.matcher(playerName).matches()) {
            return ValidationResult.error("Player name contains invalid characters");
        }
        
        return ValidationResult.success(playerName);
    }
    
    /**
     * Validate and sanitize message text
     */
    public static ValidationResult<String> validateMessage(String message) {
        if (message == null) {
            return ValidationResult.success("");
        }
        
        // Remove color codes and formatting
        String sanitized = message.replaceAll("[§&][0-9a-fk-or]", "");
        
        // Limit length
        if (sanitized.length() > MAX_MESSAGE_LENGTH) {
            sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
        }
        
        return ValidationResult.success(sanitized);
    }
    
    /**
     * Validate and sanitize command
     */
    public static ValidationResult<String> validateCommand(String command) {
        if (command == null || command.trim().isEmpty()) {
            return ValidationResult.error("Command cannot be empty");
        }
        
        String trimmed = command.trim();
        
        // Remove leading slash if present
        if (trimmed.startsWith("/")) {
            trimmed = trimmed.substring(1);
        }
        
        // Limit length
        if (trimmed.length() > MAX_COMMAND_LENGTH) {
            return ValidationResult.error("Command too long (max " + MAX_COMMAND_LENGTH + " characters)");
        }
        
        // Check for dangerous commands (basic protection)
        String lowerCommand = trimmed.toLowerCase();
        if (lowerCommand.startsWith("stop") || 
            lowerCommand.startsWith("restart") ||
            lowerCommand.startsWith("reload")) {
            return ValidationResult.error("Dangerous command not allowed through this interface");
        }
        
        return ValidationResult.success(trimmed);
    }
    
    /**
     * Validate and sanitize reason text
     */
    public static ValidationResult<String> validateReason(String reason) {
        if (reason == null) {
            return ValidationResult.success("No reason provided");
        }
        
        // Remove color codes and formatting
        String sanitized = reason.replaceAll("[§&][0-9a-fk-or]", "");
        
        // Limit length
        if (sanitized.length() > MAX_REASON_LENGTH) {
            sanitized = sanitized.substring(0, MAX_REASON_LENGTH);
        }
        
        return ValidationResult.success(sanitized);
    }
    
    /**
     * Validate integer within range
     */
    public static ValidationResult<Integer> validateInteger(String value, int min, int max) {
        if (value == null || value.trim().isEmpty()) {
            return ValidationResult.error("Value cannot be empty");
        }
        
        try {
            int intValue = Integer.parseInt(value.trim());
            if (intValue < min || intValue > max) {
                return ValidationResult.error("Value must be between " + min + " and " + max);
            }
            return ValidationResult.success(intValue);
        } catch (NumberFormatException e) {
            return ValidationResult.error("Invalid integer: " + value);
        }
    }
    
    /**
     * Validation result wrapper
     */
    public static class ValidationResult<T> {
        private final boolean valid;
        private final T value;
        private final String error;
        
        private ValidationResult(boolean valid, T value, String error) {
            this.valid = valid;
            this.value = value;
            this.error = error;
        }
        
        public static <T> ValidationResult<T> success(T value) {
            return new ValidationResult<>(true, value, null);
        }
        
        public static <T> ValidationResult<T> error(String error) {
            return new ValidationResult<>(false, null, error);
        }
        
        public boolean isValid() {
            return valid;
        }
        
        public T getValue() {
            return value;
        }
        
        public String getError() {
            return error;
        }
    }
}
