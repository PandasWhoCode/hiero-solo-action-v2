/**
 * Comprehensive unit tests for src/main.ts with 100% coverage
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// Create mock functions
const mockGetInput = jest.fn()
const mockInfo = jest.fn()
const mockSetOutput = jest.fn()
const mockSetFailed = jest.fn()
const mockExec = jest.fn()

// Mock modules before importing main
jest.unstable_mockModule('@actions/core', () => ({
  getInput: mockGetInput,
  info: mockInfo,
  setOutput: mockSetOutput,
  setFailed: mockSetFailed
}))

jest.unstable_mockModule('@actions/exec', () => ({
  exec: mockExec
}))

// Import main after mocking
const main = await import('../src/main.js')

describe('extract AccountInfo', () => {
  it('should extract account information from valid JSON output', () => {
    const output = `
      Some text before
      {"accountId": "0.0.1234", "publicKey": "302a300506032b6570032100abcd", "balance": 10000000}
      Some text after
    `
    const result = main.extractAccountInfo(output)

    expect(result).not.toBeNull()
    expect(result?.accountId).toBe('0.0.1234')
    expect(result?.publicKey).toBe('302a300506032b6570032100abcd')
    expect(result?.privateKey).toBe('')
  })

  it('should return null when no JSON is found', () => {
    const output = 'This is just plain text with no JSON'
    const result = main.extractAccountInfo(output)

    expect(result).toBeNull()
  })

  it('should return null for invalid JSON structure', () => {
    const output = '{"accountId": "0.0.1234"}'
    const result = main.extractAccountInfo(output)

    expect(result).toBeNull()
  })
})

describe('executeCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should execute command and return output from stdout', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('test output'))
      }
      return 0
    })

    const result = await main.executeCommand('echo', ['test'])

    expect(result).toBe('test output')
    expect(mockExec).toHaveBeenCalledWith(
      'echo',
      ['test'],
      expect.objectContaining({
        silent: false
      })
    )
  })

  it('should execute command silently when silent flag is true', async () => {
    mockExec.mockResolvedValue(0)

    await main.executeCommand('echo', ['test'], true)

    expect(mockExec).toHaveBeenCalledWith(
      'echo',
      ['test'],
      expect.objectContaining({
        silent: true
      })
    )
  })

  it('should capture stderr output', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from('error message'))
      }
      return 0
    })

    const result = await main.executeCommand('some', ['command'])

    expect(result).toBe('error message')
  })

  it('should combine stdout and stderr', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('stdout text'))
      }
      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from('stderr text'))
      }
      return 0
    })

    const result = await main.executeCommand('some', ['command'])

    expect(result).toBe('stdout textstderr text')
  })
})

describe('getBooleanInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return true when input is "true"', () => {
    mockGetInput.mockReturnValue('true')

    const result = main.getBooleanInput('testInput', false)

    expect(result).toBe(true)
    expect(mockGetInput).toHaveBeenCalledWith('testInput')
  })

  it('should return false when input is "false"', () => {
    mockGetInput.mockReturnValue('false')

    const result = main.getBooleanInput('testInput', true)

    expect(result).toBe(false)
  })

  it('should return default value when input is empty string', () => {
    mockGetInput.mockReturnValue('')

    const resultTrue = main.getBooleanInput('testInput', true)
    const resultFalse = main.getBooleanInput('testInput', false)

    expect(resultTrue).toBe(true)
    expect(resultFalse).toBe(false)
  })

  it('should return false for any non-"true" string value', () => {
    mockGetInput.mockReturnValue('yes')

    const result = main.getBooleanInput('testInput', true)

    expect(result).toBe(false)
  })
})

describe('getInputs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return all inputs with default values when no inputs are provided', () => {
    mockGetInput.mockReturnValue('')

    const result = main.getInputs()

    expect(result).toEqual({
      installMirrorNode: false,
      hieroVersion: 'v0.66.0',
      mirrorNodeVersion: 'v0.138.0',
      mirrorNodePortRest: '5551',
      mirrorNodePortGrpc: '5600',
      mirrorNodePortWeb3Rest: '8545',
      installRelay: false,
      relayPort: '7546',
      grpcProxyPort: '9998',
      haproxyPort: '50211',
      soloVersion: '0.46.1',
      javaRestApiPort: '8084',
      hbarAmount: '10000000'
    })
  })

  it('should return custom values when inputs are provided', () => {
    mockGetInput.mockImplementation((name) => {
      const values: Record<string, string> = {
        installMirrorNode: 'true',
        hieroVersion: 'v0.70.0',
        mirrorNodeVersion: 'v0.140.0',
        mirrorNodePortRest: '6000',
        mirrorNodePortGrpc: '6100',
        mirrorNodePortWeb3Rest: '9000',
        installRelay: 'true',
        relayPort: '8000',
        grpcProxyPort: '10000',
        haproxyPort: '51000',
        soloVersion: '0.50.0',
        javaRestApiPort: '9000',
        hbarAmount: '20000000'
      }
      return values[name] || ''
    })

    const result = main.getInputs()

    expect(result.installMirrorNode).toBe(true)
    expect(result.hieroVersion).toBe('v0.70.0')
    expect(result.mirrorNodeVersion).toBe('v0.140.0')
    expect(result.installRelay).toBe(true)
    expect(result.hbarAmount).toBe('20000000')
  })
})

describe('checkSoloVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should detect version >= 0.44.0', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('Version 0.46.1'))
      }
      return 0
    })

    const result = await main.checkSoloVersion()

    expect(result.version).toBe('0.46.1')
    expect(result.soloGe0440).toBe(true)
  })

  it('should detect version < 0.44.0', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('Version 0.43.0'))
      }
      return 0
    })

    const result = await main.checkSoloVersion()

    expect(result.version).toBe('0.43.0')
    expect(result.soloGe0440).toBe(false)
  })

  it('should handle version 0.44.0 exactly', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('Version 0.44.0'))
      }
      return 0
    })

    const result = await main.checkSoloVersion()

    expect(result.version).toBe('0.44.0')
    expect(result.soloGe0440).toBe(true)
  })

  it('should handle version 1.0.0', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('Version 1.0.0'))
      }
      return 0
    })

    const result = await main.checkSoloVersion()

    expect(result.version).toBe('1.0.0')
    expect(result.soloGe0440).toBe(true)
  })

  it('should handle missing version and default to 0.0.0', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('No version found'))
      }
      return 0
    })

    const result = await main.checkSoloVersion()

    expect(result.version).toBe('0.0.0')
    expect(result.soloGe0440).toBe(false)
  })

  it('should log version information', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('Version 0.50.0'))
      }
      return 0
    })

    await main.checkSoloVersion()

    expect(mockInfo).toHaveBeenCalledWith(
      'Solo version: 0.50.0, >= 0.44.0: true'
    )
  })
})

describe('setupPrerequisites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should log prerequisite information', async () => {
    await main.setupPrerequisites()

    expect(mockInfo).toHaveBeenCalledWith('Setting up prerequisites...')
    expect(mockInfo).toHaveBeenCalledWith(
      'Ensure Java 21, Node 22, and kubectl are installed'
    )
  })
})

describe('installSolo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should install Solo CLI with correct version', async () => {
    mockExec.mockResolvedValue(0)

    await main.installSolo('0.46.1')

    expect(mockInfo).toHaveBeenCalledWith(
      'Installing Solo CLI version 0.46.1...'
    )
    expect(mockExec).toHaveBeenCalledWith(
      'npm',
      ['install', '-g', '@hashgraph/solo@0.46.1'],
      expect.any(Object)
    )
    expect(mockInfo).toHaveBeenCalledWith('Solo CLI installed successfully')
  })
})

describe('Complex deployment and account functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockInputs = {
    installMirrorNode: false,
    hieroVersion: 'v0.66.0',
    mirrorNodeVersion: 'v0.138.0',
    mirrorNodePortRest: '5551',
    mirrorNodePortGrpc: '5600',
    mirrorNodePortWeb3Rest: '8545',
    installRelay: false,
    relayPort: '7546',
    grpcProxyPort: '9998',
    haproxyPort: '50211',
    soloVersion: '0.46.1',
    javaRestApiPort: '8084',
    hbarAmount: '10000000'
  }

  it('should deploy Solo network with existing services', async () => {
    mockExec.mockImplementation(async (_cmd, args, options) => {
      if (args?.[1]?.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('exists'))
        }
      }
      return 0
    })

    await main.deploySoloNetwork(mockInputs, true)

    expect(mockInfo).toHaveBeenCalledWith('Port forwarding HAProxy...')
    expect(mockInfo).toHaveBeenCalledWith('Port forwarding gRPC proxy...')
  })

  it('should deploy Solo network with version < 0.44.0', async () => {
    mockExec.mockImplementation(async (_cmd, args, options) => {
      if (args?.[1]?.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('not exists'))
        }
      }
      return 0
    })

    await main.deploySoloNetwork(mockInputs, false)

    expect(mockInfo).toHaveBeenCalledWith(
      'Using Solo CLI commands for version < 0.44.0'
    )
  })

  it('should deploy Mirror Node with existing services', async () => {
    mockExec.mockImplementation(async (_cmd, args, options) => {
      if (args?.[1]?.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('exists'))
        }
      }
      return 0
    })

    await main.deployMirrorNode(mockInputs, true)

    expect(mockInfo).toHaveBeenCalledWith('Port forwarding mirror-1-rest...')
    expect(mockInfo).toHaveBeenCalledWith('Port forwarding mirror-1-grpc...')
    expect(mockInfo).toHaveBeenCalledWith('Port forwarding mirror-1-web3...')
    expect(mockInfo).toHaveBeenCalledWith(
      'Port forwarding mirror-1-restjava...'
    )
  })

  it('should deploy Mirror Node with version >= 0.44.0', async () => {
    mockExec.mockImplementation(async (_cmd, args, options) => {
      if (args?.[1]?.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('not exists'))
        }
      }
      return 0
    })

    await main.deployMirrorNode(mockInputs, true)

    expect(mockInfo).toHaveBeenCalledWith('Deploying Mirror Node...')
  })

  it('should deploy Mirror Node with version < 0.44.0', async () => {
    mockExec.mockImplementation(async (_cmd, args, options) => {
      if (args?.[1]?.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('not exists'))
        }
      }
      return 0
    })

    await main.deployMirrorNode(mockInputs, false)

    expect(mockInfo).toHaveBeenCalledWith('Deploying Mirror Node...')
  })

  it('should deploy Relay with version >= 0.44.0', async () => {
    mockExec.mockImplementation(async (_cmd, args, options) => {
      if (args?.[1]?.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('not exists'))
        }
      }
      return 0
    })

    await main.deployRelay(mockInputs, true)

    expect(mockInfo).toHaveBeenCalledWith('Installing JSON-RPC-Relay...')
  })

  it('should deploy Relay with existing service', async () => {
    mockExec.mockImplementation(async (_cmd, args, options) => {
      if (args?.[1]?.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('exists'))
        }
      }
      return 0
    })

    await main.deployRelay(mockInputs, true)

    expect(mockInfo).toHaveBeenCalledWith('Port forwarding JSON-RPC-Relay...')
  })

  it('should deploy Relay with version < 0.44.0', async () => {
    mockExec.mockImplementation(async (_cmd, args, options) => {
      if (args?.[1]?.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('not exists'))
        }
      }
      return 0
    })

    await main.deployRelay(mockInputs, false)

    expect(mockInfo).toHaveBeenCalledWith('Installing JSON-RPC-Relay...')
  })

  it('should create ECDSA account with version >= 0.44.0', async () => {
    let callCount = 0
    mockExec.mockImplementation(async (_cmd, args, options) => {
      callCount++
      if (callCount === 1 && options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from(
            '{"accountId": "0.0.1234", "publicKey": "key", "balance": 0}'
          )
        )
      } else if (callCount === 2 && options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('priv-key'))
      }
      return 0
    })

    const result = await main.createAccount(mockInputs, true, true)

    expect(result.accountId).toBe('0.0.1234')
    expect(result.privateKey).toBe('priv-key')
  })

  it('should create ED25519 account with version < 0.44.0', async () => {
    let callCount = 0
    mockExec.mockImplementation(async (_cmd, args, options) => {
      callCount++
      if (callCount === 1 && options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from(
            '{"accountId": "0.0.5678", "publicKey": "key2", "balance": 0}'
          )
        )
      } else if (callCount === 2 && options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('priv-key2'))
      }
      return 0
    })

    const result = await main.createAccount(mockInputs, false, false)

    expect(result.accountId).toBe('0.0.5678')
    expect(result.privateKey).toBe('priv-key2')
  })

  it('should create ECDSA account with version < 0.44.0', async () => {
    let callCount = 0
    mockExec.mockImplementation(async (_cmd, args, options) => {
      callCount++
      if (callCount === 1 && options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from(
            '{"accountId": "0.0.9999", "publicKey": "key3", "balance": 0}'
          )
        )
      } else if (callCount === 2 && options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('priv-key3'))
      }
      return 0
    })

    const result = await main.createAccount(mockInputs, true, false)

    expect(result.accountId).toBe('0.0.9999')
    expect(result.privateKey).toBe('priv-key3')
  })

  it('should throw error when account info cannot be extracted', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('Invalid output'))
      }
      return 0
    })

    await expect(main.createAccount(mockInputs, true, true)).rejects.toThrow(
      'Failed to extract account information from output'
    )
  })
})

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should execute complete workflow successfully', async () => {
    mockGetInput.mockReturnValue('')
    let callCount = 0

    mockExec.mockImplementation(async (cmd, args, options) => {
      // Handle bash -c commands
      if (cmd === 'bash' && args?.[0] === '-c') {
        const bashCmd = args[1] || ''
        if (bashCmd.includes('solo --version')) {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('Version 0.46.1'))
          }
        } else if (bashCmd.includes('kubectl get secret')) {
          if (options?.listeners?.stdout) {
            const priv = bashCmd.includes('1001')
              ? 'ecdsa-priv'
              : 'ed25519-priv'
            options.listeners.stdout(Buffer.from(priv))
          }
        } else if (bashCmd.includes('kubectl get svc')) {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('not exists'))
          }
        }
      }
      // Handle direct solo commands
      else if (cmd === 'solo') {
        const soloArgs = args?.join(' ') || ''
        if (soloArgs.includes('account create')) {
          callCount++
          if (options?.listeners?.stdout) {
            const id = callCount === 1 ? '0.0.1001' : '0.0.1002'
            const key = callCount === 1 ? 'ecdsa-pub' : 'ed25519-pub'
            options.listeners.stdout(
              Buffer.from(
                `{"accountId": "${id}", "publicKey": "${key}", "balance": 0}`
              )
            )
          }
        }
      }
      return 0
    })

    await main.run()

    expect(mockSetOutput).toHaveBeenCalledWith('accountId', '0.0.1002')
    expect(mockSetOutput).toHaveBeenCalledWith('deployment', 'solo-deployment')
  })

  it('should handle errors', async () => {
    mockGetInput.mockReturnValue('')
    mockExec.mockRejectedValue(new Error('Test error'))

    await main.run()

    expect(mockSetFailed).toHaveBeenCalledWith('Test error')
  })

  it('should handle non-Error exceptions gracefully', async () => {
    mockGetInput.mockReturnValue('')
    mockExec.mockRejectedValue('String error')

    await main.run()

    // setFailed should not be called for non-Error objects
    expect(mockSetFailed).not.toHaveBeenCalled()
  })

  it('should skip mirror node when not requested', async () => {
    mockGetInput.mockImplementation((name) => {
      if (name === 'installMirrorNode') return 'false'
      return ''
    })

    let callCount = 0
    mockExec.mockImplementation(async (_cmd, args, options) => {
      const cmd = args?.[1] || ''
      if (cmd.includes('solo --version')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('Version 0.46.1'))
        }
      } else if (cmd.includes('account create')) {
        callCount++
        if (options?.listeners?.stdout) {
          options.listeners.stdout(
            Buffer.from(
              `{"accountId": "0.0.100${callCount}", "publicKey": "key", "balance": 0}`
            )
          )
        }
      } else if (cmd.includes('kubectl get secret')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('priv'))
        }
      } else if (cmd.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('not exists'))
        }
      }
      return 0
    })

    await main.run()

    expect(mockInfo).not.toHaveBeenCalledWith('Deploying Mirror Node...')
  })

  it('should deploy mirror node when requested', async () => {
    mockGetInput.mockImplementation((name) => {
      if (name === 'installMirrorNode') return 'true'
      return ''
    })

    let callCount = 0
    mockExec.mockImplementation(async (_cmd, args, options) => {
      const cmd = args?.[1] || ''
      if (cmd.includes('solo --version')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('Version 0.46.1'))
        }
      } else if (cmd.includes('account create')) {
        callCount++
        if (options?.listeners?.stdout) {
          options.listeners.stdout(
            Buffer.from(
              `{"accountId": "0.0.200${callCount}", "publicKey": "key", "balance": 0}`
            )
          )
        }
      } else if (cmd.includes('kubectl get secret')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('priv'))
        }
      } else if (cmd.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('not exists'))
        }
      }
      return 0
    })

    await main.run()

    expect(mockInfo).toHaveBeenCalledWith('Deploying Mirror Node...')
  })

  it('should deploy relay when requested', async () => {
    mockGetInput.mockImplementation((name) => {
      if (name === 'installRelay') return 'true'
      return ''
    })

    let callCount = 0
    mockExec.mockImplementation(async (_cmd, args, options) => {
      const cmd = args?.[1] || ''
      if (cmd.includes('solo --version')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('Version 0.46.1'))
        }
      } else if (cmd.includes('account create')) {
        callCount++
        if (options?.listeners?.stdout) {
          options.listeners.stdout(
            Buffer.from(
              `{"accountId": "0.0.300${callCount}", "publicKey": "key", "balance": 0}`
            )
          )
        }
      } else if (cmd.includes('kubectl get secret')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('priv'))
        }
      } else if (cmd.includes('kubectl get svc')) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('not exists'))
        }
      }
      return 0
    })

    await main.run()

    expect(mockInfo).toHaveBeenCalledWith('Installing JSON-RPC-Relay...')
  })
})
