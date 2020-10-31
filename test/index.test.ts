import { rollup } from 'rollup'
import mockfs from 'mock-fs'
import esbuild, { Options } from '../src'

const build = async (
  options?: Options,
  { input = './fixture/index.js' } = {}
) => {
  const bundle = await rollup({
    input,
    plugins: [esbuild(options)],
  })
  const { output } = await bundle.generate({ format: 'esm' })
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
