import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { buildCardVNode, type VerseCardData } from "./template";

let fontsCache:
  { name: string; data: Buffer; weight: 400 | 700; style: "normal" }[] | null =
  null;

/**
 * Loads and caches font binary files from assets/fonts.
 */
function loadFonts() {
  if (fontsCache) {
    return fontsCache;
  }

  const fontsDir = join(process.cwd(), "assets", "fonts");

  const notoRegular = readFileSync(join(fontsDir, "NotoSans-Regular.ttf"));
  const notoBold = readFileSync(join(fontsDir, "NotoSans-Bold.ttf"));
  const ethiopicRegular = readFileSync(
    join(fontsDir, "NotoSansEthiopic-Regular.ttf")
  );
  const ethiopicBold = readFileSync(
    join(fontsDir, "NotoSansEthiopic-Bold.ttf")
  );
  const playfair = readFileSync(join(fontsDir, "PlayfairDisplay-Regular.ttf"));
  const cinzelRegular = readFileSync(join(fontsDir, "Cinzel-Regular.ttf"));
  const cinzelBold = readFileSync(join(fontsDir, "Cinzel-Bold.ttf"));
  const ethiopicSerifRegular = readFileSync(
    join(fontsDir, "NotoSerifEthiopic-Regular.ttf")
  );
  const ethiopicSerifBold = readFileSync(
    join(fontsDir, "NotoSerifEthiopic-Bold.ttf")
  );
  const caveat = readFileSync(join(fontsDir, "Caveat-Bold.ttf"));

  fontsCache = [
    {
      name: "Cinzel",
      data: cinzelRegular,
      weight: 400,
      style: "normal",
    },
    {
      name: "Cinzel",
      data: cinzelBold,
      weight: 700,
      style: "normal",
    },
    {
      name: "Playfair Display",
      data: playfair,
      weight: 700,
      style: "normal",
    },
    {
      name: "Caveat",
      data: caveat,
      weight: 700,
      style: "normal",
    },
    {
      name: "Noto Serif Ethiopic",
      data: ethiopicSerifRegular,
      weight: 400,
      style: "normal",
    },
    {
      name: "Noto Serif Ethiopic",
      data: ethiopicSerifBold,
      weight: 700,
      style: "normal",
    },
    {
      name: "Noto Sans",
      data: notoRegular,
      weight: 400,
      style: "normal",
    },
    {
      name: "Noto Sans",
      data: notoBold,
      weight: 700,
      style: "normal",
    },
    {
      name: "Noto Sans Ethiopic",
      data: ethiopicRegular,
      weight: 400,
      style: "normal",
    },
    {
      name: "Noto Sans Ethiopic",
      data: ethiopicBold,
      weight: 700,
      style: "normal",
    },
  ];

  return fontsCache;
}

/**
 * Renders scripture verse card data into a high-resolution PNG image buffer.
 */
export async function renderVerseCard(data: VerseCardData): Promise<Buffer> {
  const fonts = loadFonts();
  const vnode = buildCardVNode(data);

  const svg = await satori(vnode as Parameters<typeof satori>[0], {
    width: 1080,
    height: 1350,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: 1080,
    },
  });

  const pngData = resvg.render();
  return pngData.asPng();
}
