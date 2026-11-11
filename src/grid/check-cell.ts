import { isColour } from "./colours.js";
import { contrastRatio, isLegibleText } from "./contrast.js";
import { formatCodePoint, type GridViolation, locate, quoteIfSafe } from "./grid-violation.js";
import { isRepertoireCodePoint } from "./repertoire.js";
import type { Cell, MosaicCell, TextCell } from "./types.js";

const TEXT_FIELDS: ReadonlySet<string> = new Set(["kind", "ch", "fg", "bg", "conceal"]);
const MOSAIC_FIELDS: ReadonlySet<string> = new Set([
  "kind",
  "bits",
  "separated",
  "fg",
  "bg",
  "conceal",
]);

/** The result of checking one cell: its violations, and a frozen copy when there are none. */
export interface CellCheck {
  readonly violations: GridViolation[];
  readonly cell: Cell | undefined;
}

/** Reads one property. A getter or Proxy trap that throws propagates to the caller. */
function readField(source: object, key: string): unknown {
  return Reflect.get(source, key);
}

/** The code point of a string that holds exactly one code point, otherwise `undefined`. */
function singleCodePoint(text: string): number | undefined {
  const cp = text.codePointAt(0);
  if (cp === undefined) return undefined;
  return text.length === (cp > 0xffff ? 2 : 1) ? cp : undefined;
}

/**
 * Checks one cell against the rules of requirement 9, in that order. Never throws: a cell that
 * cannot be read gives one `unreadable` violation at its row and column.
 */
export function checkCell(value: unknown, row: number, col: number): CellCheck {
  try {
    return inspectCell(value, row, col);
  } catch {
    return {
      violations: [
        { code: "unreadable", row, col, message: `${locate(row, col)}cell could not be read` },
      ],
      cell: undefined,
    };
  }
}

function inspectCell(value: unknown, row: number, col: number): CellCheck {
  const at = locate(row, col);
  const violations: GridViolation[] = [];

  // Requirement 9.1
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      violations: [{ code: "cell-not-object", row, col, message: `${at}cell is not an object` }],
      cell: undefined,
    };
  }

  // Requirement 9.2: an unknown kind ends the check of this cell.
  const kind = readField(value, "kind");
  if (kind !== "text" && kind !== "mosaic") {
    return {
      violations: [
        { code: "cell-kind", row, col, message: `${at}kind must be "text" or "mosaic"` },
      ],
      cell: undefined,
    };
  }

  // Requirement 9.3: one violation per key the kind does not define, in ascending code unit order.
  const defined = kind === "text" ? TEXT_FIELDS : MOSAIC_FIELDS;
  const unknownKeys = Object.keys(value)
    .filter((name) => !defined.has(name))
    .sort();
  for (const key of unknownKeys) {
    const quoted = quoteIfSafe(key);
    const field = quoted === undefined ? "" : ` ${quoted}`;
    violations.push({
      code: "cell-field-unknown",
      row,
      col,
      field: key,
      message: `${at}unknown field${field}`,
    });
  }

  // Every field is read once here, so a getter cannot give two checks two different values.
  const ch = kind === "text" ? readField(value, "ch") : undefined;
  const bits = kind === "mosaic" ? readField(value, "bits") : undefined;
  const separated = kind === "mosaic" ? readField(value, "separated") : undefined;
  const fg = readField(value, "fg");
  const bg = readField(value, "bg");
  const conceal = readField(value, "conceal");

  // Requirements 9.4 and 9.5 for text, 9.6 and 9.7 for mosaics.
  let validCh: number | undefined;
  if (kind === "text") {
    const cp = typeof ch === "string" ? singleCodePoint(ch) : undefined;
    if (cp === undefined) {
      violations.push({
        code: "text-ch",
        row,
        col,
        message: `${at}ch must be exactly one code point`,
      });
    } else if (!isRepertoireCodePoint(cp)) {
      violations.push({
        code: "text-repertoire",
        row,
        col,
        codePoint: cp,
        message: `${at}${formatCodePoint(cp)} is not in the repertoire`,
      });
    } else {
      validCh = cp;
    }
  } else {
    if (typeof bits !== "number" || !Number.isInteger(bits) || bits < 1 || bits > 63) {
      violations.push({
        code: "mosaic-bits",
        row,
        col,
        message: `${at}bits must be an integer from 1 to 63; a blank cell is a text space`,
      });
    }
    if (typeof separated !== "boolean") {
      violations.push({
        code: "mosaic-separated",
        row,
        col,
        message: `${at}separated must be true or false`,
      });
    }
  }

  // Requirement 9.8
  if (!isColour(fg)) {
    violations.push({
      code: "colour",
      row,
      col,
      field: "fg",
      message: `${at}fg is not one of the eight colours`,
    });
  }
  if (!isColour(bg)) {
    violations.push({
      code: "colour",
      row,
      col,
      field: "bg",
      message: `${at}bg is not one of the eight colours`,
    });
  }

  // Requirement 9.9
  if (typeof conceal !== "boolean") {
    violations.push({ code: "conceal", row, col, message: `${at}conceal must be true or false` });
  }

  // Requirement 9.10: text other than a space must meet 4.5:1, whether or not it is concealed.
  if (
    validCh !== undefined &&
    validCh !== 0x20 &&
    isColour(fg) &&
    isColour(bg) &&
    !isLegibleText(fg, bg)
  ) {
    const ratio = contrastRatio(fg, bg);
    violations.push({
      code: "contrast",
      row,
      col,
      fg,
      bg,
      ratio,
      message: `${at}${fg} on ${bg} is ${ratio.toFixed(2)}:1, below 4.5:1`,
    });
  }

  if (violations.length > 0) {
    return { violations, cell: undefined };
  }

  // Every check above passed, so the guards below hold. If one did not, the cell is rejected
  // as unreadable rather than accepted.
  const cell = buildCell(kind, { ch, bits, separated, fg, bg, conceal });
  if (cell === undefined) {
    return {
      violations: [{ code: "unreadable", row, col, message: `${at}cell could not be read` }],
      cell: undefined,
    };
  }
  return { violations, cell };
}

interface CellFields {
  readonly ch: unknown;
  readonly bits: unknown;
  readonly separated: unknown;
  readonly fg: unknown;
  readonly bg: unknown;
  readonly conceal: unknown;
}

/** Builds the frozen cell from fields that were read once and have been checked. */
function buildCell(kind: "text" | "mosaic", fields: CellFields): Cell | undefined {
  const { fg, bg, conceal } = fields;
  if (!isColour(fg) || !isColour(bg) || typeof conceal !== "boolean") return undefined;
  if (kind === "text") {
    const { ch } = fields;
    if (typeof ch !== "string") return undefined;
    const text: TextCell = { kind: "text", ch, fg, bg, conceal };
    return Object.freeze(text);
  }
  const { bits, separated } = fields;
  if (typeof bits !== "number" || typeof separated !== "boolean") return undefined;
  const mosaic: MosaicCell = { kind: "mosaic", bits, separated, fg, bg, conceal };
  return Object.freeze(mosaic);
}
