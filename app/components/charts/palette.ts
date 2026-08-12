/**
 * Chart colour tokens. Separate from the app's UI palette on purpose: the interface navy
 * (#1F3864) and its two tints read as one hue to a colour-blind reader, which is fine for chrome
 * but not for encoding identity.
 *
 * These three are the validated categorical slots, checked all-pairs against the white chart
 * surface:
 *   Lightness band      PASS   Chroma floor        PASS
 *   CVD separation      PASS   worst pair ΔE 9.2 (deutan) / 9.6 (tritan), target ≥ 8
 *   Normal-vision floor PASS   worst pair ΔE 24.0, floor ≥ 15
 *   Contrast            WARN   aqua 2.82:1 — relief is the value label printed beside every
 *                              legend entry, so no slice depends on colour alone.
 * Assign them in order and never cycle: a fourth fund classification takes slot 4 from the same
 * scale, it does not get a generated hue.
 */
export const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;

/**
 * Emphasis pair for the utilisation bars: the part that matters carries the hue, the remainder
 * recedes. Not a two-colour categorical palette — NEUTRAL is deliberately below the chroma floor
 * because it means "nothing has happened here yet".
 */
export const SERIES_PRIMARY = CATEGORICAL[0];
export const NEUTRAL = "#D1D9E6";

/** The chart surface. Fills are separated by a 2px seam in this colour rather than by a border. */
export const SURFACE = "#FFFFFF";

/** Recessive chrome — one shade off the surface, solid hairlines, never dashed. */
export const GRID = "#EEF2F7";
export const AXIS_TEXT = "#6B7A99";
