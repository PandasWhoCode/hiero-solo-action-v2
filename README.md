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

## License

This project is licensed under the Apache License 2.0 - see the
[LICENSE](LICENSE) file for details.

## Credits

This action is based on the work of
[Hiero Solo](https://github.com/hiero-ledger/solo)
