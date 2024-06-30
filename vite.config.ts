import { defineConfig } from "vite"
import { qrcode } from "vite-plugin-qrcode"
import dusk from "vite-plugin-dusk"
import path from "node:path"

// https://vitejs.dev/config/
export default defineConfig({
  base: "", // Makes paths relative
  plugins: [
    qrcode(), // only applies in dev mode
    dusk({ logicPath: path.resolve("./src/logic.ts") }),
  ],
})
