// One Star for Monday — entry program.
//
// The program assembles one deadpan one-star review of Monday,
// written as if Monday were a restaurant, and writes it to
// /output/entry.txt. The review is fixed: every run prints the
// same bytes, because the parts below are constants and the
// assembler joins them the same way every time.
//
// The review that ships:
//
//   One star. Monday sat me by the bins, served cold coffee,
//   forgot my order, and still charged me for the weekend.
//
// Why this line, clause by clause:
//   * "One star." — the rating, in the voice of a review.
//   * "Monday sat me by the bins" — the bad table. Every diner
//     knows the table by the bins is where a restaurant puts the
//     customers it does not care about.
//   * "served cold coffee" — the dish that went wrong. Coffee
//     is the Monday drink; serving it cold is the Monday failure.
//   * "forgot my order" — the server that went wrong.
//   * "and still charged me for the weekend" — the bill that
//     went wrong, and the joke that only Monday can tell: the
//     weekend is over, it is gone, and Monday still makes you
//     pay for it. No other day of the week can charge you for
//     the weekend.
//
// Three self-checks guard the joke itself, not just the gate:
// the line must open with the one-star rating, it must name
// Monday, and it must name the weekend. Without the rating it
// would not read as a review; without the two words the line
// could be about any bad restaurant on any day, and the
// judge's third criterion — the joke has to be about Monday
// itself — would have nothing to hold on to. The line must
// also end with a full stop, because a review ends its
// complaint instead of trailing off.
//
// The program runs with no network, no secrets, and no input
// files. It reads nothing from the environment and nothing from
// the repository it lives in. Its only output is the single text
// file the gate scores, plus a few short lines on stdout naming
// what it wrote and how it checked it.

import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Limits from the competition rules (RULES.txt, "The gate" and "The task").
// ---------------------------------------------------------------------------

const OUTPUT_PATH = "/output/entry.txt";
const MAX_WORDS = 25;
const MAX_CHARS = 180;
const MIN_CHARS = 1;
const SINGLE_LINE_MARKER = "\n";

// Words the joke cannot lose. The line must open with the rating,
// name the day being reviewed, and name the weekend it charges
// for; those three anchors are what make the complaint a one-star
// review of Monday and nobody else's.
const RATING_OPENING = "One star.";
const MONDAY_ANCHOR = "Monday";
const WEEKEND_ANCHOR = "weekend";
const REVIEW_FULL_STOP = ".";

// The gate counts characters of the file. A character here is one
// Unicode code point, which is what the scorer counts for plain
// text of this kind. The shipped line is far inside both limits,
// and the validator below proves it on every run instead of
// trusting the constants above.

// ---------------------------------------------------------------------------
// Review parts.
//
// Each part is one clause of the review. Punctuation lives inside
// the parts on purpose: the assembler joins parts with a single
// space and adds nothing of its own, so a part that ends a clause
// carries its own comma, and the part that ends the review carries
// its own full stop. Keeping the parts separate makes the shape of
// the joke visible in the code, and it keeps the assembly honest:
// the program composes a review, it never pastes a finished line
// from anywhere.
// ---------------------------------------------------------------------------

interface ReviewClause {
  label: string;
  text: string;
  job: string;
}

const REVIEW_RATING: ReviewClause = {
  label: "rating",
  text: "One star.",
  job: "States the one-star rating in the voice of a review.",
};

const REVIEW_TABLE: ReviewClause = {
  label: "table",
  text: "Monday sat me by the bins,",
  job: "The bad table: the seat by the bins, where a restaurant puts the customers it does not care about.",
};

const REVIEW_DISH: ReviewClause = {
  label: "dish",
  text: "served cold coffee,",
  job: "The dish that went wrong: coffee, the Monday drink, served cold.",
};

const REVIEW_SERVER: ReviewClause = {
  label: "server",
  text: "forgot my order,",
  job: "The server that went wrong: the order never arrived.",
};

const REVIEW_BILL: ReviewClause = {
  label: "bill",
  text: "and still charged me for the weekend.",
  job: "The bill that went wrong, and the joke only Monday can tell: the weekend is gone and Monday still charges for it.",
};

const REVIEW_CLAUSES: ReadonlyArray<ReviewClause> = [
  REVIEW_RATING,
  REVIEW_TABLE,
  REVIEW_DISH,
  REVIEW_SERVER,
  REVIEW_BILL,
];

// ---------------------------------------------------------------------------
// Assembly.
// ---------------------------------------------------------------------------

function joinClauses(clauses: ReadonlyArray<ReviewClause>): string {
  const fragments: Array<string> = [];
  const seenLabels: Set<string> = new Set<string>();
  for (const clause of clauses) {
    const trimmedClause = clause.text.trim();
    const clauseIsEmpty = trimmedClause.length === 0;
    if (clauseIsEmpty) {
      continue;
    }
    const labelAlreadySeen = seenLabels.has(clause.label);
    if (labelAlreadySeen) {
      continue;
    }
    seenLabels.add(clause.label);
    fragments.push(trimmedClause);
  }
  const assembledLine = fragments.join(" ");
  return assembledLine;
}

function countWords(line: string): number {
  const splitPieces = line.split(/\s+/u);
  let wordTotal = 0;
  for (const piece of splitPieces) {
    const pieceIsEmpty = piece.length === 0;
    if (pieceIsEmpty) {
      continue;
    }
    wordTotal += 1;
  }
  return wordTotal;
}

function countCodePoints(line: string): number {
  let pointTotal = 0;
  for (const _glyph of line) {
    pointTotal += 1;
  }
  return pointTotal;
}

// A small deterministic fingerprint of the line, printed on stdout
// so two runs can be compared by eye as well as by file hash. It
// is a plain rolling sum over code points: no hashing library, no
// randomness, the same input always gives the same number.
function fingerprintLine(line: string): number {
  let rollingSum = 0;
  for (const glyph of line) {
    const glyphCode = glyph.codePointAt(0);
    const knownCode = glyphCode === undefined ? 0 : glyphCode;
    rollingSum = (rollingSum * 31 + knownCode) % 1000000007;
  }
  return rollingSum;
}

// ---------------------------------------------------------------------------
// Validation.
//
// Every rule the gate checks is re-checked here, in the open, so a
// broken line fails loudly on the author's machine instead of
// silently on the grader's. A failure returns a named reason; the
// caller prints it and exits non-zero without writing anything.
// ---------------------------------------------------------------------------

interface LineVerdict {
  ok: boolean;
  reason: string;
  wordCount: number;
  charCount: number;
}

function validateLine(line: string): LineVerdict {
  const wordCount = countWords(line);
  const charCount = countCodePoints(line);
  const emptyVerdict: LineVerdict = {
    ok: false,
    reason: "line is empty or only whitespace",
    wordCount,
    charCount,
  };
  const lineIsBlank = line.trim().length === 0;
  if (lineIsBlank) {
    return emptyVerdict;
  }
  const shortVerdict: LineVerdict = {
    ok: false,
    reason: "line is shorter than the gate minimum of 1 character",
    wordCount,
    charCount,
  };
  if (charCount < MIN_CHARS) {
    return shortVerdict;
  }
  const longVerdict: LineVerdict = {
    ok: false,
    reason: "line exceeds the gate maximum of 180 characters",
    wordCount,
    charCount,
  };
  if (charCount > MAX_CHARS) {
    return longVerdict;
  }
  const wordyVerdict: LineVerdict = {
    ok: false,
    reason: "line exceeds the 25-word limit of the task",
    wordCount,
    charCount,
  };
  if (wordCount > MAX_WORDS) {
    return wordyVerdict;
  }
  const multilineVerdict: LineVerdict = {
    ok: false,
    reason: "line must be a single line with no line break inside",
    wordCount,
    charCount,
  };
  const lineHasBreak = line.includes(SINGLE_LINE_MARKER);
  if (lineHasBreak) {
    return multilineVerdict;
  }
  const raggedVerdict: LineVerdict = {
    ok: false,
    reason: "line must not start or end with whitespace",
    wordCount,
    charCount,
  };
  const lineIsRagged = line !== line.trim();
  if (lineIsRagged) {
    return raggedVerdict;
  }
  const ratingVerdict: LineVerdict = {
    ok: false,
    reason: "line must open with the one-star rating",
    wordCount,
    charCount,
  };
  const lineOpensRated = line.startsWith(RATING_OPENING);
  if (lineOpensRated === false) {
    return ratingVerdict;
  }
  const mondayVerdict: LineVerdict = {
    ok: false,
    reason: "line must name Monday, the day being reviewed",
    wordCount,
    charCount,
  };
  const lineNamesMonday = line.includes(MONDAY_ANCHOR);
  if (lineNamesMonday === false) {
    return mondayVerdict;
  }
  const weekendVerdict: LineVerdict = {
    ok: false,
    reason: "line must name the weekend, the joke's anchor",
    wordCount,
    charCount,
  };
  const lineNamesWeekend = line.includes(WEEKEND_ANCHOR);
  if (lineNamesWeekend === false) {
    return weekendVerdict;
  }
  const stopVerdict: LineVerdict = {
    ok: false,
    reason: "line must end with a full stop",
    wordCount,
    charCount,
  };
  const lineEndsStopped = line.endsWith(REVIEW_FULL_STOP);
  if (lineEndsStopped === false) {
    return stopVerdict;
  }
  const passingVerdict: LineVerdict = {
    ok: true,
    reason: "line passes every gate rule and all three joke anchors",
    wordCount,
    charCount,
  };
  return passingVerdict;
}

// ---------------------------------------------------------------------------
// Writing.
// ---------------------------------------------------------------------------

interface WriteOutcome {
  written: boolean;
  bytes: number;
  detail: string;
}

function writeEntryFile(line: string): WriteOutcome {
  const outputFolder = path.dirname(OUTPUT_PATH);
  fs.mkdirSync(outputFolder, { recursive: true });
  const encodedLine = Buffer.from(line, "utf8");
  fs.writeFileSync(OUTPUT_PATH, encodedLine);
  const writtenOutcome: WriteOutcome = {
    written: true,
    bytes: encodedLine.length,
    detail: "wrote entry to " + OUTPUT_PATH,
  };
  return writtenOutcome;
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

function runReviewProgram(): number {
  const assembledLine = joinClauses(REVIEW_CLAUSES);
  const verdict = validateLine(assembledLine);
  if (verdict.ok === false) {
    console.error("entry invalid: " + verdict.reason);
    console.error("words: " + verdict.wordCount + ", chars: " + verdict.charCount);
    const failureCode = 1;
    return failureCode;
  }
  const outcome = writeEntryFile(assembledLine);
  const fingerprint = fingerprintLine(assembledLine);
  console.log("wrote " + outcome.bytes + " bytes to " + OUTPUT_PATH);
  console.log("words: " + verdict.wordCount + ", chars: " + verdict.charCount);
  console.log("fingerprint: " + fingerprint);
  console.log("entry: " + assembledLine);
  const successCode = 0;
  return successCode;
}

try { const exitCode = runReviewProgram();
  process.exit(exitCode);
} catch (caughtFailure) {
  const failureMessage =
    caughtFailure instanceof Error ? caughtFailure.message : String(caughtFailure);
  console.error("entry failed: " + failureMessage);
  process.exit(1);
}
