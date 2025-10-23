# hiero-solo-action-v2

TypeScript version of hiero-solo-action

[![License](https://img.shields.io/badge/license-apache2-blue.svg)](LICENSE)

## Overview

A GitHub Action for setting up a Hiero Solo network. This is the TypeScript
version (v2) of the original composite action.

The network that is created by the action contains one consensus node that can
be accessed at `localhost:50211`. When a mirror node is installed, the
Java-based REST API can be accessed at `localhost:8084`. The action creates
accounts on the network that contain the specified amount of hbars. All
information about the accounts is stored as output to the GitHub action.

## Prerequisites

This action requires the following to be set up before running:

- Java 21 (use `actions/setup-java@v4`)
- Node.js 22 (use `actions/setup-node@v4`)
- Kind (use `helm/kind-action@v1`)
- kubectl

## Inputs

| Input                    | Required | Default    | Description                                   |
| ------------------------ | -------- | ---------- | --------------------------------------------- |
| `hbarAmount`             | false    | `10000000` | Amount of hbars to fund created accounts with |
| `hieroVersion`           | false    | `v0.66.0`  | Hiero consensus node version to use           |
| `mirrorNodeVersion`      | false    | `v0.138.0` | Mirror node version to use                    |
| `installMirrorNode`      | false    | `false`    | If set to `true`, installs a mirror node      |
| `mirrorNodePortRest`     | false    | `5551`     | Port for Mirror Node REST API                 |
| `mirrorNodePortGrpc`     | false    | `5600`     | Port for Mirror Node gRPC                     |
| `mirrorNodePortWeb3Rest` | false    | `8545`     | Port for Web3 REST API                        |
| `installRelay`           | false    | `false`    | If set to `true`, installs the JSON-RPC-Relay |
| `relayPort`              | false    | `7546`     | Port for the JSON-RPC-Relay                   |
| `grpcProxyPort`          | false    | `9998`     | Port for gRPC Proxy                           |
| `haproxyPort`            | false    | `50211`    | Port for HAProxy                              |
| `soloVersion`            | false    | `0.46.1`   | Version of Solo CLI to install                |
| `javaRestApiPort`        | false    | `8084`     | Port for Java-based REST API                  |

## Outputs

| Output              | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `accountId`         | The account ID of account created in ED25519 format       |
| `publicKey`         | The public key of account created in ED25519 format       |
| `privateKey`        | The private key of account created in ED25519 format      |
| `deployment`        | The name of the Solo deployment created by the action     |
| `ecdsaAccountId`    | The account ID of the account created (in ECDSA format)   |
| `ecdsaPublicKey`    | The public key of the account created (in ECDSA format)   |
| `ecdsaPrivateKey`   | The private key of the account created (in ECDSA format)  |
| `ed25519AccountId`  | Same as `accountId`, but with an explicit ED25519 format  |
| `ed25519PublicKey`  | Same as `publicKey`, but with an explicit ED25519 format  |
| `ed25519PrivateKey` | Same as `privateKey`, but with an explicit ED25519 format |

## Usage Examples

### Simple usage

```yaml
name: Test Hiero Solo

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Kind
        uses: helm/kind-action@v1
        with:
          install_only: true
          node_image: kindest/node:v1.31.4
          version: v0.26.0
          kubectl_version: v1.31.4

      - name: Setup Hiero Solo
        uses: PandasWhoCode/hiero-solo-action-v2@v2
        id: solo

      - name: Use Hiero Solo
        run: |
          echo "Account ID: ${{ steps.solo.outputs.accountId }}"
          echo "Private Key: ${{ steps.solo.outputs.privateKey }}"
          echo "Public Key: ${{ steps.solo.outputs.publicKey }}"
```

### Usage with ECDSA account format

```yaml
- name: Setup Hiero Solo
  uses: PandasWhoCode/hiero-solo-action-v2@v2
  id: solo

- name: Use Hiero Solo
  run: |
    echo "Account ID: ${{ steps.solo.outputs.ecdsaAccountId }}"
    echo "Private Key: ${{ steps.solo.outputs.ecdsaPrivateKey }}"
    echo "Public Key: ${{ steps.solo.outputs.ecdsaPublicKey }}"
```

### Usage with custom hbarAmount

```yaml
- name: Setup Hiero Solo
  uses: PandasWhoCode/hiero-solo-action-v2@v2
  id: solo
  with:
    hbarAmount: 20000000

- name: Use Hiero Solo
  run: |
    echo "Account ID: ${{ steps.solo.outputs.accountId }}"
```

### Usage with Mirror Node

```yaml
- name: Setup Hiero Solo with Mirror Node
  uses: PandasWhoCode/hiero-solo-action-v2@v2
  id: solo
  with:
    installMirrorNode: true
    mirrorNodeVersion: v0.138.0
```

## Development

### Prerequisites

- Node.js 24+
- npm

### Setup

```bash
npm install
```

### Build

```bash
npm run bundle
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format:write
```

## Local Testing

You can test this action locally on your CLI before using it in a workflow.

### Prerequisites for Local Testing

#### Hardware Requirements

To run Solo locally for a one-node network, ensure your system meets these
minimum requirements (from
[Solo documentation](https://solo.hiero.org/v0.47.0/docs/readme/#hardware-requirements)):

- **Memory**: At least 12GB RAM
- **CPU**: At least 4 CPU cores
- **Disk Space**: 20GB+ free disk space recommended

#### Docker Configuration

Configure Docker Desktop with sufficient resources:

- **Memory**: 12GB or more
- **CPUs**: 4 or more
- **Swap**: 2GB recommended
- **Disk Image Size**: 60GB+ recommended

On Docker Desktop, you can configure these settings in:

- **macOS/Windows**: Docker Desktop → Preferences/Settings → Resources
- **Linux**: Edit `/etc/docker/daemon.json` and restart Docker

Example Docker daemon configuration for Linux:

```json
{
  "default-ulimits": {
    "nofile": {
      "Hard": 65536,
      "Name": "nofile",
      "Soft": 65536
    }
  }
}
```

#### Software Requirements

Ensure you have the following installed on your system:

- **Node.js 20+** (check with `node --version`)
- **npm** (check with `npm --version`)
- **Java 21** (check with `java -version`)
- **Docker** (check with `docker --version`)
  - Must be running with the resource requirements above
  - Verify: `docker info` should show sufficient memory/CPUs
- **kubectl** (check with `kubectl version --client`)
- **kind** (Kubernetes in Docker) - Install with:
  ```bash
  curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.26.0/kind-linux-amd64
  chmod +x ./kind
  sudo mv ./kind /usr/local/bin/kind
  ```

### Step-by-Step Local Testing Instructions

#### 1. Clone and Setup the Repository

```bash
git clone https://github.com/PandasWhoCode/hiero-solo-action-v2.git
cd hiero-solo-action-v2
npm install
```

#### 2. Build the Action

```bash
npm run bundle
```

This will format, lint, test, and package the action into `dist/index.js`.

#### 3. Configure Environment Variables

Create a `.env` file from the example template:

```bash
cp .env.example .env
```

Edit the `.env` file to configure the action inputs. For example, to test with a
mirror node:

```bash
# Enable debug logging
ACTIONS_STEP_DEBUG=true

# Install mirror node
INPUT_INSTALLMIRRORNODE=true

# Use specific versions
INPUT_HIEROVERSION=v0.66.0
INPUT_MIRRORNODEVERSION=v0.138.0
INPUT_SOLOVERSION=0.46.1

# Configure ports (defaults shown)
INPUT_HAPROXYPORT=50211
INPUT_MIRRORNODEPORTREST=5551
INPUT_MIRRORNODEPORTGRPC=5600
INPUT_MIRRORNODEPORTWEB3REST=8545

# Configure HBAR amount
INPUT_HBARAMOUNT=10000000

# Optional: Install JSON-RPC-Relay
INPUT_INSTALLRELAY=false
INPUT_RELAYPORT=7546
```

**Important**: Input names in the `.env` file use underscores and uppercase:

- `installMirrorNode` → `INPUT_INSTALLMIRRORNODE`
- `hieroVersion` → `INPUT_HIEROVERSION`
- `mirrorNodeVersion` → `INPUT_MIRRORNODEVERSION`
- etc.

#### 4. Run the Action Locally

Use the `@github/local-action` tool to run the action:

```bash
npm run local-action
```

This command executes `npx @github/local-action . src/main.ts .env`, which:

- Loads environment variables from `.env`
- Runs the action's main logic from `src/main.ts`
- Simulates the GitHub Actions runtime environment

#### 5. Monitor the Output

The action will:

1. Install the Solo CLI globally
2. Create a Kubernetes cluster using Kind
3. Deploy the Hiero consensus node
4. Optionally deploy the Mirror Node (if `INPUT_INSTALLMIRRORNODE=true`)
5. Optionally deploy the JSON-RPC-Relay (if `INPUT_INSTALLRELAY=true`)
6. Create ECDSA and ED25519 accounts
7. Output account information

Watch for log output showing:

```
Solo version: 0.46.1, >= 0.44.0: true
Creating Kubernetes cluster...
Initializing Solo CLI...
Deploying Solo network...
Creating ECDSA account...
Creating ED25519 account...
Account ID: 0.0.1234
Public Key: 302a300506032b6570032100...
Private Key: 302e020100300506032b657004220420...
```

#### 6. Verify the Deployment

Once the action completes, you can verify the deployment:

```bash
# Check Kubernetes cluster
kind get clusters

# Check deployed pods
kubectl get pods -n solo

# Check services
kubectl get svc -n solo

# Test connectivity to consensus node
curl http://localhost:50211/health
```

#### 7. Test with Different Configurations

Modify `.env` to test different scenarios:

**Minimal setup (no mirror node, no relay):**

```bash
INPUT_INSTALLMIRRORNODE=false
INPUT_INSTALLRELAY=false
INPUT_SOLOVERSION=0.46.1
INPUT_HBARAMOUNT=5000000
```

**Full setup (with mirror node and relay):**

```bash
INPUT_INSTALLMIRRORNODE=true
INPUT_INSTALLRELAY=true
INPUT_MIRRORNODEVERSION=v0.138.0
INPUT_HBARAMOUNT=20000000
```

#### 8. Cleanup After Testing

After testing, clean up the Kind cluster and Solo configuration:

```bash
# Delete the Kind cluster
kind delete cluster --name solo-e2e

# Remove Solo configuration
rm -rf ~/.solo
```

### Troubleshooting Local Testing

**Issue: Insufficient Docker resources**

- Error messages about memory, CPU, or container failures
- Solution: Increase Docker Desktop resources (Settings → Resources)
  - Set Memory to at least 12GB
  - Set CPUs to at least 4
  - Set Disk Image Size to at least 60GB
- Verify configuration: `docker info | grep -E "(CPUs|Memory)"`
- Restart Docker Desktop after changing resource limits

**Issue: `kind` command not found**

- Install Kind following the prerequisites above

**Issue: Docker daemon not running**

- Start Docker: `sudo systemctl start docker`
- Or use Docker Desktop if on macOS/Windows
- Verify Docker is running: `docker ps`

**Issue: Port already in use**

- Change the port numbers in `.env` file
- Or stop the conflicting service
- Check what's using a port: `lsof -i :50211` (replace with your port)

**Issue: Solo CLI installation fails**

- Check Node.js version: `node --version` (should be 20+)
- Try installing Solo globally: `npm install -g @hashgraph/solo@0.46.1`
- Clear npm cache: `npm cache clean --force`

**Issue: Kubernetes cluster creation fails**

- Ensure Docker is running with sufficient resources (see above)
- Check disk space: `df -h`
- Try: `kind delete cluster --name solo-e2e` and retry
- Check Docker daemon logs for resource constraints

**Issue: Solo deployment hangs or fails**

- Check Docker resource usage: `docker stats`
- Ensure no other resource-intensive processes are running
- Verify Solo logs: `kubectl logs -n solo <pod-name>`
- Try with minimal configuration first (no mirror node, no relay)

## License

This project is licensed under the Apache License 2.0 - see the
[LICENSE](LICENSE) file for details.

## Credits

This action is based on the work of
[Hiero Solo](https://github.com/hiero-ledger/solo)
