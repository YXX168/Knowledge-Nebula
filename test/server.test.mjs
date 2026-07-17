import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

async function startServer(configPath) {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      KNOWLEDGE_CONFIG_PATH: configPath,
      KNOWLEDGE_ROOT: '',
      SCAN_INTERVAL_MS: '500',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const baseUrl = await new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`服务启动超时：${output}`)), 10_000)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      output += chunk
      const match = output.match(/Knowledge Nebula：http:\/\/127\.0\.0\.1:(\d+)/)
      if (match) {
        clearTimeout(timeout)
        resolve(`http://127.0.0.1:${match[1]}`)
      }
    })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`服务提前退出 (${code})：${output}`))
    })
  })

  return {
    baseUrl,
    async stop() {
      if (child.exitCode !== null) return
      child.kill()
      await new Promise((resolve) => child.once('exit', resolve))
    },
  }
}

async function json(response) {
  return response.json()
}

test('knowledge root can be configured without a hard-coded private path', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-nebula-'))
  const configPath = path.join(temporary, 'settings', 'config.json')
  const library = path.join(temporary, 'library')
  await fs.mkdir(library)
  await fs.writeFile(path.join(library, 'hello.md'), '# Hello\n', 'utf8')
  const server = await startServer(configPath)
  t.after(async () => {
    await server.stop()
    await fs.rm(temporary, { recursive: true, force: true })
  })

  const initialConfigResponse = await fetch(`${server.baseUrl}/api/config`)
  assert.equal(initialConfigResponse.status, 200)
  assert.deepEqual(await json(initialConfigResponse), {
    knowledgeRoot: '',
    configured: false,
    available: false,
  })

  const initialHealth = await json(await fetch(`${server.baseUrl}/api/health`))
  assert.equal(initialHealth.configured, false)
  assert.equal('knowledgeRoot' in initialHealth, false)

  const relativeResponse = await fetch(`${server.baseUrl}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgeRoot: 'relative/folder' }),
  })
  assert.equal(relativeResponse.status, 400)

  const saveResponse = await fetch(`${server.baseUrl}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgeRoot: library }),
  })
  assert.equal(saveResponse.status, 200)
  const saved = await json(saveResponse)
  assert.equal(saved.configured, true)
  assert.equal(saved.available, true)
  assert.equal(saved.knowledgeRoot, await fs.realpath(library))

  const treeResponse = await fetch(`${server.baseUrl}/api/tree`)
  assert.equal(treeResponse.status, 200)
  const tree = await json(treeResponse)
  assert.equal(tree.name, 'library')
  assert.equal(tree.children[0].name, 'hello.md')

  const traversalResponse = await fetch(`${server.baseUrl}/api/text?path=${encodeURIComponent('../secret.txt')}`)
  assert.equal(traversalResponse.status, 400)

  const missingResponse = await fetch(`${server.baseUrl}/api/text?path=${encodeURIComponent('private-missing.txt')}`)
  assert.equal(missingResponse.status, 404)
  const missingError = await json(missingResponse)
  assert.equal(missingError.error, '文件或目录不存在')
  assert.equal(JSON.stringify(missingError).includes(await fs.realpath(library)), false)

  const persisted = JSON.parse(await fs.readFile(configPath, 'utf8'))
  assert.equal(persisted.knowledgeRoot, await fs.realpath(library))
})

test('saved configuration is restored after restart and can be cleared', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-nebula-restart-'))
  const configPath = path.join(temporary, 'config.json')
  const library = path.join(temporary, 'notes')
  await fs.mkdir(library)
  await fs.writeFile(configPath, JSON.stringify({ knowledgeRoot: library }), 'utf8')

  const server = await startServer(configPath)
  t.after(async () => {
    await server.stop()
    await fs.rm(temporary, { recursive: true, force: true })
  })

  const restored = await json(await fetch(`${server.baseUrl}/api/config`))
  assert.equal(restored.configured, true)
  assert.equal(restored.available, true)

  const clearResponse = await fetch(`${server.baseUrl}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgeRoot: '' }),
  })
  assert.equal(clearResponse.status, 200)
  const cleared = await json(clearResponse)
  assert.equal(cleared.configured, false)
  assert.equal(cleared.knowledgeRoot, '')
})
