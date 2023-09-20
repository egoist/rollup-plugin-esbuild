cd example
hyperfine "dum rollup-node-resolve" "dum esbuild-optimize-deps" --warmup 2
