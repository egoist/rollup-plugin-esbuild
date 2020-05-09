const { rollup } = require('rollup')
const esbuild = require('../src')

test('simple', async () => {
  const bundle = await rollup({
    input: __dirname + '/fixture/index.js',
    plugins: [esbuild()],
  })
  const { output } = await bundle.generate({
    format: 'esm',
  })
  expect(output[0].code).toMatchInlineSnapshot(`
    "class Foo {
      render() {
        return React.createElement(\\"div\\", {
          className: \\"hehe\\"
        }, \\"hello there!!!\\");
      }
    }

    console.log(Foo);
    "
  `)
})

test('minify', async () => {
  const bundle = await rollup({
    input: __dirname + '/fixture/index.js',
    plugins: [
      esbuild({
        minify: true,
      }),
    ],
  })
  const { output } = await bundle.generate({
    format: 'esm',
  })
  expect(output[0].code).toMatchInlineSnapshot(`
    "class Foo{render(){return React.createElement(\\"div\\",{className:\\"hehe\\"},\\"hello there!!!\\")}}console.log(Foo);
    "
  `)
})
