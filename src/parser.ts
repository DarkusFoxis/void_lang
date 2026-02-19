//Парсер: строит AST из токенов.
import { Token, TokenType } from "./tokens";

//Узлы AST.

export type ASTNode =
  | ProgramNode
  | VoidAppNode
  | VoidEndNode
  | UsingStyleNode
  | MainNode
  | BlockNode
  | EchoNode
  | WriteNode
  | CreateVarNode
  | AssignVarNode
  | IfNode
  | WhileNode
  | ForNode
  | BinaryExprNode
  | UnaryExprNode
  | NumberLiteralNode
  | FloatLiteralNode
  | StringLiteralNode
  | BoolLiteralNode
  | IdentifierNode
  | FunctionCallNode
  | RandCallNode
  | ListLiteralNode
  | DictLiteralNode
  | IndexAccessNode
  | MethodCallNode;

export interface ProgramNode {
  type: "Program";
  appName: string;
  style: string | null;
  body: ASTNode[];
}

export interface VoidAppNode {
  type: "VoidApp";
  name: string;
}

export interface VoidEndNode {
  type: "VoidEnd";
}

export interface UsingStyleNode {
  type: "UsingStyle";
  styleName: string;
}

export interface MainNode {
  type: "Main";
  body: BlockNode;
}

export interface BlockNode {
  type: "Block";
  statements: ASTNode[];
}

export interface EchoNode {
  type: "Echo";
  expressions: ASTNode[];
}

export interface WriteNode {
  type: "Write";
  prompt: ASTNode;
}

export interface CreateVarNode {
  type: "CreateVar";
  varType: string;
  name: string;
  value: ASTNode;
}

export interface AssignVarNode {
  type: "AssignVar";
  name: string;
  value: ASTNode;
}

export interface IfNode {
  type: "If";
  condition: ASTNode;
  thenBranch: BlockNode;
  elseBranch: BlockNode | IfNode | null;
}

export interface WhileNode {
  type: "While";
  condition: ASTNode;
  body: BlockNode;
}

export interface ForNode {
  type: "For";
  init: ASTNode | null;
  condition: ASTNode;
  update: ASTNode | null;
  body: BlockNode;
}

export interface BinaryExprNode {
  type: "BinaryExpr";
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryExprNode {
  type: "UnaryExpr";
  operator: string;
  operand: ASTNode;
}

export interface NumberLiteralNode {
  type: "NumberLiteral";
  value: number;
}

export interface FloatLiteralNode {
  type: "FloatLiteral";
  value: number;
}

export interface StringLiteralNode {
  type: "StringLiteral";
  value: string;
}

export interface BoolLiteralNode {
  type: "BoolLiteral";
  value: boolean;
}

export interface IdentifierNode {
  type: "Identifier";
  name: string;
}

export interface FunctionCallNode {
  type: "FunctionCall";
  name: string;
  args: ASTNode[];
}

export interface RandCallNode {
  type: "RandCall";
  min: ASTNode;
  max: ASTNode;
}

//Новые узлы для списков и словарей.
export interface ListLiteralNode {
  type: "ListLiteral";
  elements: ASTNode[];
}

export interface DictLiteralNode {
  type: "DictLiteral";
  entries: { key: ASTNode; value: ASTNode }[];
}

export interface IndexAccessNode {
  type: "IndexAccess";
  object: ASTNode;
  index: ASTNode;
}

export interface MethodCallNode {
  type: "MethodCall";
  object: string;         //Имя переменной.
  method: string;         //"add" | "delete" | "clear"
  collectionType: string; //"list" | "dict"
  args: ASTNode[];
}

//Парсер.

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  //Текущий токен.
  private current(): Token {
    return this.tokens[this.pos] || {
      type: TokenType.EOF, value: "", line: 0, column: 0
    };
  }

  //Подсмотреть вперёд.
  private peek(offset: number = 1): Token {
    return this.tokens[this.pos + offset] || {
      type: TokenType.EOF, value: "", line: 0, column: 0
    };
  }

  //Продвинуться.
  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  //Ожидать конкретный токен.
  private expect(type: TokenType, errorMsg?: string): Token {
    const token = this.current();
    if (token.type !== type) {
      this.error(
        errorMsg ||
        `Ожидался токен ${type}, получен ${token.type} ('${token.value}')`
      );
    }
    return this.advance();
  }

  //Проверить тип текущего токена.
  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  //Проверить и продвинуться, если совпадает.
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private error(message: string): never {
    const token = this.current();
    throw new Error(
      `[Parser Error] ${message} ` +
      `(строка ${token.line}, столбец ${token.column})`
    );
  }

  //Парсинг программы.

  public parse(): ProgramNode {
    const program: ProgramNode = {
      type: "Program",
      appName: "",
      style: null,
      body: [],
    };

    //@VoidApp "Name";
    this.expect(TokenType.VOID_APP, 'Программа должна начинаться с @VoidApp');
    const appNameToken = this.expect(
      TokenType.STRING_LITERAL,
      'После @VoidApp ожидается имя приложения в кавычках'
    );
    program.appName = appNameToken.value;
    this.expect(TokenType.SEMICOLON, 'После имени приложения ожидается ";"');

    //using style "StyleName"; (необязательно).
    if (this.check(TokenType.USING)) {
      this.advance();
      this.expect(TokenType.STYLE, 'После using ожидается style');
      const styleToken = this.expect(
        TokenType.STRING_LITERAL,
        'После style ожидается имя стиля в кавычках'
      );
      program.style = styleToken.value;
      this.expect(TokenType.SEMICOLON);
    }

    //Парсим верхнеуровневые конструкции до @VoidEnd
    while (!this.check(TokenType.VOID_END) && !this.check(TokenType.EOF)) {
      program.body.push(this.parseTopLevel());
    }

    //@VoidEnd;
    if (this.check(TokenType.VOID_END)) {
      this.advance();
      this.expect(TokenType.SEMICOLON);
    }

    return program;
  }

  //Верхнеуровневые конструкции.
  private parseTopLevel(): ASTNode {
    if (this.check(TokenType.MAIN)) {
      return this.parseMain();
    }
    this.error(
      `Неожиданный токен на верхнем уровне: '${this.current().value}'`
    );
    return null as never;
  }

  //main() { ... }
  private parseMain(): MainNode {
    this.expect(TokenType.MAIN);
    this.expect(TokenType.LPAREN);
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return { type: "Main", body };
  }

  //{ ... }
  private parseBlock(): BlockNode {
    this.expect(TokenType.LBRACE);
    const statements: ASTNode[] = [];

    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      statements.push(this.parseStatement());
    }

    this.expect(TokenType.RBRACE);
    return { type: "Block", statements };
  }

  //Парсинг инструкций.

  private parseStatement(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case TokenType.ECHO:
        return this.parseEcho();
      case TokenType.CREATE:
        return this.parseCreateVar();
      case TokenType.IDENTIFIER:
        return this.parseIdentifierStatement();
      case TokenType.IF:
        return this.parseIf();
      case TokenType.WHILE:
        return this.parseWhile();
      case TokenType.FOR:
        return this.parseFor();
      default:
        this.error(`Неожиданная инструкция: '${token.value}'`);
        return null as never;
    }
  }

  //echo(expr1, expr2, ...);
  private parseEcho(): EchoNode {
    this.expect(TokenType.ECHO);
    this.expect(TokenType.LPAREN);

    const expressions: ASTNode[] = [];
    if (!this.check(TokenType.RPAREN)) {
      expressions.push(this.parseExpression());
      while (this.match(TokenType.COMMA)) {
        expressions.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RPAREN);
    this.expect(TokenType.SEMICOLON);

    return { type: "Echo", expressions };
  }

  //create:type name = value;
  private parseCreateVar(): CreateVarNode {
    this.expect(TokenType.CREATE);

    //Тип переменной.
    const typeToken = this.current();
    let varType: string;
    switch (typeToken.type) {
      case TokenType.TYPE_STRING: varType = "string"; break;
      case TokenType.TYPE_INT: varType = "int"; break;
      case TokenType.TYPE_FLOAT: varType = "float"; break;
      case TokenType.TYPE_BOOL: varType = "bool"; break;
      case TokenType.TYPE_LIST: varType = "list"; break;
      case TokenType.TYPE_DICT: varType = "dict"; break;
      default:
        this.error(
          `Ожидался тип переменной (string/int/float/bool/list/dict), ` +
          `получено: '${typeToken.value}'`
        );
        return null as never;
    }
    this.advance();

    //Имя переменной.
    const nameToken = this.expect(TokenType.IDENTIFIER);

    //= значение.
    this.expect(TokenType.ASSIGN);
    const value = this.parseExpression();

    if (this.check(TokenType.SEMICOLON)) {
      this.advance();
    } else {
      this.error('После объявления переменной ожидается ";"');
    }

    return {
      type: "CreateVar",
      varType,
      name: nameToken.value,
      value,
    };
  }

  //Идентификатор: присваивание, вызов функции или вызов метода.
  private parseIdentifierStatement(): ASTNode {
    const name = this.advance(); //Идентификатор.

    //Вызов метода: name.add:list(...); name.delete:dict(...); name.clear:list();
    if (this.check(TokenType.DOT)) {
      this.advance(); // пропускаем '.'.

      //Ожидаем имя метода (add, delete, clear).
      const methodToken = this.current();
      let method: string;
      if (methodToken.type === TokenType.ADD) {
        method = "add";
      } else if (methodToken.type === TokenType.DELETE) {
        method = "delete";
      } else if (methodToken.type === TokenType.CLEAR) {
        method = "clear";
      } else {
        this.error(`Ожидался метод (add/delete/clear), получено: '${methodToken.value}'`);
        return null as never;
      }
      this.advance();

      //Ожидаем ':' и тип коллекции.
      this.expect(TokenType.COLON, 'После имени метода ожидается ":"');
      const collTypeToken = this.current();
      let collectionType: string;
      if (collTypeToken.type === TokenType.TYPE_LIST) {
        collectionType = "list";
      } else if (collTypeToken.type === TokenType.TYPE_DICT) {
        collectionType = "dict";
      } else {
        this.error(`Ожидался тип коллекции (list/dict), получено: '${collTypeToken.value}'`);
        return null as never;
      }
      this.advance();

      //Аргументы в скобках.
      this.expect(TokenType.LPAREN);
      const args: ASTNode[] = [];

      if (!this.check(TokenType.RPAREN)) {
        //Для add:dict ожидаем key:value
        //Для add:list ожидаем value
        //Для delete:list ожидаем index
        //Для delete:dict ожидаем key
        //Для clear — пусто.
        args.push(this.parseExpression());

        // Для add:dict — парсим ":" и значение внутри скобок
        if (method === "add" && collectionType === "dict" && this.check(TokenType.COLON)) {
          this.advance(); // пропускаем ':'
          args.push(this.parseExpression());
        }

        while (this.match(TokenType.COMMA)) {
          args.push(this.parseExpression());
        }
      }

      this.expect(TokenType.RPAREN);
      this.expect(TokenType.SEMICOLON);

      return {
        type: "MethodCall",
        object: name.value,
        method,
        collectionType,
        args,
      } as MethodCallNode;
    }

    //Присваивание: name = expr;
    if (this.check(TokenType.ASSIGN)) {
      this.advance();
      const value = this.parseExpression();
      this.expect(TokenType.SEMICOLON, 'После присваивания ожидается ";".');
      return {
        type: "AssignVar",
        name: name.value,
        value,
      } as AssignVarNode;
    }

    //Присваивание по индексу: name[index] = expr;
    if (this.check(TokenType.LBRACKET)) {
      this.advance(); // '['
      const index = this.parseExpression();
      this.expect(TokenType.RBRACKET);
      this.expect(TokenType.ASSIGN);
      const value = this.parseExpression();
      this.expect(TokenType.SEMICOLON);
      return {
        type: "AssignVar",
        name: `${name.value}[]`,
        value,
        //Сохраняем дополнительные данные через хак — создадим отдельный узел.
      } as any; //Мы обработаем это иначе — см. ниже.
    }

    //Вызов функции: name(args);
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      const args: ASTNode[] = [];
      if (!this.check(TokenType.RPAREN)) {
        args.push(this.parseExpression());
        while (this.match(TokenType.COMMA)) {
          args.push(this.parseExpression());
        }
      }
      this.expect(TokenType.RPAREN);
      this.expect(TokenType.SEMICOLON);
      if (name.value === "rand") {
        if (args.length !== 2) {
          this.error("Функция rand() ожидает 2 аргумента: min и max.");
        }
        return {
          type: "RandCall",
          min: args[0],
          max: args[1],
        } as RandCallNode;
      }
      return {
        type: "FunctionCall",
        name: name.value,
        args,
      } as FunctionCallNode;
    }

    this.error(`Неожиданный токен после идентификатора '${name.value}'`);
    return null as never;
  }

  //if (condition) { ... } else { ... }
  private parseIf(): IfNode {
    this.expect(TokenType.IF);
    this.expect(TokenType.LPAREN);
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const thenBranch = this.parseBlock();

    let elseBranch: BlockNode | IfNode | null = null;
    if (this.match(TokenType.ELSE)) {
      if (this.check(TokenType.IF)) {
        elseBranch = this.parseIf();
      } else {
        elseBranch = this.parseBlock();
      }
    }

    return {
      type: "If",
      condition,
      thenBranch,
      elseBranch,
    };
  }

  //while (condition) { ... }
  private parseWhile(): WhileNode {
    this.expect(TokenType.WHILE);
    this.expect(TokenType.LPAREN);
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();

    return { type: "While", condition, body };
  }

  //for (init; condition; update) { ... }
  private parseFor(): ForNode {
    this.expect(TokenType.FOR);
    this.expect(TokenType.LPAREN);

    //init
    let init: ASTNode | null = null;
    if (this.check(TokenType.CREATE)) {
      init = this.parseCreateVar();
    } else if (!this.check(TokenType.SEMICOLON)) {
      const name = this.expect(TokenType.IDENTIFIER);
      this.expect(TokenType.ASSIGN);
      const value = this.parseExpression();
      this.expect(TokenType.SEMICOLON);
      init = { type: "AssignVar", name: name.value, value } as AssignVarNode;
    } else {
      this.advance(); //Пропускаем ';' (пустой init).
    }

    //condition
    let condition: ASTNode;
    if (this.check(TokenType.SEMICOLON)) {
      condition = { type: "BoolLiteral", value: true };
    } else {
      condition = this.parseExpression();
    }
    this.expect(TokenType.SEMICOLON);

    //update
    let update: ASTNode | null = null;
    if (!this.check(TokenType.RPAREN)) {
      const name = this.expect(TokenType.IDENTIFIER);
      this.expect(TokenType.ASSIGN);
      const value = this.parseExpression();
      update = { type: "AssignVar", name: name.value, value } as AssignVarNode;
    }

    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();

    return { type: "For", init, condition, update, body };
  }

  //Парсинг выражений (приоритет операторов).

  private parseExpression(): ASTNode {
    return this.parseOr();
  }

  //||
  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.check(TokenType.OR)) {
      const op = this.advance().value;
      const right = this.parseAnd();
      left = { type: "BinaryExpr", operator: op, left, right };
    }
    return left;
  }

  //&&
  private parseAnd(): ASTNode {
    let left = this.parseEquality();
    while (this.check(TokenType.AND)) {
      const op = this.advance().value;
      const right = this.parseEquality();
      left = { type: "BinaryExpr", operator: op, left, right };
    }
    return left;
  }

  //== !=
  private parseEquality(): ASTNode {
    let left = this.parseComparison();
    while (
      this.check(TokenType.EQUALS) ||
      this.check(TokenType.NOT_EQUALS)
    ) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = { type: "BinaryExpr", operator: op, left, right };
    }
    return left;
  }

  //< > <= >=
  private parseComparison(): ASTNode {
    let left = this.parseAddition();
    while (
      this.check(TokenType.LESS) ||
      this.check(TokenType.GREATER) ||
      this.check(TokenType.LESS_EQ) ||
      this.check(TokenType.GREATER_EQ)
    ) {
      const op = this.advance().value;
      const right = this.parseAddition();
      left = { type: "BinaryExpr", operator: op, left, right };
    }
    return left;
  }

  //+ -
  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();
    while (
      this.check(TokenType.PLUS) ||
      this.check(TokenType.MINUS)
    ) {
      const op = this.advance().value;
      const right = this.parseMultiplication();
      left = { type: "BinaryExpr", operator: op, left, right };
    }
    return left;
  }

  //* / %
  private parseMultiplication(): ASTNode {
    let left = this.parsePower();
    while (
      this.check(TokenType.MULTIPLY) ||
      this.check(TokenType.DIVIDE) ||
      this.check(TokenType.MODULO)
    ) {
      const op = this.advance().value;
      const right = this.parsePower();
      left = { type: "BinaryExpr", operator: op, left, right };
    }
    return left;
  }

  //** (возведение в степень, правоассоциативный).
  private parsePower(): ASTNode {
    let left = this.parseUnary();
    if (this.check(TokenType.POWER)) {
      const op = this.advance().value;
      const right = this.parsePower();
      left = { type: "BinaryExpr", operator: op, left, right };
    }
    return left;
  }

  //Унарные: - !
  private parseUnary(): ASTNode {
    if (this.check(TokenType.MINUS)) {
      const op = this.advance().value;
      const operand = this.parseUnary();
      return { type: "UnaryExpr", operator: op, operand };
    }
    if (this.check(TokenType.NOT)) {
      const op = this.advance().value;
      const operand = this.parseUnary();
      return { type: "UnaryExpr", operator: op, operand };
    }
    return this.parsePostfix();
  }

  //Постфиксные операции: индексация [expr]
  private parsePostfix(): ASTNode {
    let node = this.parsePrimary();

    //Обрабатываем цепочки индексации: Variable[0], Dict["key"] и т.д.
    while (this.check(TokenType.LBRACKET)) {
      this.advance(); // '['.
      const index = this.parseExpression();
      this.expect(TokenType.RBRACKET);
      node = {
        type: "IndexAccess",
        object: node,
        index,
      } as IndexAccessNode;
    }

    return node;
  }

  //Первичные выражения.
  private parsePrimary(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case TokenType.INT_LITERAL:
        this.advance();
        return { type: "NumberLiteral", value: parseInt(token.value, 10) };

      case TokenType.FLOAT_LITERAL:
        this.advance();
        return { type: "FloatLiteral", value: parseFloat(token.value) };

      case TokenType.STRING_LITERAL:
        this.advance();
        return { type: "StringLiteral", value: token.value };

      case TokenType.BOOL_LITERAL:
        this.advance();
        return { type: "BoolLiteral", value: token.value === "true" };

      //Литерал списка: [1, 2, 3]
      case TokenType.LBRACKET:
        return this.parseListLiteral();

      //Литерал словаря: {"key":"value", ...}
      case TokenType.LBRACE:
        return this.parseDictLiteral();

      case TokenType.IDENTIFIER: {
        const name = this.advance();
        //Вызов функции в выражении.
        if (this.check(TokenType.LPAREN)) {
          this.advance();
          const args: ASTNode[] = [];
          if (!this.check(TokenType.RPAREN)) {
            args.push(this.parseExpression());
            while (this.match(TokenType.COMMA)) {
              args.push(this.parseExpression());
            }
          }
          this.expect(TokenType.RPAREN);
          return { type: "FunctionCall", name: name.value, args };
        }
        return { type: "Identifier", name: name.value };
      }

      case TokenType.WRITE:
        return this.parseWriteExpr();

      case TokenType.LPAREN: {
        this.advance();
        const expr = this.parseExpression();
        this.expect(TokenType.RPAREN);
        return expr;
      }
      case TokenType.RAND:
        return this.parseRandCall();

      default:
        this.error(`Неожиданный токен в выражении: '${token.value}'`);
        return null as never;
    }
  }

  //Парсинг литерала списка: [expr, expr, ...]
  private parseListLiteral(): ListLiteralNode {
    this.expect(TokenType.LBRACKET);
    const elements: ASTNode[] = [];

    if (!this.check(TokenType.RBRACKET)) {
      elements.push(this.parseExpression());
      while (this.match(TokenType.COMMA)) {
        elements.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RBRACKET);
    return { type: "ListLiteral", elements };
  }

  //Парсинг литерала словаря: {key:value, key:value, ...}
  private parseDictLiteral(): DictLiteralNode {
    this.expect(TokenType.LBRACE);
    const entries: { key: ASTNode; value: ASTNode }[] = [];

    if (!this.check(TokenType.RBRACE)) {
      const key = this.parseExpression();
      this.expect(TokenType.COLON, 'В словаре ожидается ":" между ключом и значением');
      const value = this.parseExpression();
      entries.push({ key, value });

      while (this.match(TokenType.COMMA)) {
        const k = this.parseExpression();
        this.expect(TokenType.COLON, 'В словаре ожидается ":" между ключом и значением');
        const v = this.parseExpression();
        entries.push({ key: k, value: v });
      }
    }

    this.expect(TokenType.RBRACE);
    return { type: "DictLiteral", entries };
  }

  //write("prompt") — выражение ввода.
  private parseWriteExpr(): WriteNode {
    this.expect(TokenType.WRITE);
    this.expect(TokenType.LPAREN);
    const prompt = this.parseExpression();
    this.expect(TokenType.RPAREN);
    return { type: "Write", prompt };
  }

  private parseRandCall(): RandCallNode {
    this.expect(TokenType.RAND);
    this.expect(TokenType.LPAREN);
    const min = this.parseExpression();
    this.expect(TokenType.COMMA);
    const max = this.parseExpression();
    this.expect(TokenType.RPAREN);
    return { type: "RandCall", min, max };
  }
}