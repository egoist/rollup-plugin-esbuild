import path from 'path'
import fs from 'fs'
import { rollup, Plugin as RollupPlugin, ModuleFormat } from 'rollup'
import esbuild, { minify } from '../src'

const realFs = (folderName: string, files: Record<string, string>) => {
  const tmpDir = path.join(__dirname, '.temp', `esbuild/${folderName}`)
  Object.keys(files).forEach((file) => {
    const absolute = path.join(tmpDir, file)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, files[file], 'utf8')
  })
  return tmpDir
}

const getTestName = () => expect.getState().currentTestName

const build = async ({
  input = './fixture/index.js',
  sourcemap = false,
  rollupPlugins = [],
  dir = '.',
  format = 'esm',
}: {
  input?: string | string[]
  sourcemap?: boolean
  rollupPlugins?: RollupPlugin[]
  dir?: string
  format?: ModuleFormat
} = {}) => {
  const build = await rollup({
    input: [...(Array.isArray(input) ? input : [input])].map((v) =>
      path.resolve(dir, v)
    ),
    plugins: rollupPlugins,
  })
  const { output } = await build.generate({
    format,
    sourcemap,
    exports: 'auto',
  })
  return output
}

describe('esbuild plugin', () => {
  test('simple', async () => {
    const dir = realFs(getTestName(), {
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
    const output = await build({
      dir,
      rollupPlugins: [esbuild({})],
    })
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
    const dir = realFs(getTestName(), {
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
    const output = await build({
      dir,
      rollupPlugins: [esbuild({ minify: true })],
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "class e{render(){return React.createElement(\\"div\\",{className:\\"hehe\\"},\\"hello there!!!\\")}}console.log(e);
      "
    `)
  })

  test('charset', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        console.log('π')
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [esbuild({ charset: 'utf8' })],
      format: 'esm',
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "console.log(\\"π\\");
      "
    `)
  })

  test('keepNames', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        export default class Foo {}
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [esbuild({ minify: true, keepNames: true })],
      format: 'cjs',
    })
    expect(eval(output[0].code).name).toBe('Foo')
    expect(output[0].code).toMatchInlineSnapshot(`
      "\\"use strict\\";var o=Object.defineProperty;var a=(e,r)=>o(e,\\"name\\",{value:r,configurable:!0});var s=Object.defineProperty,c=a((e,r)=>s(e,\\"name\\",{value:r,configurable:!0}),\\"e\\");class t{}a(t,\\"l\\"),c(t,\\"Foo\\"),module.exports=t;
      "
    `)
  })

  test('minify whitespace only', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        console.log(1 === 1);
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [esbuild({ minifyWhitespace: true })],
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "console.log(true);
      "
    `)
  })

  test('minify syntax only', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        console.log(1 === 1);
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [esbuild({ minifySyntax: true })],
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "console.log(!0);
      "
    `)
  })

  test('minify cjs', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
      const minifyMe = true
      console.log(minifyMe);
      export {minifyMe}
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [esbuild({ minify: true })],
      format: 'commonjs',
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "\\"use strict\\";Object.defineProperty(exports,\\"__esModule\\",{value:!0});const e=!0;console.log(!0),exports.minifyMe=e;
      "
    `)
  })

  test('minify iife', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
      const minifyMe = true
      console.log(minifyMe);
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [esbuild({ minify: true })],
      format: 'iife',
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "(function(){\\"use strict\\";console.log(!0)})();
      "
    `)
  })

  test('minify umd', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
      const minifyMe = true
      console.log(minifyMe);
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [esbuild({ minify: true })],
      format: 'umd',
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "(function(n){typeof define==\\"function\\"&&define.amd?define(n):n()})(function(){\\"use strict\\";console.log(!0)});
      "
    `)
  })

  test('legal comments none', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `/** @preserve comment */
        /*!
         * comment
         */
        //! comment
        console.log(1 === 1);
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [esbuild({ minify: true, legalComments: 'none' })],
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "console.log(!0);
      "
    `)
  })

  test('load index.(x)', async () => {
    const dir = realFs(getTestName(), {
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

    const output = await build({
      dir,
      rollupPlugins: [esbuild({})],
    })
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

  test('load jsx/tsx', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        import Foo from './foo.jsx'
  
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

    const output = await build({
      dir,
      rollupPlugins: [esbuild({})],
    })
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
    const dir = realFs(getTestName(), {
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
      dir,
      rollupPlugins: [
        esbuild({
          loaders: {
            '.json': 'json',
          },
        }),
      ],
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
    const dir = realFs(getTestName(), {
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

    const output = await build({
      input: './fixture/index.jsx',
      dir,
      rollupPlugins: [esbuild({})],
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "const foo = /* @__PURE__ */ h(\\"div\\", null, \\"foo\\");

      export { foo };
      "
    `)
  })

  test('use custom tsconfig.json', async () => {
    const dir = realFs(getTestName(), {
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

    const output = await build({
      input: './fixture/index.jsx',
      dir,
      rollupPlugins: [esbuild({ tsconfig: 'tsconfig.build.json' })],
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "const foo = /* @__PURE__ */ custom(\\"div\\", null, \\"foo\\");

      export { foo };
      "
    `)
  })
})

describe('minify plugin', () => {
  test('minify esm', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
      const minifyMe = true
      console.log(minifyMe);
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [minify()],
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "const e=!0;console.log(!0);
      "
    `)
  })

  test('minify cjs', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
      const minifyMe = true
      console.log(minifyMe);
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [minify()],
      format: 'commonjs',
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "\\"use strict\\";const e=!0;console.log(!0);
      "
    `)
  })

  test('minify with target option', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
      const a = !!''.toString
      const b = a ?? 2
      console.log(b)
      `,
    })
    const output = await build({
      dir,
      rollupPlugins: [minify({ target: 'chrome58' })],
    })
    expect(output[0].code).toMatchInlineSnapshot(`
      "const o=!!\\"\\".toString,n=o!=null?o:2;console.log(n);
      "
    `)
  })
})

describe('optimizeDeps', () => {
  test('simple', async () => {
    const dir = realFs(getTestName(), {
      './index.ts': `import React from 'react';import * as Vue from 'vue';export {React,Vue}`,
    })
    const output = await build({
      input: [path.join(dir, './index.ts')],
      rollupPlugins: [
        esbuild({
          optimizeDeps: {
            include: ['react', 'vue'],
          },
        }),
      ],
    })

    expect(output[0].code).not.toContain('import ')
  })
})
