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
      "\\"use strict\\";var r=Object.defineProperty;var t=(s,e)=>r(s,\\"name\\",{value:e,configurable:!0});class c{}t(c,\\"Foo\\"),module.exports=c;
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
      "\\"use strict\\";Object.defineProperty(exports,\\"__esModule\\",{value:!0});const e=!0;console.log(e),exports.minifyMe=e;
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
      "const o=!0;console.log(o);
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
      "\\"use strict\\";const e=!0;console.log(e);
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

describe('bundle', () => {
  test('simple', async () => {
    const dir = realFs(getTestName(), {
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
    const output = await build({
      input: [
        path.join(dir, './fixture/entry-a.jsx'),
        path.join(dir, './fixture/entry-b.jsx'),
      ],
      rollupPlugins: [
        esbuild({ experimentalBundling: true }),
        {
          name: 'alias',
          resolveId(source, importer) {
            if (source === 'bar' && importer) {
              return path.join(path.dirname(importer), 'bar.ts')
            }
          },
        },
      ],
    })
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
          "code": "// test/.temp/esbuild/bundle simple/fixture/bar.ts
      var bar = \\"bar\\";

      // test/.temp/esbuild/bundle simple/fixture/Foo.jsx
      var Foo = /* @__PURE__ */ React.createElement(\\"div\\", null, \\"foo \\", bar);

      // test/.temp/esbuild/bundle simple/fixture/entry-a.jsx
      var A = () => /* @__PURE__ */ React.createElement(Foo, null, \\"A\\");

      export { A };
      ",
          "path": "entry-a.js",
        },
        Object {
          "code": "// test/.temp/esbuild/bundle simple/fixture/bar.ts
      var bar = \\"bar\\";

      // test/.temp/esbuild/bundle simple/fixture/Foo.jsx
      var Foo = /* @__PURE__ */ React.createElement(\\"div\\", null, \\"foo \\", bar);

      // test/.temp/esbuild/bundle simple/fixture/entry-b.jsx
      var B = () => /* @__PURE__ */ React.createElement(Foo, null, \\"B\\");

      export { B };
      ",
          "path": "entry-b.js",
        },
      ]
    `)
  })
})
