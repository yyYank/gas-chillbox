import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// GAS は静的ファイルを配れないので、JS/CSS を 1 枚の HTML に固めて
// clasp の push 対象（viewer/src/index.html）へ直接出力する。
export default defineConfig({
  root: 'app',
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: '../viewer/src',
    emptyOutDir: false,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
})
