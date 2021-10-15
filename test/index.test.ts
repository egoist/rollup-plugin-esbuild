import path from 'path'
import fs from 'fs'
import { rollup, Plugin as RollupPlugin } from 'rollup'
import mockfs from 'mock-fs'
import esbuild, { Options } from '../src'

const readFs = (folderName: string, files: Record<string, string>) => {
  mockfs.restore()
  const tmpDir = path.join(__dirname, '.temp', `esbuild/${folderName}`)
  Object.keys(files).forEach((file) => {
    const absolute = path.join(tmpDir, file)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, files[file], 'utf8')
  })
  return tmpDir
}

const build = async (
  options?: Options,
  {
    input = './fixture/index.js',
    sourcemap = false,
    rollupPlugins = [],
  }: {
    input?: string | string[]
    sourcemap?: boolean
    rollupPlugins?: RollupPlugin[]
  } = {}
) => {
  const build = await rollup({
    input,
    plugins: [esbuild(options), ...rollupPlugins],
  })
  const { output } = await build.generate({ format: 'esm', sourcemap })
  return output
}

beforeAll(() => {
  mockfs({
    './fixture/index.js': `
      import Foo from './foo'

      console.log(Foo)
    `,
    './fixture/foo.tsx': `
      export default class Foo {
        render() {
          return <div className="hehe">hello there!!!</div>
        }
      }
    `,
  })
})

afterAll(() => {
  mockfs.restore()
})

test('simple', async () => {
  const output = await build()
  expect(output[0].code).toMatchInlineSnapshot(`
    "class Foo {
      render() {
        return /* @__PURE__ */ React.createElement(\\"div\\", {
          className: \\"hehe\\"
        }, \\"hello there!!!\\");
      }
    }

    console.log(Foo);
    "
  `)
})

test('minify', async () => {
  const output = await build({ minify: true })
  expect(output[0].code).toMatchInlineSnapshot(`
    "class Foo{render(){return React.createElement(\\"div\\",{className:\\"hehe\\"},\\"hello there!!!\\")}}console.log(Foo);
    "
  `)
})

test('keepNames', async () => {
  mockfs({
    './fixture/index.js': `
      export default class Foo {}
    `,
  })
  const output = await build({ minify: true, keepNames: true })
  expect(output[0].code).toMatchInlineSnapshot(`
    "var a=Object.defineProperty,t=(e,r)=>a(e,\\"name\\",{value:r,configurable:!0});class o{}t(o,\\"Foo\\");export default o;
    "
  `)
})

test('minify whitespace only', async () => {
  mockfs({
    './fixture/index.js': `
      console.log(1 === 1);
    `,
  })
  const output = await build({ minifyWhitespace: true })
  expect(output[0].code).toMatchInlineSnapshot(`
    "console.log(true);
    "
  `)
})

test('minify syntax only', async () => {
  mockfs({
    './fixture/index.js': `
      console.log(1 === 1);
    `,
  })
  const output = await build({ minifySyntax: true })
  expect(output[0].code).toMatchInlineSnapshot(`
    "console.log(!0);
    "
  `)
})

test('legal comments none', async () => {
  mockfs({
    './fixture/index.js': `/** @preserve comment */
      /*!
       * comment
       */
      //! comment
      console.log(1 === 1);
    `,
  })
  const output = await build({ minify: true, legalComments: 'none' })
  expect(output[0].code).toMatchInlineSnapshot(`
    "console.log(!0);
    "
  `)
})

test('load index.(x)', async () => {
  mockfs({
    './fixture/index.js': `
      import Foo from './foo'

      console.log(Foo)
    `,
    './fixture/foo/index.tsx': `
      export default class Foo {
        render() {
          return <div className="hehe">hello there!!!</div>
        }
      }
    `,
  })

  const output = await build()
  expect(output[0].code).toMatchInlineSnapshot(`
    "class Foo {
      render() {
        return /* @__PURE__ */ React.createElement(\\"div\\", {
          className: \\"hehe\\"
        }, \\"hello there!!!\\");
      }
    }

    console.log(Foo);
    "
  `)
})

test('load json', async () => {
  mockfs({
    './fixture/index.js': `
      import * as foo from './foo'

      console.log(foo)
    `,
    './fixture/foo.json': `
      {
        "foo": true
      }
    `,
  })

  const output = await build({
    loaders: {
      '.json': 'json',
    },
  })
  // Following code is expected
  // esbuild doesn't emit json code as es module for now
  // So you will need @rollup/plugin-commonjs
  expect(output[0].code).toMatchInlineSnapshot(`
    "module.exports = {
      foo: true
    };

    var foo = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    console.log(foo);
    "
  `)
})

test('use custom jsxFactory (h) from tsconfig', async () => {
  mockfs({
    './fixture/index.jsx': `
      export const foo = <div>foo</div>
    `,
    './fixture/tsconfig.json': `
      {
        "compilerOptions": {
          "jsxFactory": "h"
        }
      }
    `,
  })

  const output = await build({}, { input: './fixture/index.jsx' })
  expect(output[0].code).toMatchInlineSnapshot(`
    "const foo = /* @__PURE__ */ h(\\"div\\", null, \\"foo\\");

    export { foo };
    "
  `)
})

test('use custom tsconfig.json', async () => {
  mockfs({
    './fixture/index.jsx': `
      export const foo = <div>foo</div>
    `,
    './fixture/tsconfig.json': `
      {
        "compilerOptions": {
          "jsxFactory": "h"
        }
      }
    `,
    './fixture/tsconfig.build.json': `
      {
        "compilerOptions": {
          "jsxFactory": "custom"
        }
      }
    `,
  })

  const output = await build(
    { tsconfig: 'tsconfig.build.json' },
    { input: './fixture/index.jsx' }
  )
  expect(output[0].code).toMatchInlineSnapshot(`
    "const foo = /* @__PURE__ */ custom(\\"div\\", null, \\"foo\\");

    export { foo };
    "
  `)
})

describe('bundle', () => {
  test('simple', async () => {
    const dir = readFs('bundle-simple', {
      './fixture/bar.ts': `export const bar = 'bar'`,
      './fixture/Foo.jsx': `
       import {bar} from 'bar'
        export const Foo = <div>foo {bar}</div>
      `,
      './fixture/entry-a.jsx': `
      import {Foo} from './Foo'
      export const A = () => <Foo>A</Foo>
      `,
      './fixture/entry-b.jsx': `
      import {Foo} from './Foo'
      export const B = () => <Foo>B</Foo>
      `,
    })
    const output = await build(
      { experimentalBundling: true },
      {
        input: [
          path.join(dir, './fixture/entry-a.jsx'),
          path.join(dir, './fixture/entry-b.jsx'),
        ],
        rollupPlugins: [
          {
            name: 'alias',
            resolveId(source, importer) {
              if (source === 'bar' && importer) {
                return path.join(path.dirname(importer), 'bar.ts')
              }
            },
          },
        ],
      }
    )
    expect(
      output.map((o) => {
        return {
          code: o.type === 'chunk' ? o.code : o.source,
          path: o.fileName,
        }
      })
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "code": "// test/.temp/esbuild/bundle-simple/fixture/bar.ts
      var bar = \\"bar\\";

      // test/.temp/esbuild/bundle-simple/fixture/Foo.jsx
      var Foo = /* @__PURE__ */ React.createElement(\\"div\\", null, \\"foo \\", bar);

      // test/.temp/esbuild/bundle-simple/fixture/entry-a.jsx
      var A = () => /* @__PURE__ */ React.createElement(Foo, null, \\"A\\");

      export { A };
      ",
          "path": "entry-a.js",
        },
        Object {
          "code": "// test/.temp/esbuild/bundle-simple/fixture/bar.ts
      var bar = \\"bar\\";

      // test/.temp/esbuild/bundle-simple/fixture/Foo.jsx
      var Foo = /* @__PURE__ */ React.createElement(\\"div\\", null, \\"foo \\", bar);

      // test/.temp/esbuild/bundle-simple/fixture/entry-b.jsx
      var B = () => /* @__PURE__ */ React.createElement(Foo, null, \\"B\\");

      export { B };
      ",
          "path": "entry-b.js",
        },
      ]
    `)
  })
})
