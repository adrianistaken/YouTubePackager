const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')
const root = path.resolve(__dirname, '..')

// Run the real TypeScript modules with isolated transport/auth/storage adapters.
function loader(mocks = {}, globals = {}) {
  const cache = new Map()
  function load(file) {
    file = path.resolve(root, file)
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require(name) {
        if (name in mocks) return mocks[name]
        if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`))
        return require(name)
      },
      URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer,
      Blob, Buffer, Response, AbortController, AbortSignal, setTimeout, clearTimeout,
      atob, crypto: require('node:crypto').webcrypto, process: { env: {} }, fetch,
      ...globals,
    }, { filename: file })
    return module.exports
  }
  return load
}
function storage() {
  const values = new Map()
  return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5))
const defaults = { title: 'Default', channelName: '', channelUrl: '', avatar: null, thumbnails: {}, activeVariant: 'A', views: '', publishTime: '', duration: '' }
const normalize = v => ({ ...defaults, ...v, thumbnails: { ...(v?.thumbnails ?? {}) } })

function cloudHarness() {
  const localStorage = storage()
  let mounted, authCallback, current = { id: 'alice' }
  const rows = new Map()
  const writes = []
  let selectHook = null, updateHook = null
  const client = {
    auth: {
      getSession: async () => ({ data: { session: current ? { user: current } : null } }),
      onAuthStateChange: callback => { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } } },
      signOut: async () => { current = null; return { error: null } },
    },
    from() {
      let owner, payload, op
      const query = {
        select() { return query },
        eq(key, value) { if (key === 'user_id') owner = value; return query },
        insert(value) { payload = value; owner = value.user_id; op = 'insert'; return query },
        update(value) { payload = value; op = 'update'; return query },
        async maybeSingle() { if (selectHook) return selectHook(owner); return { data: rows.get(owner) ?? null } },
        async single() {
          if (op === 'update' && updateHook) await updateHook()
          const row = { id: `${owner}-session`, created_at: new Date(0).toISOString(), updated_at: new Date().toISOString(), ...rows.get(owner), ...payload }
          writes.push({ owner, payload }); rows.set(owner, row)
          return { data: row }
        },
      }
      return query
    },
    storage: { from() { return { upload: async () => ({ error: null }), remove: async () => ({ error: null }) } } },
  }
  const load = loader({
    vue: { ...vue, onMounted: fn => { mounted = fn }, onBeforeUnmount() {} },
    '../lib/supabase': { isCloudConfigured: true, supabase: client },
  }, { window: { localStorage, setTimeout, clearTimeout } })
  const cache = load('src/lib/workspaceCache.ts')
  const options = { packageData: vue.ref(normalize(null)), previewMode: vue.ref('desktop'), placementStep: vue.ref(0), normalizePackage: normalize }
  const cloud = load('src/composables/useCloudWorkspace.ts').useCloudWorkspace(options)
  return { cloud, options, cache, rows, writes, mount: () => mounted(),
    setSelectHook: hook => { selectHook = hook }, setUpdateHook: hook => { updateHook = hook },
    async login(id) { current = { id }; authCallback('SIGNED_IN', { user: current }); await tick(); await vue.nextTick() },
    row(title) { return { id: `${title}-session`, package_data: normalize({ title }), preview_mode: 'desktop', placement_step: 0, thumbnail_paths: {}, avatar_path: null, created_at: new Date(0).toISOString(), updated_at: new Date(1).toISOString() } },
  }
}

test('legacy account cache is never returned to a guest', () => {
  const localStorage = storage()
  localStorage.setItem('youtube-packager:workspace', JSON.stringify({ packageData: { title: 'Private draft' } }))
  localStorage.setItem('youtube-packager:cloud-sync', JSON.stringify({ userId: 'alice', localChangedAt: 1 }))
  const cache = loader({}, { window: { localStorage } })('src/lib/workspaceCache.ts')
  cache.migrateWorkspaceCache()
  assert.equal(cache.readWorkspaceCache(null), null)
  assert.equal(cache.readWorkspaceCache('alice').packageData.title, 'Private draft')
  assert.equal(localStorage.getItem('youtube-packager:workspace'), null)
})

test('logout clears account workspace; a new account does not adopt it', async () => {
  const h = cloudHarness()
  h.rows.set('alice', h.row('Alice private'))
  await h.mount()
  assert.equal(h.options.packageData.value.title, 'Alice private')
  h.cache.writeWorkspaceCache('alice', { packageData: h.options.packageData.value })
  await h.cloud.signOut()
  assert.equal(h.options.packageData.value.title, 'Default')
  assert.equal(h.cache.readWorkspaceCache('alice'), null)
  await h.login('bob')
  assert.equal(h.rows.get('bob').package_data.title, 'Default')
})

test('direct account switch does not import the previous account into a pristine account', async () => {
  const h = cloudHarness()
  h.rows.set('alice', h.row('Alice private'))
  h.rows.set('bob', h.row('Bob'))
  await h.mount()
  await h.login('bob')
  assert.equal(h.options.packageData.value.title, 'Bob')
  assert.equal(h.writes.filter(w => w.owner === 'bob').length, 0)
})

test('first guest draft is imported once, and cached guest data is removed', async () => {
  const h = cloudHarness()
  h.options.packageData.value = normalize({ title: 'Guest draft' })
  h.cache.writeWorkspaceCache(null, { packageData: h.options.packageData.value })
  await h.mount()
  assert.equal(h.rows.get('alice').package_data.title, 'Guest draft')
  assert.equal(h.cache.readWorkspaceCache(null), null)
})

test('late account load cannot repopulate a logged-out workspace', async () => {
  const h = cloudHarness()
  h.rows.set('alice', h.row('Alice'))
  await h.mount()
  let release
  h.setSelectHook(() => new Promise(resolve => { release = resolve }))
  await h.login('bob')
  await h.cloud.signOut()
  release({ data: h.row('Bob private') })
  await tick()
  assert.equal(h.cloud.user.value, null)
  assert.equal(h.options.packageData.value.title, 'Default')
})

test('logout waits for an in-flight save and retains edits if saving fails', async () => {
  const h = cloudHarness()
  h.rows.set('alice', h.row('Alice'))
  await h.mount()
  let release
  h.setUpdateHook(() => new Promise((_, reject) => { release = () => reject(new Error('Offline')) }))
  h.options.packageData.value.title = 'Unsaved'
  await vue.nextTick()
  h.cloud.retrySync()
  await tick()
  const logout = h.cloud.signOut()
  await tick()
  assert.equal(h.cloud.user.value.id, 'alice')
  release()
  await logout
  assert.equal(h.cloud.user.value.id, 'alice')
  assert.equal(h.options.packageData.value.title, 'Unsaved')
  assert.match(h.cloud.error.value, /Retry sync/)
})

test('channel URL validation blocks SSRF entry points and canonicalizes channel tabs', () => {
  const { normalizeYouTubeUrl, validateImageUrl } = loader()('server/youtubeAvatar.ts')
  for (const url of ['https://127.0.0.1/@x', 'https://www.youtube.com/redirect?q=https://127.0.0.1', 'http://youtube.com/@x', 'https://youtube.com:8443/@x', 'https://user:password@youtube.com/@x', 'https://youtube.com/watch?v=x', 'https://youtube.com.evil.test/@x']) {
    assert.throws(() => normalizeYouTubeUrl(url), undefined, url)
  }
  assert.equal(normalizeYouTubeUrl('youtube.com/@example/videos?tracking=1').href, 'https://www.youtube.com/@example')
  assert.throws(() => validateImageUrl(new URL('https://127.0.0.1/avatar.png')))
  validateImageUrl(new URL('https://yt3.ggpht.com/avatar.png'))
})

test('redirects are validated before the next fetch; streamed size limits cannot be bypassed', async () => {
  const calls = []
  let response = new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } })
  const load = loader({}, { fetch: async url => { calls.push(String(url)); return response } })
  const { safeFetch, requireHttps } = load('server/safeFetch.ts')
  const validate = url => requireHttps(url, new Set(['www.youtube.com']))
  await assert.rejects(safeFetch('https://www.youtube.com/@x', validate, 4, 'text/html'))
  assert.equal(calls.length, 1)
  response = new Response('12345') // No content-length header.
  await assert.rejects(safeFetch('https://www.youtube.com/@x', validate, 4, 'text/html'), /too large/)
})

test('timeouts cover the response body, not just headers', async () => {
  const load = loader({}, {
    setTimeout: fn => setTimeout(fn, 10),
    fetch: async (_, { signal }) => new Response(new ReadableStream({
      start(controller) { signal.addEventListener('abort', () => controller.error(new Error('aborted'))) },
    })),
  })
  await assert.rejects(load('server/safeFetch.ts').safeFetch('https://www.youtube.com/@x', () => {}, 100, 'text/html'), /timed out/)
})

test('production fails closed without shared counters and never contacts YouTube', async () => {
  const calls = []
  const load = loader({}, { process: { env: { NODE_ENV: 'production' } }, fetch: async url => { calls.push(url); throw new Error('unexpected') } })
  const headers = {}; let status, body
  const res = { setHeader: (k,v) => { headers[k] = v }, status: code => { status = code; return res }, json: value => { body = value } }
  await load('server/api.ts').handleApi('avatar', { method: 'GET', query: { url: 'https://youtube.com/@example' } }, res)
  assert.equal(status, 503)
  assert.equal(headers['Cache-Control'], 'no-store')
  assert.match(body.error, /temporarily unavailable/)
  assert.equal(calls.length, 0)
})

test('shared limiter uses atomic counters, ignores spoofed forwarding headers, and returns retry delay', async () => {
  const commands = []
  let result = 0
  const load = loader({}, {
    process: { env: { VERCEL: '1', UPSTASH_REDIS_REST_URL: 'https://counter.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test' } },
    fetch: async (_, init) => { commands.push(JSON.parse(init.body)); return new Response(JSON.stringify({ result })) },
  })
  const { enforceRateLimit } = load('server/rateLimit.ts')
  await enforceRateLimit({ query: {}, headers: { 'x-vercel-forwarded-for': '1.2.3.4', 'x-forwarded-for': 'fake1' } }, 'avatar')
  result = 42
  await assert.rejects(enforceRateLimit({ query: {}, headers: { 'x-vercel-forwarded-for': '1.2.3.4', 'x-forwarded-for': 'fake2' } }, 'avatar'), error => error.status === 429 && error.retryAfter === 42)
  assert.equal(commands[0][0], 'EVAL')
  assert.equal(commands[0][3], commands[1][3])
  assert.equal(commands[0][4], 'yp:v1:youtube:daily')
})

test('local limiter rejects requests above the allowed burst', async () => {
  const { enforceRateLimit } = loader()('server/rateLimit.ts')
  const req = { query: {}, socket: { remoteAddress: '127.0.0.1' } }
  for (let i = 0; i < 10; i++) await enforceRateLimit(req, 'avatar')
  await assert.rejects(enforceRateLimit(req, 'avatar'), error => error.status === 429)
})

test('explicit logout without saving still clears a failed local draft', async () => {
  const h = cloudHarness()
  h.rows.set('alice', h.row('Alice'))
  await h.mount()
  h.options.packageData.value.title = 'Unsaved'
  await vue.nextTick()
  h.cache.writeWorkspaceCache('alice', { packageData: h.options.packageData.value })
  await h.cloud.signOut(true)
  assert.equal(h.cloud.user.value, null)
  assert.equal(h.options.packageData.value.title, 'Default')
  assert.equal(h.cache.readWorkspaceCache('alice'), null)
})

test('normal avatar lookup returns a raster data URL through the restricted fetcher', async () => {
  const calls = []
  const load = loader({}, { fetch: async url => {
    calls.push(String(url))
    return calls.length === 1
      ? new Response('<meta property="og:image" content="https://yt3.ggpht.com/avatar.png">', { headers: { 'content-type': 'text/html' } })
      : new Response('test-image', { headers: { 'content-type': 'image/png' } })
  } })
  const result = await load('server/youtubeAvatar.ts').resolveYouTubeAvatar('youtube.com/@example')
  assert.equal(result.avatarDataUrl, `data:image/png;base64,${Buffer.from('test-image').toString('base64')}`)
  assert.equal(calls[1], 'https://yt3.ggpht.com/avatar.png')
})

test('oversized and non-raster uploads are rejected before file reading', () => {
  const { imageUploadError } = loader()('src/lib/imageUpload.ts')
  assert.equal(imageUploadError({ type: 'image/png', size: 1024 }), null)
  assert.match(imageUploadError({ type: 'image/svg+xml', size: 1024 }), /PNG/)
  assert.match(imageUploadError({ type: 'image/png', size: 10485761 }), /10 MB/)
})
