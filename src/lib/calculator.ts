class ExpressionParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse() {
    const value = this.parseExpression();
    this.skipSpaces();
    if (this.index < this.input.length) {
      throw new Error("Invalid expression");
    }
    if (!Number.isFinite(value)) {
      throw new Error("Invalid result");
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (true) {
      this.skipSpaces();
      const operator = this.peek();
      if (operator !== "+" && operator !== "-") return value;
      this.index++;
      const next = this.parseTerm();
      value = operator === "+" ? value + next : value - next;
    }
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (true) {
      this.skipSpaces();
      const operator = this.peek();
      if (operator !== "*" && operator !== "/") return value;
      this.index++;
      const next = this.parseFactor();
      if (operator === "/" && next === 0) {
        throw new Error("Cannot divide by zero");
      }
      value = operator === "*" ? value * next : value / next;
    }
  }

  private parseFactor(): number {
    this.skipSpaces();
    const char = this.peek();

    if (char === "+") {
      this.index++;
      return this.parseFactor();
    }

    if (char === "-") {
      this.index++;
      return -this.parseFactor();
    }

    if (char === "(") {
      this.index++;
      const value = this.parseExpression();
      this.skipSpaces();
      if (this.peek() !== ")") {
        throw new Error("Missing closing parenthesis");
      }
      this.index++;
      return value;
    }

    return this.parseNumber();
  }

  private parseNumber(): number {
    this.skipSpaces();
    const start = this.index;
    let seenDecimal = false;

    while (this.index < this.input.length) {
      const char = this.input[this.index];
      if (char === ".") {
        if (seenDecimal) break;
        seenDecimal = true;
        this.index++;
        continue;
      }
      if (!/[0-9]/.test(char)) break;
      this.index++;
    }

    if (start === this.index) {
      throw new Error("Expected a number");
    }

    const raw = this.input.slice(start, this.index);
    if (raw === ".") {
      throw new Error("Expected a number");
    }
    return Number(raw);
  }

  private peek() {
    return this.input[this.index];
  }

  private skipSpaces() {
    while (this.input[this.index] === " ") {
      this.index++;
    }
  }
}

export function evaluateAmountExpression(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const value = new ExpressionParser(trimmed).parse();
  return Math.round(value * 100) / 100;
}
