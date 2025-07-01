const Red = Symbol("Red");
const Blue = Symbol("Blue");
const Grey = Symbol("Grey");
type Color = typeof Red | typeof Blue | typeof Grey;
type ActiveColor = Omit<Color, typeof Grey>;

type Row = Color[];
type Column = Color[];
type Board = Row[];

const rows = (board: Board): Row[] => board;
const columns = (board: Board): Column[] =>
  new Array(board.length)
    .fill(null)
    .map((_, column) => board.map((row): Color => row[column]));

// Board rules
const ThriceRepetition = Symbol("Thrice Repetition");
const OverSaturation = Symbol("No Over Saturation");
const LineRepetition = Symbol("Line Repetition");

type ThriceRepetitionViolation = {
  [ThriceRepetition]:
    & (
      | {
        column: number;
        rows: [number, number, number];
      }
      | {
        row: number;
        columns: [number, number, number];
      }
    )
    & {
      color: ActiveColor;
    };
};

type OverSaturationViolation = {
  [OverSaturation]:
    & (
      | {
        column: number;
      }
      | {
        row: number;
      }
    )
    & {
      color: ActiveColor;
      positionVector: number[];
    };
};

type LineRepetitionViolation = {
  [LineRepetition]:
    | {
      columns: [number, number];
    }
    | {
      rows: [number, number];
    };
};

type Violation =
  | ThriceRepetitionViolation
  | OverSaturationViolation
  | LineRepetitionViolation;

const findThriceRepetitionRow = (
  row: Row,
): {
  columns: [number, number, number];
  color: ActiveColor;
} | null => {
  for (const [index, c3] of row.entries()) {
    if (index < 2) {
      continue;
    }
    const c2 = row[index - 1];
    const c1 = row[index - 2];

    if (c1 !== Grey && c1 === c2 && c1 === c3) {
      return { columns: [index - 2, index - 1, index], color: c1 };
    }
  }

  return null;
};
const findThriceRepetition = (
  board: Board,
): ThriceRepetitionViolation | null => {
  for (const [index, row] of rows(board).entries()) {
    const violation = findThriceRepetitionRow(row);

    if (violation) {
      return {
        [ThriceRepetition]: {
          row: index,
          columns: violation.columns,
          color: violation.color,
        },
      };
    }
  }

  for (const [index, column] of columns(board).entries()) {
    const violation = findThriceRepetitionRow(column);

    if (violation) {
      return {
        [ThriceRepetition]: {
          column: index,
          rows: violation.columns,
          color: violation.color,
        },
      };
    }
  }

  return null;
};

const positionVectors = (row: Row) =>
  row.reduce(
    (positions, color, index) => {
      positions[color].push(index);

      return positions;
    },
    {
      [Red]: [] as number[],
      [Blue]: [] as number[],
      [Grey]: [] as number[],
    },
  );

const findOverSaturationRow = (
  row: Row,
): {
  positionVector: number[];
  color: ActiveColor;
} | null => {
  const vectors = positionVectors(row);

  if (2 * vectors[Red].length > row.length) {
    return {
      positionVector: vectors[Red],
      color: Red,
    };
  }

  if (2 * vectors[Blue].length > row.length) {
    return {
      positionVector: vectors[Blue],
      color: Blue,
    };
  }

  return null;
};

const findOverSaturation = (board: Board): OverSaturationViolation | null => {
  for (const [index, row] of rows(board).entries()) {
    const violation = findOverSaturationRow(row);

    if (violation) {
      return {
        [OverSaturation]: {
          row: index,
          positionVector: violation.positionVector,
          color: violation.color,
        },
      };
    }
  }

  for (const [index, column] of columns(board).entries()) {
    const violation = findOverSaturationRow(column);

    if (violation) {
      return {
        [OverSaturation]: {
          column: index,
          positionVector: violation.positionVector,
          color: violation.color,
        },
      };
    }
  }

  return null;
};

const rowsCanEqual = (r1: Row, r2: Row) =>
  r1.reduce((equal, c1, i) => {
    if (!equal) {
      return false;
    }

    const c2 = r2[i];

    if (c1 === Grey || c2 === Grey) {
      return true;
    }

    return c1 === c2;
  }, true);

const rowsMustEqual = (r1: Row, r2: Row) => {
  for (const c of [Red, Blue] as const) {
    const matchCount = r1.reduce(
      (total, c1, i) => total + (c === c1 && c === r2[i] ? 1 : 0),
      0,
    );

    if (2 * matchCount >= r1.length) {
      return false;
    }
  }

  return true;
};

const findRepeatedRows = (
  rows: Row[],
): {
  rows: [number, number];
} | null => {
  const keyToRowIndex = new Map<string, number>();
  for (const [index, row] of rows.entries()) {
    const vectors = positionVectors(row);

    if (2 * vectors[Red].length >= row.length) {
      const key = `Red::${vectors[Red].join(":")}`;
      const matchingRowIndex = keyToRowIndex.get(key);
      if (matchingRowIndex) {
        return { rows: [matchingRowIndex, index] };
      }

      keyToRowIndex.set(key, index);
    }

    if (2 * vectors[Blue].length >= row.length) {
      const key = `Blue::${vectors[Blue].join(":")}`;
      const matchingRowIndex = keyToRowIndex.get(key);
      if (matchingRowIndex) {
        return { rows: [matchingRowIndex, index] };
      }

      keyToRowIndex.set(key, index);
    }
  }

  return null;
};

const findLineRepetition = (board: Board): LineRepetitionViolation | null => {
  const rowViolation = findRepeatedRows(rows(board));

  if (rowViolation) {
    return {
      [LineRepetition]: rowViolation,
    };
  }

  const columnViolation = findRepeatedRows(columns(board));

  if (columnViolation) {
    return {
      [LineRepetition]: {
        columns: columnViolation.rows,
      },
    };
  }

  return null;
};

const validateBoard = (board: Board): Violation | null =>
  findThriceRepetition(board) ??
    findOverSaturation(board) ??
    findLineRepetition(board);

// Game play
type Move = {
  color: Color;
  row: number;
  column: number;
};

const cloneBoard = (board: Board): Board => board.map((row) => [...row]);

const playMove = (
  board: Board,
  { row, column, color }: Move,
): { newBoard: Board; violation: Violation | null } => {
  const newBoard = cloneBoard(board);
  newBoard[row][column] = color;

  return {
    newBoard,
    violation: validateBoard(newBoard),
  };
};

const playMoves = (
  board: Board,
  moves: Move[],
):
  | Board
  | {
    board: Board;
    moveIndex: number;
    violation: Violation;
  } => {
  let updatedBoard = cloneBoard(board);
  for (const [moveIndex, move] of moves.entries()) {
    const { newBoard, violation } = playMove(updatedBoard, move);

    if (violation) {
      return {
        violation,
        moveIndex,
        board: newBoard,
      };
    }

    updatedBoard = newBoard;
  }

  return updatedBoard;
};

const countColors = (row: Row) =>
  row.reduce(
    (totals, color) => {
      totals[color] += 1;

      return totals;
    },
    {
      [Red]: 0,
      [Blue]: 0,
      [Grey]: 0,
    },
  );

const naiveAutocompleteRow = (row: Row): Row => {
  const counts = countColors(row);

  if (2 * counts[Red] >= row.length) {
    return row.map((c) => (c === Grey ? Blue : c));
  }

  if (2 * counts[Blue] >= row.length) {
    return row.map((c) => (c === Grey ? Red : c));
  }

  return [...row];
};

const naiveAutocompleteBoard = (board: Board): Board => {
  let newBoard = cloneBoard(board);

  for (const [rowIndex, row] of rows(newBoard).entries()) {
    const newRow = naiveAutocompleteRow(row);
    newBoard[rowIndex] = newRow;
  }

  for (const [columnIndex, column] of columns(newBoard).entries()) {
    const newColumn = naiveAutocompleteRow(column) as Column;
    newBoard = newBoard.map((row, rowIndex) => {
      row[columnIndex] = newColumn[rowIndex];

      return row;
    });
  }

  return newBoard;
};

const findMoveByNegation = (
  board: Board,
): {
  move: Move;
  violation: Violation;
} | null => {
  for (const [rowIndex, row] of rows(board).entries()) {
    for (const [columnIndex, color] of row.entries()) {
      if (color !== Grey) {
        continue;
      }

      const redMove: Move = {
        color: Red,
        row: rowIndex,
        column: columnIndex,
      };

      const blueMove: Move = {
        color: Blue,
        row: rowIndex,
        column: columnIndex,
      };

      const { newBoard: redBoard } = playMove(board, redMove);

      const redViolation = validateBoard(
        naiveAutocompleteBoard(redBoard),
      );

      if (redViolation) {
        return {
          move: blueMove,
          violation: redViolation,
        };
      }

      const { newBoard: blueBoard } = playMove(board, blueMove);

      const blueViolation = validateBoard(
        naiveAutocompleteBoard(blueBoard),
      );

      if (blueViolation) {
        return {
          move: redMove,
          violation: blueViolation,
        };
      }
    }
  }

  return null;
};

const trySolveByNegation = (
  board: Board,
): {
  board: Board;
  moves: NonNullable<ReturnType<typeof findMoveByNegation>>[];
  unexpectedViolation: Violation | null;
} => {
  let currentBoard = cloneBoard(board);
  const moves: NonNullable<ReturnType<typeof findMoveByNegation>>[] = [];

  let nextMove = findMoveByNegation(currentBoard);

  for (
    let moveCount = 0; nextMove && moveCount < board.length ** 2; ++moveCount
  ) {
    moves.push(nextMove);
    const { newBoard, violation } = playMove(currentBoard, nextMove.move);
    if (violation) {
      return {
        board: newBoard,
        moves,
        unexpectedViolation: violation,
      };
    }

    currentBoard = newBoard;
    nextMove = findMoveByNegation(currentBoard);
  }

  return {
    board: currentBoard,
    moves,
    unexpectedViolation: null,
  };
};

const makeRow = (s: string): Row =>
  [...s.trim().toLowerCase()].map((c) => {
    switch (c) {
      case "r":
        return Red;
      case "b":
        return Blue;
      case "g":
      default:
        return Grey;
    }
  });

const exampleRaw = [
  "bbrbrbrr",
  "rrbbrrbb",
  "bbrrbbrr",
  "rrbrbrbb",
  "rrbbrbrb",
  "bbrbrbrr",
  "rbrrbrbb",
  "brbrbrbr",
];

const example = exampleRaw.map(makeRow) as Board;

const { board, moves, unexpectedViolation } = trySolveByNegation(example);

console.log("-------------- Moves --------------");
for (const move of moves) {
  console.log("Move:", move.move);
  console.log("Violation", move.violation, "\n");
}

console.log("-------------- Board --------------");
console.log(
  board
    .map((row) =>
      row
        .map((square) => {
          switch (square) {
            case Red:
              return "🟥";
            case Blue:
              return "🟦";
            default:
              return "⬜";
          }
        })
        .join("")
    )
    .join("\n"),
);

console.log("-------------- Violation --------------");
console.log(unexpectedViolation);
