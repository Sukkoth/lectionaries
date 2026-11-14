import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ASSETS_DIR } from "../config";

export interface SatoriVNode {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: SatoriVNode | (SatoriVNode | string | null)[] | string | null;
    src?: string;
    width?: string | number;
    height?: string | number;
  };
}

export interface VerseCardData {
  headerDate: string;
  title: string | null;
  description: string | null;
  seasonColor: string | null;
  versionName: string;
  versionCode?: string;
  readings: {
    section: string;
    reference: string;
    textSnippet: string | null;
  }[];
}

const backgroundCache = new Map<string, string>();

const BACKGROUND_FILES = [
  "landscape_mountain.jpg",
  "misty_forest.jpg",
  "sunset_clouds.jpg",
  "evening_clouds_sunset.jpg",
  "gentle_sea.jpg",
  "ocean_shore.jpg",
  "nature_valley.jpg",
  "mountain_river.jpg",
  "pine_trees.jpg",
  "lake_cabin.jpg",
  "peaks_mist.jpg",
  "desert_dunes.jpg",
  "warm_sunlight.jpg",
  "winter_snow_trees.jpg",
  "abstract_acrylic_colors.jpg",
  "abstract_fluid_waves.jpg",
  "abstract_minimal_1.jpg",
  "abstract_neon_smoke.jpg",
  "abstract_oil_1.jpg",
  "abstract_architecture_minimal.jpg",
];

/**
 * Loads a background image as a base64 Data URI for Satori.
 * Selects randomly from available scenic wallpaper backdrops.
 */
function getBackgroundImageUri(): string {
  const randomIndex = Math.floor(Math.random() * BACKGROUND_FILES.length);
  const fileName = BACKGROUND_FILES[randomIndex] || "landscape_mountain.jpg";

  if (backgroundCache.has(fileName)) {
    return backgroundCache.get(fileName)!;
  }

  try {
    const filePath = join(ASSETS_DIR, "backgrounds", fileName);
    const buf = readFileSync(filePath);
    const dataUri = `data:image/jpeg;base64,${buf.toString("base64")}`;
    backgroundCache.set(fileName, dataUri);
    return dataUri;
  } catch {
    return "";
  }
}

/**
 * Converts section codes like "OLD_TESTAMENT", "EPISTLE", "GOSPEL" to clean Sentence Case.
 */
function formatSectionSentenceCase(section: string): string {
  const cleaned = section.replace(/_/g, " ").toLowerCase().trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Calculates dynamic typography parameters for the main scripture verse.
 * Adjusts font size, line height, and bottom margin based on character count.
 */
function getVerseTypography(length: number): {
  fontSize: string;
  lineHeight: number;
  marginBottom: string;
} {
  if (length <= 70) {
    return { fontSize: "62px", lineHeight: 1.35, marginBottom: "36px" };
  }
  if (length <= 130) {
    return { fontSize: "52px", lineHeight: 1.4, marginBottom: "32px" };
  }
  if (length <= 220) {
    return { fontSize: "44px", lineHeight: 1.45, marginBottom: "28px" };
  }
  if (length <= 320) {
    return { fontSize: "38px", lineHeight: 1.5, marginBottom: "24px" };
  }
  return { fontSize: "32px", lineHeight: 1.55, marginBottom: "20px" };
}

/**
 * Builds an authentic photographic wallpaper aesthetic with natural typography.
 * Dimensions: 1080 x 1350 (4:5 portrait)
 */
export function buildCardVNode(data: VerseCardData): SatoriVNode {
  const bgDataUri = getBackgroundImageUri();
  const isMultiReading = data.readings.length >= 3;
  const versionTag = (data.versionCode || data.versionName).toUpperCase();

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1350px",
        position: "relative",
        boxSizing: "border-box",
        background: "#161b22",
      },
      children: [
        bgDataUri
          ? {
              type: "img",
              props: {
                src: bgDataUri,
                style: {
                  position: "absolute",
                  top: "0px",
                  left: "0px",
                  width: "1080px",
                  height: "1350px",
                  objectFit: "cover",
                },
              },
            }
          : null,
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: "0px",
              left: "0px",
              width: "1080px",
              height: "1350px",
              background:
                "linear-gradient(180deg, rgba(10, 15, 25, 0.45) 0%, rgba(10, 15, 25, 0.62) 65%, rgba(10, 15, 25, 0.90) 100%)",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "100%",
              height: "100%",
              padding: "70px 80px",
              boxSizing: "border-box",
              position: "relative",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          marginBottom: "20px",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontSize: "17px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "4px",
                                color: "#f3c969",
                                fontFamily: "Cinzel, Noto Serif Ethiopic",
                                textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
                              },
                              children: data.headerDate,
                            },
                          },
                        ],
                      },
                    },
                    data.title
                      ? {
                          type: "div",
                          props: {
                            style: {
                              fontSize: isMultiReading ? "42px" : "38px",
                              fontFamily:
                                "Cinzel, Playfair Display, Noto Serif Ethiopic",
                              fontWeight: 700,
                              color: "#ffffff",
                              lineHeight: 1.25,
                              marginBottom: "16px",
                              textShadow: "0 2px 14px rgba(0, 0, 0, 0.6)",
                              letterSpacing: "1px",
                            },
                            children: data.title,
                          },
                        }
                      : null,
                    !isMultiReading && data.description
                      ? {
                          type: "div",
                          props: {
                            style: {
                              fontSize: "20px",
                              fontFamily:
                                "Playfair Display, Noto Serif Ethiopic",
                              fontStyle: "italic",
                              color: "rgba(255, 255, 255, 0.88)",
                              lineHeight: 1.45,
                              maxWidth: "800px",
                              textShadow: "0 1px 8px rgba(0, 0, 0, 0.5)",
                            },
                            children: data.description,
                          },
                        }
                      : null,
                  ].filter(Boolean),
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMultiReading ? "center" : "flex-start",
                    justifyContent: isMultiReading ? "center" : "flex-end",
                    flex: isMultiReading ? 1 : undefined,
                    width: "100%",
                    marginBottom: isMultiReading ? "0px" : "40px",
                  },
                  children: isMultiReading
                    ? [
                        {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "100%",
                            },
                            children: [
                              data.description
                                ? {
                                    type: "div",
                                    props: {
                                      style: {
                                        fontSize: "48px",
                                        fontFamily:
                                          "Playfair Display, Noto Serif Ethiopic",
                                        fontStyle: "italic",
                                        fontWeight: 700,
                                        color: "#ffffff",
                                        textAlign: "center",
                                        lineHeight: 1.3,
                                        maxWidth: "920px",
                                        marginBottom: "52px",
                                        textShadow:
                                          "0 2px 8px rgba(0, 0, 0, 0.4)",
                                        letterSpacing: "0.5px",
                                      },
                                      children: data.description,
                                    },
                                  }
                                : null,
                              {
                                type: "div",
                                props: {
                                  style: {
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "100%",
                                    gap: "28px",
                                  },
                                  children: data.readings.map((r) => ({
                                    type: "div",
                                    props: {
                                      style: {
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        textAlign: "center",
                                        width: "100%",
                                      },
                                      children: [
                                        {
                                          type: "div",
                                          props: {
                                            style: {
                                              fontSize: "15px",
                                              fontWeight: 600,
                                              letterSpacing: "1.5px",
                                              color:
                                                "rgba(255, 255, 255, 0.75)",
                                              fontFamily:
                                                "Playfair Display, Noto Serif Ethiopic",
                                              fontStyle: "italic",
                                              marginBottom: "4px",
                                              textShadow:
                                                "0 1px 4px rgba(0, 0, 0, 0.35)",
                                            },
                                            children: formatSectionSentenceCase(
                                              r.section
                                            ),
                                          },
                                        },
                                        {
                                          type: "div",
                                          props: {
                                            style: {
                                              fontSize: "30px",
                                              fontFamily:
                                                "Cinzel, Playfair Display, Noto Serif Ethiopic",
                                              fontWeight: 700,
                                              color: "#ffffff",
                                              letterSpacing: "1px",
                                              textShadow:
                                                "0 2px 6px rgba(0, 0, 0, 0.4)",
                                            },
                                            children: r.reference,
                                          },
                                        },
                                      ],
                                    },
                                  })),
                                },
                              },
                            ].filter(Boolean),
                          },
                        },
                      ]
                    : data.readings.map((r) => {
                        const typo = getVerseTypography(
                          r.textSnippet?.length ?? 100
                        );
                        return {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              textAlign: "left",
                              width: "100%",
                              maxWidth: "940px",
                            },
                            children: [
                              r.textSnippet
                                ? {
                                    type: "div",
                                    props: {
                                      style: {
                                        fontSize: typo.fontSize,
                                        lineHeight: typo.lineHeight,
                                        fontFamily:
                                          "Playfair Display, Noto Serif Ethiopic",
                                        color: "#ffffff",
                                        marginBottom: typo.marginBottom,
                                        textShadow:
                                          "0 3px 20px rgba(0, 0, 0, 0.7)",
                                        letterSpacing: "-0.5px",
                                      },
                                      children: r.textSnippet,
                                    },
                                  }
                                : null,
                              {
                                type: "div",
                                props: {
                                  style: {
                                    display: "flex",
                                    alignItems: "center",
                                    fontSize: "24px",
                                    fontWeight: 700,
                                    letterSpacing: "2.5px",
                                    textTransform: "uppercase",
                                    color: "#f3c969",
                                    fontFamily: "Cinzel, Noto Serif Ethiopic",
                                    textShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
                                  },
                                  children: `— ${r.reference} (${versionTag})`,
                                },
                              },
                            ].filter(Boolean),
                          },
                        };
                      }),
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    paddingTop: "20px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.15)",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "14px",
                          letterSpacing: "2.5px",
                          color: "rgba(255, 255, 255, 0.7)",
                          fontWeight: 700,
                          fontFamily: "Cinzel, Noto Serif Ethiopic",
                        },
                        children: "EECMY LECTIONARY",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "15px",
                          letterSpacing: "1px",
                          color: "rgba(255, 255, 255, 0.65)",
                          fontWeight: 400,
                          fontFamily: "Playfair Display, Noto Serif Ethiopic",
                        },
                        children: "@eecmy_lectionary_bot",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ].filter(Boolean),
    },
  };
}
