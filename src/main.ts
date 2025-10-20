import * as core from '@actions/core'
import * as exec from '@actions/exec'

interface ActionInputs {
  installMirrorNode: boolean
  hieroVersion: string
  mirrorNodeVersion: string
  mirrorNodePortRest: string
  mirrorNodePortGrpc: string
  mirrorNodePortWeb3Rest: string
  installRelay: boolean
  relayPort: string
  grpcProxyPort: string
  haproxyPort: string
  soloVersion: string
  javaRestApiPort: string
  hbarAmount: string
}

interface AccountInfo {
  accountId: string
  publicKey: string
  privateKey: string
}

interface SoloVersionInfo {
  version: string
  soloGe0440: boolean
}

/**
 * Extract account information from Solo CLI output using regex
 */
export function extractAccountInfo(output: string): AccountInfo | null {
  const jsonRegex =
    /\{\s*"accountId":\s*".*?",\s*"publicKey":\s*".*?",\s*"balance":\s*\d+\s*\}/
  const match = output.match(jsonRegex)

  if (match) {
    const json = JSON.parse(match[0])
    return {
      accountId: json.accountId,
      publicKey: json.publicKey,
      privateKey: '' // Will be fetched from Kubernetes secret
    }
  }

  return null
}

/**
 * Execute a command with arguments and return output
 * Uses direct command execution instead of bash -c to prevent command injection
 */
export async function executeCommand(
  command: string,
  args: string[] = [],
  silent: boolean = false
): Promise<string> {
  let output = ''
  const options: exec.ExecOptions = {
    silent,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      },
      stderr: (data: Buffer) => {
        output += data.toString()
      }
    }
  }

  await exec.exec(command, args, options)
  return output
}

/**
 * Get input as boolean
 */
export function getBooleanInput(name: string, defaultValue: boolean): boolean {
  const value = core.getInput(name)
  if (value === '') return defaultValue
  return value === 'true'
}

/**
 * Get all action inputs
 */
export function getInputs(): ActionInputs {
  return {
    installMirrorNode: getBooleanInput('installMirrorNode', false),
    hieroVersion: core.getInput('hieroVersion') || 'v0.66.0',
    mirrorNodeVersion: core.getInput('mirrorNodeVersion') || 'v0.138.0',
    mirrorNodePortRest: core.getInput('mirrorNodePortRest') || '5551',
    mirrorNodePortGrpc: core.getInput('mirrorNodePortGrpc') || '5600',
    mirrorNodePortWeb3Rest: core.getInput('mirrorNodePortWeb3Rest') || '8545',
    installRelay: getBooleanInput('installRelay', false),
    relayPort: core.getInput('relayPort') || '7546',
    grpcProxyPort: core.getInput('grpcProxyPort') || '9998',
    haproxyPort: core.getInput('haproxyPort') || '50211',
    soloVersion: core.getInput('soloVersion') || '0.46.1',
    javaRestApiPort: core.getInput('javaRestApiPort') || '8084',
    hbarAmount: core.getInput('hbarAmount') || '10000000'
  }
}

/**
 * Check Solo version and determine if it's >= 0.44.0
 */
export async function checkSoloVersion(): Promise<SoloVersionInfo> {
  const output = await executeCommand(
    'bash',
    ['-c', 'solo --version | grep Version'],
    true
  )
  const versionMatch = output.match(/Version\s+(\S+)/)
  const version = versionMatch ? versionMatch[1] : '0.0.0'

  // Compare versions
  const parts = version.split('.').map(Number)
  const isGe0440 =
    parts[0] > 0 || (parts[0] === 0 && parts[1] >= 44) || parts[0] >= 1

  core.info(`Solo version: ${version}, >= 0.44.0: ${isGe0440}`)

  return {
    version,
    soloGe0440: isGe0440
  }
}

/**
 * Setup prerequisites (Java, Node, etc.)
 */
export async function setupPrerequisites(): Promise<void> {
  core.info('Setting up prerequisites...')

  // These are typically done via setup actions in GitHub Actions
  // But we'll document that they should be set up before this action
  core.info('Ensure Java 21, Node 22, and kubectl are installed')
}

/**
 * Install Solo CLI
 */
export async function installSolo(version: string): Promise<void> {
  core.info(`Installing Solo CLI version ${version}...`)
  await executeCommand('npm', ['install', '-g', `@hashgraph/solo@${version}`])
  core.info('Solo CLI installed successfully')
}

/**
 * Setup and deploy Solo test network
 */
export async function deploySoloNetwork(
  inputs: ActionInputs,
  soloGe0440: boolean
): Promise<void> {
  const SOLO_CLUSTER_NAME = 'solo-e2e'
  const SOLO_NAMESPACE = 'solo'
  const SOLO_DEPLOYMENT = 'solo-deployment'

  core.info('Cleaning up previous runs...')
  await executeCommand('rm', ['-rf', '~/.solo'], true)
  await executeCommand(
    'bash',
    ['-c', 'kind delete cluster --name solo-e2e || true'],
    true
  )

  core.info('Creating Kubernetes cluster...')
  await executeCommand('kind', ['create', 'cluster', '-n', SOLO_CLUSTER_NAME])

  core.info('Initializing Solo CLI...')
  await executeCommand('solo', ['init', '--dev'])

  if (soloGe0440) {
    core.info('Using Solo CLI commands for version >= 0.44.0')

    await executeCommand('solo', [
      'cluster-ref',
      'config',
      'connect',
      '--cluster-ref',
      `kind-${SOLO_CLUSTER_NAME}`,
      '--context',
      `kind-${SOLO_CLUSTER_NAME}`,
      '--dev'
    ])
    await executeCommand('solo', [
      'deployment',
      'config',
      'create',
      '-n',
      SOLO_NAMESPACE,
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
    await executeCommand('solo', [
      'deployment',
      'cluster',
      'attach',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--cluster-ref',
      `kind-${SOLO_CLUSTER_NAME}`,
      '--num-consensus-nodes',
      '1',
      '--dev'
    ])
    await executeCommand('solo', [
      'keys',
      'consensus',
      'generate',
      '--gossip-keys',
      '--tls-keys',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
    await executeCommand('solo', [
      'cluster-ref',
      'config',
      'setup',
      '-s',
      SOLO_CLUSTER_NAME,
      '--dev'
    ])
    await executeCommand('solo', [
      'consensus',
      'network',
      'deploy',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--release-tag',
      inputs.hieroVersion,
      '--dev'
    ])
    await executeCommand('solo', [
      'consensus',
      'node',
      'setup',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--release-tag',
      inputs.hieroVersion,
      '--quiet-mode',
      '--dev'
    ])
    await executeCommand('solo', [
      'consensus',
      'node',
      'start',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
  } else {
    core.info('Using Solo CLI commands for version < 0.44.0')

    await executeCommand('solo', [
      'cluster-ref',
      'connect',
      '--cluster-ref',
      `kind-${SOLO_CLUSTER_NAME}`,
      '--context',
      `kind-${SOLO_CLUSTER_NAME}`,
      '--dev'
    ])
    await executeCommand('solo', [
      'deployment',
      'create',
      '-n',
      SOLO_NAMESPACE,
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
    await executeCommand('solo', [
      'deployment',
      'add-cluster',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--cluster-ref',
      `kind-${SOLO_CLUSTER_NAME}`,
      '--num-consensus-nodes',
      '1',
      '--dev'
    ])
    await executeCommand('solo', [
      'node',
      'keys',
      '--gossip-keys',
      '--tls-keys',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
    await executeCommand('solo', [
      'cluster-ref',
      'setup',
      '-s',
      SOLO_CLUSTER_NAME,
      '--dev'
    ])
    await executeCommand('solo', [
      'network',
      'deploy',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--release-tag',
      inputs.hieroVersion,
      '--dev'
    ])
    await executeCommand('solo', [
      'node',
      'setup',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--release-tag',
      inputs.hieroVersion,
      '--quiet-mode',
      '--dev'
    ])
    await executeCommand('solo', [
      'node',
      'start',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
  }

  // List services
  core.info('Listing services in namespace solo:')
  await executeCommand('kubectl', ['get', 'svc', '-n', SOLO_NAMESPACE])

  // Port forward HAProxy
  const haproxyCheck = await executeCommand(
    'bash',
    [
      '-c',
      `kubectl get svc haproxy-node1-svc -n ${SOLO_NAMESPACE} >/dev/null 2>&1 && echo "exists" || echo "not exists"`
    ],
    true
  )
  if (haproxyCheck.includes('exists')) {
    core.info('Port forwarding HAProxy...')
    await executeCommand('bash', [
      '-c',
      `kubectl port-forward svc/haproxy-node1-svc -n ${SOLO_NAMESPACE} ${inputs.haproxyPort}:50211 &`
    ])
  }

  // Port forward gRPC proxy
  const grpcCheck = await executeCommand(
    'bash',
    [
      '-c',
      `kubectl get svc envoy-proxy-node1-svc -n ${SOLO_NAMESPACE} >/dev/null 2>&1 && echo "exists" || echo "not exists"`
    ],
    true
  )
  if (grpcCheck.includes('exists')) {
    core.info('Port forwarding gRPC proxy...')
    await executeCommand('bash', [
      '-c',
      `kubectl port-forward svc/envoy-proxy-node1-svc -n ${SOLO_NAMESPACE} ${inputs.grpcProxyPort}:8080 &`
    ])
  }
}

/**
 * Deploy Mirror Node
 */
export async function deployMirrorNode(
  inputs: ActionInputs,
  soloGe0440: boolean
): Promise<void> {
  const SOLO_NAMESPACE = 'solo'
  const SOLO_DEPLOYMENT = 'solo-deployment'
  const SOLO_CLUSTER_NAME = 'solo-e2e'

  core.info('Deploying Mirror Node...')

  if (soloGe0440) {
    await executeCommand('solo', [
      'mirror',
      'node',
      'add',
      '--cluster-ref',
      `kind-${SOLO_CLUSTER_NAME}`,
      '--deployment',
      SOLO_DEPLOYMENT,
      '--mirror-node-version',
      inputs.mirrorNodeVersion,
      '--pinger',
      '--dev'
    ])
  } else {
    await executeCommand('solo', [
      'mirror-node',
      'deploy',
      '--cluster-ref',
      `kind-${SOLO_CLUSTER_NAME}`,
      '--deployment',
      SOLO_DEPLOYMENT,
      '--mirror-node-version',
      inputs.mirrorNodeVersion,
      '--pinger',
      '--dev'
    ])
  }

  // List services
  core.info('Listing services in namespace solo:')
  await executeCommand('kubectl', ['get', 'svc', '-n', SOLO_NAMESPACE])

  // Port forward mirror node services
  const services = [
    {
      name: 'mirror-1-rest',
      port: inputs.mirrorNodePortRest,
      targetPort: '80'
    },
    {
      name: 'mirror-1-grpc',
      port: inputs.mirrorNodePortGrpc,
      targetPort: '5600'
    },
    {
      name: 'mirror-1-web3',
      port: inputs.mirrorNodePortWeb3Rest,
      targetPort: '80'
    },
    {
      name: 'mirror-1-restjava',
      port: inputs.javaRestApiPort,
      targetPort: '80'
    }
  ]

  for (const service of services) {
    const check = await executeCommand(
      'bash',
      [
        '-c',
        `kubectl get svc ${service.name} -n ${SOLO_NAMESPACE} >/dev/null 2>&1 && echo "exists" || echo "not exists"`
      ],
      true
    )
    if (check.includes('exists')) {
      core.info(`Port forwarding ${service.name}...`)
      await executeCommand('bash', [
        '-c',
        `kubectl port-forward svc/${service.name} -n ${SOLO_NAMESPACE} ${service.port}:${service.targetPort} &`
      ])
    }
  }
}

/**
 * Deploy JSON-RPC-Relay
 */
export async function deployRelay(
  inputs: ActionInputs,
  soloGe0440: boolean
): Promise<void> {
  const SOLO_NAMESPACE = 'solo'
  const SOLO_DEPLOYMENT = 'solo-deployment'

  core.info('Installing JSON-RPC-Relay...')

  if (soloGe0440) {
    await executeCommand('solo', [
      'relay',
      'node',
      'add',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
  } else {
    await executeCommand('solo', [
      'relay',
      'deploy',
      '-i',
      'node1',
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
  }

  // List services
  core.info('Listing services in namespace solo:')
  await executeCommand('kubectl', ['get', 'svc', '-n', SOLO_NAMESPACE])

  // Port forward relay
  const relayCheck = await executeCommand(
    'bash',
    [
      '-c',
      `kubectl get svc relay-node1-hedera-json-rpc-relay -n ${SOLO_NAMESPACE} >/dev/null 2>&1 && echo "exists" || echo "not exists"`
    ],
    true
  )
  if (relayCheck.includes('exists')) {
    core.info('Port forwarding JSON-RPC-Relay...')
    await executeCommand('bash', [
      '-c',
      `kubectl port-forward svc/relay-node1-hedera-json-rpc-relay -n ${SOLO_NAMESPACE} ${inputs.relayPort}:7546 &`
    ])
  }
}

/**
 * Create an account (ECDSA or ED25519)
 */
export async function createAccount(
  inputs: ActionInputs,
  isEcdsa: boolean,
  soloGe0440: boolean
): Promise<AccountInfo> {
  const SOLO_NAMESPACE = 'solo'
  const SOLO_DEPLOYMENT = 'solo-deployment'
  const accountType = isEcdsa ? 'ECDSA' : 'ED25519'

  core.info(`Creating ${accountType} account...`)

  let output: string
  if (soloGe0440) {
    if (isEcdsa) {
      output = await executeCommand('solo', [
        'ledger',
        'account',
        'create',
        '--generate-ecdsa-key',
        '--deployment',
        SOLO_DEPLOYMENT,
        '--dev'
      ])
    } else {
      output = await executeCommand('solo', [
        'ledger',
        'account',
        'create',
        '--deployment',
        SOLO_DEPLOYMENT,
        '--dev'
      ])
    }
  } else {
    if (isEcdsa) {
      output = await executeCommand('solo', [
        'account',
        'create',
        '--generate-ecdsa-key',
        '--deployment',
        SOLO_DEPLOYMENT,
        '--dev'
      ])
    } else {
      output = await executeCommand('solo', [
        'account',
        'create',
        '--deployment',
        SOLO_DEPLOYMENT,
        '--dev'
      ])
    }
  }

  // Extract account info
  const accountInfo = extractAccountInfo(output)
  if (!accountInfo) {
    throw new Error(`Failed to extract account information from output`)
  }

  // Get private key from Kubernetes secret
  const privateKeyOutput = await executeCommand(
    'bash',
    [
      '-c',
      `kubectl get secret account-key-${accountInfo.accountId} -n ${SOLO_NAMESPACE} -o jsonpath='{.data.privateKey}' | base64 -d`
    ],
    true
  )
  accountInfo.privateKey = privateKeyOutput.trim()

  // Update account with HBAR amount
  core.info(
    `Updating account ${accountInfo.accountId} with ${inputs.hbarAmount} HBAR...`
  )
  if (soloGe0440) {
    await executeCommand('solo', [
      'ledger',
      'account',
      'update',
      '--account-id',
      accountInfo.accountId,
      '--hbar-amount',
      inputs.hbarAmount,
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
  } else {
    await executeCommand('solo', [
      'account',
      'update',
      '--account-id',
      accountInfo.accountId,
      '--hbar-amount',
      inputs.hbarAmount,
      '--deployment',
      SOLO_DEPLOYMENT,
      '--dev'
    ])
  }

  core.info(`Account ID: ${accountInfo.accountId}`)
  core.info(`Public Key: ${accountInfo.publicKey}`)
  core.info(`Private Key: ${accountInfo.privateKey}`)

  return accountInfo
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    const inputs = getInputs()

    core.info('Print inputs:')
    core.info(`installMirrorNode: ${inputs.installMirrorNode}`)

    // Setup prerequisites
    await setupPrerequisites()

    // Install Solo CLI
    await installSolo(inputs.soloVersion)

    // Check Solo version
    const soloVersionInfo = await checkSoloVersion()

    // Deploy Solo test network
    await deploySoloNetwork(inputs, soloVersionInfo.soloGe0440)

    // Deploy Mirror Node if requested
    if (inputs.installMirrorNode) {
      await deployMirrorNode(inputs, soloVersionInfo.soloGe0440)
    }

    // Deploy JSON-RPC-Relay if requested
    if (inputs.installRelay) {
      await deployRelay(inputs, soloVersionInfo.soloGe0440)
    }

    // Create ECDSA account
    const ecdsaAccount = await createAccount(
      inputs,
      true,
      soloVersionInfo.soloGe0440
    )

    // Create ED25519 account
    const ed25519Account = await createAccount(
      inputs,
      false,
      soloVersionInfo.soloGe0440
    )

    // Set outputs
    core.setOutput('accountId', ed25519Account.accountId)
    core.setOutput('publicKey', ed25519Account.publicKey)
    core.setOutput('privateKey', ed25519Account.privateKey)
    core.setOutput('deployment', 'solo-deployment')
    core.setOutput('ecdsaAccountId', ecdsaAccount.accountId)
    core.setOutput('ecdsaPublicKey', ecdsaAccount.publicKey)
    core.setOutput('ecdsaPrivateKey', ecdsaAccount.privateKey)
    core.setOutput('ed25519AccountId', ed25519Account.accountId)
    core.setOutput('ed25519PublicKey', ed25519Account.publicKey)
    core.setOutput('ed25519PrivateKey', ed25519Account.privateKey)

    core.info('Hiero Solo Action completed successfully!')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
