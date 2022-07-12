import { addFile, editFile, isBuild, page, removeFile, withRetry } from '~utils'

const filteredResult = {
  './alias.js': {
    default: 'hi'
  },
  './foo.js': {
    msg: 'foo'
  }
}

const json = {
  msg: 'baz',
  default: {
    msg: 'baz'
  }
}

const globWithAlias = {
  '/dir/alias.js': {
    default: 'hi'
  }
}

const allResult = {
  // JSON file should be properly transformed
  '/dir/alias.js': {
    default: 'hi'
  },
  '/dir/baz.json': json,
  '/dir/foo.css': isBuild
    ? {
        default: '.foo{color:#00f}\n'
      }
    : {
        default: '.foo {\n  color: blue;\n}\n'
      },
  '/dir/foo.js': {
    msg: 'foo'
  },
  '/dir/index.js': isBuild
    ? {
        modules: filteredResult,
        globWithAlias
      }
    : {
        globWithAlias,
        modules: filteredResult
      },
  '/dir/nested/bar.js': {
    modules: {
      '../baz.json': json
    },
    msg: 'bar'
  }
}

const nodeModulesResult = {
  '/dir/node_modules/hoge.js': { msg: 'hoge' }
}

const rawResult = {
  '/dir/baz.json': {
    msg: 'baz'
  }
}

const relativeRawResult = {
  './dir/baz.json': {
    msg: 'baz'
  }
}

test('should work', async () => {
  await withRetry(async () => {
    const actual = await page.textContent('.result')
    expect(JSON.parse(actual)).toStrictEqual(allResult)
  }, true)
  await withRetry(async () => {
    const actualEager = await page.textContent('.result-eager')
    expect(JSON.parse(actualEager)).toStrictEqual(allResult)
  }, true)
  await withRetry(async () => {
    const actualNodeModules = await page.textContent('.result-node_modules')
    expect(JSON.parse(actualNodeModules)).toStrictEqual(nodeModulesResult)
  }, true)
})

test('import glob raw', async () => {
  expect(await page.textContent('.globraw')).toBe(
    JSON.stringify(rawResult, null, 2)
  )
})

test('import relative glob raw', async () => {
  expect(await page.textContent('.relative-glob-raw')).toBe(
    JSON.stringify(relativeRawResult, null, 2)
  )
})

test('unassigned import processes', async () => {
  expect(await page.textContent('.side-effect-result')).toBe(
    'Hello from side effect'
  )
})

if (!isBuild) {
  test('hmr for adding/removing files', async () => {
    const resultElement = page.locator('.result')

    addFile('dir/a.js', '')
    await withRetry(async () => {
      const actualAdd = await resultElement.textContent()
      expect(JSON.parse(actualAdd)).toStrictEqual({
        '/dir/a.js': {},
        ...allResult,
        '/dir/index.js': {
          ...allResult['/dir/index.js'],
          modules: {
            './a.js': {},
            ...allResult['/dir/index.js'].modules
          }
        }
      })
    })

    // edit the added file
    editFile('dir/a.js', () => 'export const msg ="a"')
    await withRetry(async () => {
      const actualEdit = await resultElement.textContent()
      expect(JSON.parse(actualEdit)).toStrictEqual({
        '/dir/a.js': {
          msg: 'a'
        },
        ...allResult,
        '/dir/index.js': {
          ...allResult['/dir/index.js'],
          modules: {
            './a.js': {
              msg: 'a'
            },
            ...allResult['/dir/index.js'].modules
          }
        }
      })
    })

    removeFile('dir/a.js')
    await withRetry(async () => {
      const actualRemove = await resultElement.textContent()
      expect(JSON.parse(actualRemove)).toStrictEqual(allResult)
    })
  })
}
