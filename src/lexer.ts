//Лексер: разбивает исходный код на токены.
import { Token, TokenType, createToken } from "./tokens";

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  private keywords: Map<string, TokenType> = new Map([
    ["using", TokenType.USING],
    ["style", TokenType.STYLE],
    ["main", TokenType.MAIN],
    ["echo", TokenType.ECHO],
    ["write", TokenType.WRITE],
    ["if", TokenType.IF],
    ["else", TokenType.ELSE],
    ["while", TokenType.WHILE],
    ["for", TokenType.FOR],
    ["return", TokenType.RETURN],
    ["string", TokenType.TYPE_STRING],
    ["int", TokenType.TYPE_INT],
    ["float", TokenType.TYPE_FLOAT],
    ["bool", TokenType.TYPE_BOOL],
    ["void", TokenType.TYPE_VOID],
    ["true", TokenType.BOOL_LITERAL],
    ["false", TokenType.BOOL_LITERAL],
    ["rand", TokenType.RAND],
    ["list", TokenType.TYPE_LIST],
    ["dict", TokenType.TYPE_DICT],
    ["link", TokenType.TYPE_LINK],
    ["add", TokenType.ADD],
    ["delete", TokenType.DELETE],
    ["clear", TokenType.CLEAR],
    ["var", TokenType.VAR],
    ["break", TokenType.BREAK],
    ["continue", TokenType.CONTINUE],
    ["fn", TokenType.FN],
    ["namespace", TokenType.NAMESPACE],
  ]);

  constructor(source: string) {
    this.source = source;
  }

  private current(): string { return this.source[this.pos] || "\0"; }
  private peek(offset: number = 1): string { return this.source[this.pos + offset] || "\0"; }

  private advance(): string {
    const ch = this.current();
    this.pos++;
    if (ch === "\n") { this.line++; this.column = 1; } 
    else { this.column++; }
    return ch;
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length) {
      const ch = this.current();
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") this.advance();
      else break;
    }
  }

  private skipSingleLineComment(): void {
    while (this.pos < this.source.length && this.current() !== "\n") this.advance();
  }

  private skipMultiLineComment(): void {
    this.advance(); this.advance();
    while (this.pos < this.source.length) {
      if (this.current() === "*" && this.peek() === "#") {
        this.advance(); this.advance(); return;
      }
      this.advance();
    }
    this.error("Незакрытый многострочный комментарий");
  }

  private readString(): Token {
    const startLine = this.line, startCol = this.column;
    const quote = this.advance();
    let value = "";
    while (this.pos < this.source.length && this.current() !== quote) {
      if (this.current() === "\\") {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case "n": value += "\n"; break; case "t": value += "\t"; break;
          case "r": value += "\r"; break; case "\\": value += "\\"; break;
          case '"': value += '"'; break; case "'": value += "'"; break;
          default: value += escaped;
        }
      } else value += this.advance();
    }
    if (this.pos >= this.source.length) this.error("Незакрытая строка", startLine, startCol);
    this.advance();
    return createToken(TokenType.STRING_LITERAL, value, startLine, startCol);
  }

  private readNumber(): Token {
    const startLine = this.line, startCol = this.column;
    let value = "", isFloat = false;
    while (this.pos < this.source.length && this.isDigit(this.current())) value += this.advance();
    if (this.current() === "." && this.isDigit(this.peek())) {
      isFloat = true; value += this.advance();
      while (this.pos < this.source.length && this.isDigit(this.current())) value += this.advance();
    }
    return createToken(isFloat ? TokenType.FLOAT_LITERAL : TokenType.INT_LITERAL, value, startLine, startCol);
  }

  private readIdentifier(): Token {
    const startLine = this.line, startCol = this.column;
    let value = "";
    while (this.pos < this.source.length && this.isAlphaNumeric(this.current())) value += this.advance();
    if (value === "create" && this.current() === ":") {
      this.advance(); return createToken(TokenType.CREATE, "create:", startLine, startCol);
    }
    const keywordType = this.keywords.get(value);
    if (keywordType) return createToken(keywordType, value, startLine, startCol);
    return createToken(TokenType.IDENTIFIER, value, startLine, startCol);
  }

  private readDirective(): Token {
    const startLine = this.line, startCol = this.column;
    this.advance(); let value = "@";
    while (this.pos < this.source.length && this.isAlphaNumeric(this.current())) value += this.advance();
    switch (value) {
      case "@VoidApp": return createToken(TokenType.VOID_APP, value, startLine, startCol);
      case "@VoidEnd": return createToken(TokenType.VOID_END, value, startLine, startCol);
      case "@VoidFunction": return createToken(TokenType.VOID_FUNC, value, startLine, startCol);
      case "@VoidSetting": return createToken(TokenType.VOID_SETTING, value, startLine, startCol);
      case "@VoidLibs": return createToken(TokenType.VOID_LIBS, value, startLine, startCol);
      case "@VoidImport": return createToken(TokenType.VOID_IMPORT, value, startLine, startCol);
      default: this.error(`Неизвестная директива: ${value}`, startLine, startCol);
    }
    return createToken(TokenType.EOF, "", startLine, startCol);
  }

  private isDigit(ch: string): boolean { return ch >= "0" && ch <= "9"; }
  private isAlpha(ch: string): boolean { return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_"; }
  private isAlphaNumeric(ch: string): boolean { return this.isAlpha(ch) || this.isDigit(ch); }

  private error(message: string, line?: number, col?: number): never {
    throw new Error(`[Lexer Error] ${message} (строка ${line ?? this.line}, столбец ${col ?? this.column})`);
  }

  public tokenize(): Token[] {
    this.tokens = [];
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;
      const ch = this.current();
      const startLine = this.line, startCol = this.column;

      if (ch === "/" && this.peek() === "/") { this.skipSingleLineComment(); continue; }
      if (ch === "#" && this.peek() === "*") { this.skipMultiLineComment(); continue; }
      if (ch === "@") { this.tokens.push(this.readDirective()); continue; }
      if (ch === '"' || ch === "'") { this.tokens.push(this.readString()); continue; }
      if (this.isDigit(ch)) { this.tokens.push(this.readNumber()); continue; }
      if (this.isAlpha(ch)) { this.tokens.push(this.readIdentifier()); continue; }

      const twoChar = ch + this.peek();
      switch (twoChar) {
        case "**": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.POWER, "**", startLine, startCol)); continue;
        case "==": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.EQUALS, "==", startLine, startCol)); continue;
        case "!=": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.NOT_EQUALS, "!=", startLine, startCol)); continue;
        case "<=": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.LESS_EQ, "<=", startLine, startCol)); continue;
        case ">=": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.GREATER_EQ, ">=", startLine, startCol)); continue;
        case "&&": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.AND, "&&", startLine, startCol)); continue;
        case "||": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.OR, "||", startLine, startCol)); continue;
        case "+=": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.PLUS_ASSIGN, "+=", startLine, startCol)); continue;
        case "-=": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.MINUS_ASSIGN, "-=", startLine, startCol)); continue;
        case "*=": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.MULTIPLY_ASSIGN, "*=", startLine, startCol)); continue;
        case "/=": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.DIVIDE_ASSIGN, "/=", startLine, startCol)); continue;
        case "++": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.INCREMENT, "++", startLine, startCol)); continue;
        case "--": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.DECREMENT, "--", startLine, startCol)); continue;
        case "->": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.ARROW, "->", startLine, startCol)); continue;
        case "::": this.advance(); this.advance(); this.tokens.push(createToken(TokenType.NAMESPACE_SEP, "::", startLine, startCol)); continue;
      }

      switch (ch) {
        case "+": this.advance(); this.tokens.push(createToken(TokenType.PLUS, "+", startLine, startCol)); break;
        case "-": this.advance(); this.tokens.push(createToken(TokenType.MINUS, "-", startLine, startCol)); break;
        case "*": this.advance(); this.tokens.push(createToken(TokenType.MULTIPLY, "*", startLine, startCol)); break;
        case "/": this.advance(); this.tokens.push(createToken(TokenType.DIVIDE, "/", startLine, startCol)); break;
        case "%": this.advance(); this.tokens.push(createToken(TokenType.MODULO, "%", startLine, startCol)); break;
        case "=": this.advance(); this.tokens.push(createToken(TokenType.ASSIGN, "=", startLine, startCol)); break;
        case "<": this.advance(); this.tokens.push(createToken(TokenType.LESS, "<", startLine, startCol)); break;
        case ">": this.advance(); this.tokens.push(createToken(TokenType.GREATER, ">", startLine, startCol)); break;
        case "!": this.advance(); this.tokens.push(createToken(TokenType.NOT, "!", startLine, startCol)); break;
        case "&": this.advance(); this.tokens.push(createToken(TokenType.REFERENCE, "&", startLine, startCol)); break;
        case "(": this.advance(); this.tokens.push(createToken(TokenType.LPAREN, "(", startLine, startCol)); break;
        case ")": this.advance(); this.tokens.push(createToken(TokenType.RPAREN, ")", startLine, startCol)); break;
        case "{": this.advance(); this.tokens.push(createToken(TokenType.LBRACE, "{", startLine, startCol)); break;
        case "}": this.advance(); this.tokens.push(createToken(TokenType.RBRACE, "}", startLine, startCol)); break;
        case "[": this.advance(); this.tokens.push(createToken(TokenType.LBRACKET, "[", startLine, startCol)); break;
        case "]": this.advance(); this.tokens.push(createToken(TokenType.RBRACKET, "]", startLine, startCol)); break;
        case ".": this.advance(); this.tokens.push(createToken(TokenType.DOT, ".", startLine, startCol)); break;
        case ";": this.advance(); this.tokens.push(createToken(TokenType.SEMICOLON, ";", startLine, startCol)); break;
        case ",": this.advance(); this.tokens.push(createToken(TokenType.COMMA, ",", startLine, startCol)); break;
        case ":": this.advance(); this.tokens.push(createToken(TokenType.COLON, ":", startLine, startCol)); break;
        default: this.error(`Неожиданный символ: '${ch}'`);
      }
    }
    this.tokens.push(createToken(TokenType.EOF, "", this.line, this.column));
    return this.tokens;
  }
}