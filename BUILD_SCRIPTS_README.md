# Build Scripts Documentation

## Overview

This document describes the build scripts used for compiling Mochi-Link connectors across different platforms.

## Build Scripts

### 1. build-all-connectors.sh (Linux/macOS)

Builds all Java-based connectors sequentially.

**Usage:**
```bash
chmod +x build-all-connectors.sh
./build-all-connectors.sh
```

**Connectors built:**
- Java (Paper/Spigot)
- Folia
- Nukkit
- Fabric
- Forge

### 2. build-all-connectors.bat (Windows)

Windows version of the build script.

**Usage:**
```cmd
build-all-connectors.bat
```

### 3. build-connectors.bat (Windows)

Alternative Windows build script.

**Usage:**
```cmd
build-connectors.bat
```

### 4. build-fabric-forge.sh (Linux/macOS)

Specialized script for building Fabric and Forge connectors with proper Gradle version.

**Usage:**
```bash
chmod +x build-fabric-forge.sh
./build-fabric-forge.sh
```

**Features:**
- Uses Gradle 8.8 for compatibility
- Handles Fabric Loom requirements
- Creates Forge stub dependencies

### 5. connectors/forge/create-stubs.sh

Creates stub JAR files for Forge and Minecraft APIs used in CI environments.

**Usage:**
```bash
cd connectors/forge
chmod +x create-stubs.sh
./create-stubs.sh
```

**Output:**
- `libs/minecraft-stub.jar` - Minecraft API stubs
- `libs/forge-stub.jar` - Forge API stubs

**Note:** This script is automatically executed by GitHub Actions during CI builds.

## GitHub Actions Workflow

The `.github/workflows/build-connectors.yml` workflow automatically builds all connectors on push/PR.

**Key features:**
- Uses Gradle 8.8 for compatibility with Fabric Loom and Forge
- Automatically copies ReconnectionManager to Forge
- Generates stub dependencies for Forge in CI
- Builds all connectors in parallel
- Creates release packages with all artifacts

**Workflow jobs:**
1. `build-java-connectors` - Builds Java, Folia, Nukkit
2. `build-fabric` - Builds Fabric mod
3. `build-forge` - Builds Forge mod (with stub generation)
4. `build-llbds` - Builds LLBDS connector
5. `build-pmmp` - Packages PMMP connector
6. `create-release-package` - Combines all artifacts

## Gradle Version Requirements

### Gradle 8.8 (Recommended)

Used for all connectors to ensure compatibility:
- **Fabric**: Requires Gradle 8.x for Loom 1.7-SNAPSHOT
- **Forge**: Compatible with Gradle 8.x
- **Java/Folia/Nukkit**: Work with any Gradle 8.x+

### Why not Gradle 9.x?

Gradle 9.3.1 causes issues:
- Fabric Loom 1.7-SNAPSHOT is not compatible
- Forge Gradle plugin has compatibility issues
- Breaking changes in dependency resolution

## Local Development

### Prerequisites

- Java 17 or higher
- Gradle 8.8 (or use wrapper)
- Node.js 18+ (for LLBDS)
- PHP 8.0+ (for PMMP)

### Building Individual Connectors

**Java-based connectors:**
```bash
cd connectors/java  # or folia, nukkit, fabric, forge
gradle clean build
```

**LLBDS:**
```bash
cd connectors/llbds
npm install
npm run build
```

**PMMP:**
```bash
# No build required, PHP source files are used directly
cd connectors/pmmp
```

### Building All Connectors

**Linux/macOS:**
```bash
./build-all-connectors.sh
```

**Windows:**
```cmd
build-all-connectors.bat
```

## CI/CD Environment

### Environment Variables

The build scripts detect CI environment:
- `CI=true` - Generic CI indicator
- `GITHUB_ACTIONS=true` - GitHub Actions specific

### Forge Stub Generation

In CI environments, Forge uses stub dependencies instead of full Minecraft/Forge APIs:

1. `create-stubs.sh` generates minimal stub classes
2. Stubs provide compile-time type checking
3. Runtime dependencies are provided by Forge server

**Stub classes include:**
- Minecraft server classes (MinecraftServer, ServerPlayer, etc.)
- Forge event classes (PlayerEvent, ServerChatEvent, etc.)
- Brigadier command classes (CommandDispatcher, etc.)

### Build Artifacts

All build artifacts are uploaded to GitHub Actions:
- Retention: 30 days for individual connectors
- Retention: 90 days for combined release package

**Artifact structure:**
```
mochi-link-connectors-all/
├── java-connector/
│   └── mochi-link-connector-java-1.0.0.jar
├── folia-connector/
│   └── mochi-link-connector-folia-1.0.0.jar
├── nukkit-connector/
│   └── mochi-link-connector-nukkit-1.0.0.jar
├── fabric-connector/
│   └── mochi-link-connector-fabric-1.0.0.jar
├── forge-connector/
│   └── mochi-link-connector-forge-1.0.0.jar
├── llbds-connector/
│   ├── dist/
│   └── package.json
├── pmmp-connector/
│   └── (PHP source files)
├── VERSION.txt
└── README.md
```

## Troubleshooting

### Gradle Version Issues

**Problem:** Build fails with Gradle 9.x
```
FAILURE: Build failed with an exception.
* What went wrong:
Plugin [id: 'fabric-loom', version: '1.7-SNAPSHOT'] was not found
```

**Solution:** Use Gradle 8.8
```bash
gradle wrapper --gradle-version 8.8
./gradlew build
```

### Forge Stub Issues

**Problem:** Forge build fails with missing Minecraft classes

**Solution:** Ensure stub generation runs before build
```bash
cd connectors/forge
./create-stubs.sh
gradle build
```

### Proxy/Network Issues

**Problem:** Build fails with proxy connection errors
```
Connect to 127.0.0.1:2080 failed: Connection refused
```

**Solution:** Remove proxy settings from `gradle.properties`
```properties
# Remove these lines:
# systemProp.http.proxyHost=127.0.0.1
# systemProp.http.proxyPort=2080
```

### Encoding Issues

**Problem:** Chinese characters display incorrectly

**Solution:** Ensure UTF-8 encoding in build files
```gradle
tasks.withType(JavaCompile).configureEach {
    it.options.encoding = "UTF-8"
}
```

## Best Practices

### For Contributors

1. **Test locally before pushing:**
   ```bash
   ./build-all-connectors.sh
   ```

2. **Use Gradle wrapper:**
   ```bash
   ./gradlew build  # Instead of gradle build
   ```

3. **Check diagnostics:**
   ```bash
   gradle build --warning-mode all
   ```

### For CI/CD

1. **Use specific Gradle version:**
   ```yaml
   - uses: gradle/actions/setup-gradle@v3
     with:
       gradle-version: '8.8'
   ```

2. **Allow Forge build to fail gracefully:**
   ```yaml
   - name: Build Forge mod
     continue-on-error: true
   ```

3. **Cache Gradle dependencies:**
   ```yaml
   - uses: gradle/actions/setup-gradle@v3
     with:
       cache-read-only: false
   ```

## Related Documentation

- [Quick Build Guide](docs/QUICK_BUILD_GUIDE.md)
- [Build Environment Setup](docs/BUILD_ENVIRONMENT_SETUP.md)
- [Fabric/Forge Setup (CN)](docs/FABRIC_FORGE_SETUP_CN.md)
- [CI Build Fix](CI_BUILD_FIX.md)
- [Forge Fix Summary](FORGE_FIX_SUMMARY.md)

## Support

For build issues:
1. Check this documentation
2. Review error logs in GitHub Actions
3. Open an issue on GitHub with full error output

## Version History

- **2026-03-02**: Added Forge stub generation, fixed Gradle version issues
- **2026-03-01**: Fixed proxy configuration issues in CI
- **2026-02-28**: Initial build scripts created
