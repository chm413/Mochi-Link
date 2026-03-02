#!/bin/bash
# Create Forge and Minecraft stub JAR files for CI compilation

set -e

echo "=== Creating Forge/Minecraft Stub Dependencies ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIBS_DIR="$SCRIPT_DIR/libs"
STUB_SRC="$SCRIPT_DIR/stub-src"

# Clean old files
rm -rf "$STUB_SRC" "$LIBS_DIR"
mkdir -p "$STUB_SRC" "$LIBS_DIR"

echo "1. Generating stub source code..."

# Minecraft core classes
mkdir -p "$STUB_SRC/net/minecraft/server"
cat > "$STUB_SRC/net/minecraft/server/MinecraftServer.java" << 'EOF'
package net.minecraft.server;
public class MinecraftServer {
    public net.minecraft.server.players.PlayerList getPlayerList() { return null; }
    public java.util.Collection<net.minecraft.server.level.ServerLevel> getAllLevels() { return null; }
}
EOF

mkdir -p "$STUB_SRC/net/minecraft/server/players"
cat > "$STUB_SRC/net/minecraft/server/players/PlayerList.java" << 'EOF'
package net.minecraft.server.players;
public class PlayerList {
    public java.util.List<net.minecraft.server.level.ServerPlayer> getPlayers() { return null; }
    public net.minecraft.server.level.ServerPlayer getPlayer(java.util.UUID uuid) { return null; }
}
EOF

mkdir -p "$STUB_SRC/net/minecraft/server/level"
cat > "$STUB_SRC/net/minecraft/server/level/ServerPlayer.java" << 'EOF'
package net.minecraft.server.level;
public class ServerPlayer {
    public java.util.UUID getUUID() { return null; }
    public String getName() { return null; }
    public net.minecraft.server.network.ServerGamePacketListenerImpl connection;
    public void sendSystemMessage(net.minecraft.network.chat.Component component) {}
}
EOF

cat > "$STUB_SRC/net/minecraft/server/level/ServerLevel.java" << 'EOF'
package net.minecraft.server.level;
public class ServerLevel {}
EOF

mkdir -p "$STUB_SRC/net/minecraft/server/network"
cat > "$STUB_SRC/net/minecraft/server/network/ServerGamePacketListenerImpl.java" << 'EOF'
package net.minecraft.server.network;
public class ServerGamePacketListenerImpl {
    public void disconnect(net.minecraft.network.chat.Component component) {}
}
EOF

mkdir -p "$STUB_SRC/net/minecraft/network/chat"
cat > "$STUB_SRC/net/minecraft/network/chat/Component.java" << 'EOF'
package net.minecraft.network.chat;
public interface Component {
    static Component literal(String text) { return null; }
    Component withStyle(net.minecraft.ChatFormatting formatting);
}
EOF

mkdir -p "$STUB_SRC/net/minecraft"
cat > "$STUB_SRC/net/minecraft/ChatFormatting.java" << 'EOF'
package net.minecraft;
public enum ChatFormatting { RED, GREEN, YELLOW }
EOF

mkdir -p "$STUB_SRC/net/minecraft/commands"
cat > "$STUB_SRC/net/minecraft/commands/CommandSourceStack.java" << 'EOF'
package net.minecraft.commands;
public class CommandSourceStack {
    public void sendSuccess(java.util.function.Supplier<net.minecraft.network.chat.Component> s, boolean b) {}
    public void sendFailure(net.minecraft.network.chat.Component c) {}
}
EOF

cat > "$STUB_SRC/net/minecraft/commands/Commands.java" << 'EOF'
package net.minecraft.commands;
public class Commands {
    public static com.mojang.brigadier.builder.LiteralArgumentBuilder<CommandSourceStack> literal(String n) { return null; }
}
EOF

mkdir -p "$STUB_SRC/net/minecraft/world/entity"
cat > "$STUB_SRC/net/minecraft/world/entity/Entity.java" << 'EOF'
package net.minecraft.world.entity;
public class Entity {}
EOF

# Forge event classes
mkdir -p "$STUB_SRC/net/minecraftforge/event/entity/player"
cat > "$STUB_SRC/net/minecraftforge/event/entity/player/PlayerEvent.java" << 'EOF'
package net.minecraftforge.event.entity.player;
public class PlayerEvent {
    public static class PlayerLoggedInEvent extends PlayerEvent {
        public net.minecraft.world.entity.Entity getEntity() { return null; }
    }
    public static class PlayerLoggedOutEvent extends PlayerEvent {
        public net.minecraft.world.entity.Entity getEntity() { return null; }
    }
}
EOF

mkdir -p "$STUB_SRC/net/minecraftforge/event"
cat > "$STUB_SRC/net/minecraftforge/event/ServerChatEvent.java" << 'EOF'
package net.minecraftforge.event;
public class ServerChatEvent {
    public net.minecraft.server.level.ServerPlayer getPlayer() { return null; }
    public String getMessage() { return null; }
}
EOF

mkdir -p "$STUB_SRC/net/minecraftforge/event/server"
cat > "$STUB_SRC/net/minecraftforge/event/server/ServerStartedEvent.java" << 'EOF'
package net.minecraftforge.event.server;
public class ServerStartedEvent {
    public net.minecraft.server.MinecraftServer getServer() { return null; }
}
EOF

cat > "$STUB_SRC/net/minecraftforge/event/server/ServerStoppingEvent.java" << 'EOF'
package net.minecraftforge.event.server;
public class ServerStoppingEvent {
    public net.minecraft.server.MinecraftServer getServer() { return null; }
}
EOF

mkdir -p "$STUB_SRC/net/minecraftforge/eventbus/api"
cat > "$STUB_SRC/net/minecraftforge/eventbus/api/SubscribeEvent.java" << 'EOF'
package net.minecraftforge.eventbus.api;
import java.lang.annotation.*;
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface SubscribeEvent {}
EOF

mkdir -p "$STUB_SRC/net/minecraftforge/fml/common"
cat > "$STUB_SRC/net/minecraftforge/fml/common/Mod.java" << 'EOF'
package net.minecraftforge.fml.common;
import java.lang.annotation.*;
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Mod {
    String value();
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.TYPE)
    @interface EventBusSubscriber {
        String modid();
    }
}
EOF

# Brigadier command classes
mkdir -p "$STUB_SRC/com/mojang/brigadier"
cat > "$STUB_SRC/com/mojang/brigadier/CommandDispatcher.java" << 'EOF'
package com.mojang.brigadier;
public class CommandDispatcher<S> {
    public void register(com.mojang.brigadier.builder.LiteralArgumentBuilder<S> c) {}
}
EOF

cat > "$STUB_SRC/com/mojang/brigadier/Command.java" << 'EOF'
package com.mojang.brigadier;
public interface Command<S> {
    int run(com.mojang.brigadier.context.CommandContext<S> c);
}
EOF

mkdir -p "$STUB_SRC/com/mojang/brigadier/builder"
cat > "$STUB_SRC/com/mojang/brigadier/builder/LiteralArgumentBuilder.java" << 'EOF'
package com.mojang.brigadier.builder;
public class LiteralArgumentBuilder<S> {
    public LiteralArgumentBuilder<S> executes(com.mojang.brigadier.Command<S> c) { return this; }
    public LiteralArgumentBuilder<S> then(LiteralArgumentBuilder<S> a) { return this; }
}
EOF

mkdir -p "$STUB_SRC/com/mojang/brigadier/context"
cat > "$STUB_SRC/com/mojang/brigadier/context/CommandContext.java" << 'EOF'
package com.mojang.brigadier.context;
public class CommandContext<S> {
    public S getSource() { return null; }
}
EOF

echo "2. Compiling stub classes..."
mkdir -p "$LIBS_DIR/classes"
find "$STUB_SRC" -name "*.java" > "$LIBS_DIR/sources.txt"
javac -d "$LIBS_DIR/classes" @"$LIBS_DIR/sources.txt"

echo "3. Creating JAR files..."
cd "$LIBS_DIR/classes"
jar cf "$LIBS_DIR/minecraft-stub.jar" net/minecraft
jar cf "$LIBS_DIR/forge-stub.jar" net/minecraftforge com/mojang

echo "4. Cleaning temporary files..."
cd "$SCRIPT_DIR"
rm -rf "$STUB_SRC" "$LIBS_DIR/classes" "$LIBS_DIR/sources.txt"

echo "✅ Stub JAR files created successfully:"
ls -lh "$LIBS_DIR"/*.jar
