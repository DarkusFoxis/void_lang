//Парсер: строит AST из токенов.
import { Token, TokenType } from "./tokens";

export interface VoidConfig {
  maxIteration: number;
  automaticType: boolean;
}

export type ASTNode =
  | ProgramNode | VoidAppNode | VoidEndNode | UsingStyleNode | MainNode | BlockNode
  | EchoNode | WriteNode | CreateVarNode | MultiCreateNode | AssignVarNode | IfNode
  | WhileNode | ForNode | BinaryExprNode | UnaryExprNode | NumberLiteralNode
  | FloatLiteralNode | StringLiteralNode | BoolLiteralNode | IdentifierNode
  | FunctionCallNode | RandCallNode | ListLiteralNode | DictLiteralNode
  | IndexAccessNode | MethodCallNode | ReferenceNode | ArrayElementRefNode | DereferenceNode
  | FunctionDeclNode | ReturnNode | UpdateExprNode | VoidSettingNode
  | BreakNode | ContinueNode | NamespaceCallNode | CreateNamespaceNode;

export interface BreakNode { type: "Break"; }
export interface ContinueNode { type: "Continue"; }
export interface NamespaceCallNode { type: "NamespaceCall"; namespace: string; name: string; args: ASTNode[]; }
export interface CreateNamespaceNode { type: "CreateNamespace"; name: string; }

export interface VoidSettingNode { type: "VoidSetting"; key: string; value: string | number | boolean; }

export interface ProgramNode { type: "Program"; appName: string; isLib: boolean; namespace: string | null; style: string | null; config: VoidConfig; functions: FunctionDeclNode[]; body: ASTNode[]; settings: VoidSettingNode[]; }
export interface VoidAppNode { type: "VoidApp"; name: string; }
export interface VoidEndNode { type: "VoidEnd"; }
export interface UsingStyleNode { type: "UsingStyle"; styleName: string; }
export interface MainNode { type: "Main"; body: BlockNode; }
export interface BlockNode { type: "Block"; statements: ASTNode[]; }
export interface EchoNode { type: "Echo"; expressions: ASTNode[]; }
export interface WriteNode { type: "Write"; prompt: ASTNode; }
export interface CreateVarNode { type: "CreateVar"; varType: string; name: string; initializer?: ASTNode; }
export interface MultiCreateNode { type: "MultiCreate"; declarations: CreateVarNode[]; }
export interface AssignVarNode { type: "AssignVar"; target: ASTNode; value: ASTNode; operator: string; }
export interface IfNode { type: "If"; condition: ASTNode; thenBranch: BlockNode; elseBranch: BlockNode | IfNode | null; }
export interface WhileNode { type: "While"; condition: ASTNode; body: BlockNode; }
export interface ForNode { type: "For"; init: ASTNode | null; condition: ASTNode; update: ASTNode | null; body: BlockNode; }
export interface BinaryExprNode { type: "BinaryExpr"; operator: string; left: ASTNode; right: ASTNode; }
export interface UnaryExprNode { type: "UnaryExpr"; operator: string; operand: ASTNode; }
export interface NumberLiteralNode { type: "NumberLiteral"; value: number; }
export interface FloatLiteralNode { type: "FloatLiteral"; value: number; }
export interface StringLiteralNode { type: "StringLiteral"; value: string; }
export interface BoolLiteralNode { type: "BoolLiteral"; value: boolean; }
export interface IdentifierNode { type: "Identifier"; name: string; }
export interface FunctionCallNode { type: "FunctionCall"; name: string; args: ASTNode[]; }
export interface RandCallNode { type: "RandCall"; min: ASTNode; max: ASTNode; }
export interface ListLiteralNode { type: "ListLiteral"; elements: ASTNode[]; }
export interface DictLiteralNode { type: "DictLiteral"; entries: { key: ASTNode; value: ASTNode }[]; }
export interface IndexAccessNode { type: "IndexAccess"; object: ASTNode; index: ASTNode; }
export interface MethodCallNode { type: "MethodCall"; object: string; method: string; collectionType: string; args: ASTNode[]; }
export interface ReferenceNode { type: "Reference"; target: string; }
export interface ArrayElementRefNode { type: "ArrayElementRef"; array: string; index: ASTNode; }
export interface DereferenceNode { type: "Dereference"; target: ASTNode; }
export interface FunctionDeclNode { type: "FunctionDecl"; returnType: string; name: string; params: { type: string; name: string }[]; body: BlockNode; }
export interface ReturnNode { type: "Return"; value: ASTNode | null; }
export interface UpdateExprNode { type: "UpdateExpr"; operator: string; target: ASTNode; isPrefix: boolean; }

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) { this.tokens = tokens; }
  private current(): Token { return this.tokens[this.pos] || { type: TokenType.EOF, value: "", line: 0, column: 0 }; }
  private peek(offset: number = 1): Token { return this.tokens[this.pos + offset] || { type: TokenType.EOF, value: "", line: 0, column: 0 }; }
  private advance(): Token { const token = this.current(); this.pos++; return token; }
  
  private expect(type: TokenType, errorMsg?: string): Token {
    const token = this.current();
    if (token.type !== type) this.error(errorMsg || `Ожидался токен ${type}, получен ${token.type} ('${token.value}')`);
    return this.advance();
  }
  
  private check(type: TokenType): boolean { return this.current().type === type; }
  
  private match(...types: TokenType[]): boolean {
    for (const type of types) { if (this.check(type)) { this.advance(); return true; } }
    return false;
  }

  private error(message: string): never {
    const token = this.current();
    throw new Error(`[Parser Error] ${message} (строка ${token.line}, столбец ${token.column})`);
  }

  public parse(): ProgramNode {
    const program: ProgramNode = { 
      type: "Program", appName: "", isLib: false, namespace: null, style: null, 
      config: { maxIteration: 1_000_000, automaticType: false },
      functions: [], body: [], settings: [] 
    };

    if (this.check(TokenType.VOID_LIBS)) {
      this.advance();
      program.isLib = true;
      program.appName = this.expect(TokenType.STRING_LITERAL, 'После @VoidLibs ожидается имя библиотеки').value;
      this.expect(TokenType.SEMICOLON);
    } else if (this.check(TokenType.VOID_APP)) {
      this.advance();
      program.appName = this.expect(TokenType.STRING_LITERAL, 'После @VoidApp ожидается имя приложения').value;
      this.expect(TokenType.SEMICOLON);
    } else {
      this.error('Программа должна начинаться с @VoidApp или @VoidLibs');
    }

    while (!this.check(TokenType.VOID_END) && !this.check(TokenType.EOF)) {
      if (this.check(TokenType.VOID_SETTING)) {
        const setting = this.parseVoidSetting();
        program.settings.push(setting);
        this.applySetting(program.config, setting);
      }
      else if (this.check(TokenType.NAMESPACE)) {
        this.advance();
        program.namespace = this.expect(TokenType.STRING_LITERAL, 'После namespace ожидается имя пространства имён').value;
        this.expect(TokenType.SEMICOLON);
      }
      else if (this.check(TokenType.USING)) {
        this.advance(); this.expect(TokenType.STYLE);
        program.style = this.expect(TokenType.STRING_LITERAL).value;
        this.expect(TokenType.SEMICOLON);
      }
      else if (this.check(TokenType.VOID_FUNC)) program.functions.push(this.parseFunctionDecl());
      else if (this.check(TokenType.FN)) program.functions.push(this.parseFnFunction());
      else program.body.push(this.parseTopLevel());
    }

    if (this.check(TokenType.VOID_END)) { this.advance(); this.expect(TokenType.SEMICOLON); }
    return program;
  }

  private parseVoidSetting(): VoidSettingNode {
    this.expect(TokenType.VOID_SETTING);
    const keyToken = this.expect(TokenType.IDENTIFIER, "Ожидается имя настройки");
    const key = keyToken.value;
    this.expect(TokenType.ASSIGN);
    
    let value: string | number | boolean;
    let negative = false;
    
    if (this.check(TokenType.MINUS)) {
      negative = true;
      this.advance();
    }
    
    const valueToken = this.current();
    
    if (valueToken.type === TokenType.INT_LITERAL) {
      value = parseInt(valueToken.value, 10);
      if (negative) value = -value;
      this.advance();
    } else if (valueToken.type === TokenType.STRING_LITERAL) {
      value = valueToken.value;
      this.advance();
    } else if (valueToken.type === TokenType.BOOL_LITERAL) {
      value = valueToken.value === "true";
      this.advance();
    } else {
      this.error(`Неожиданное значение для настройки '${key}'`);
    }
    
    this.expect(TokenType.SEMICOLON);
    return { type: "VoidSetting", key, value };
  }

  private applySetting(config: VoidConfig, setting: VoidSettingNode): void {
    switch (setting.key) {
      case "max_iteration":
        config.maxIteration = setting.value as number;
        break;
      case "automatic_type":
        config.automaticType = setting.value as boolean;
        break;
      default:
        this.error(`Неизвестная настройка: '${setting.key}'`);
    }
  }

  private parseFunctionDecl(): FunctionDeclNode {
    this.expect(TokenType.VOID_FUNC);
    const returnType = this.parseType();
    const name = this.expect(TokenType.IDENTIFIER, "Ожидается имя функции").value;
    this.expect(TokenType.LPAREN);
    
    const params: { type: string; name: string }[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const pType = this.parseType();
        const pName = this.expect(TokenType.IDENTIFIER, "Ожидается имя параметра").value;
        params.push({ type: pType, name: pName });
      } while (this.match(TokenType.COMMA));
    }
    
    this.expect(TokenType.RPAREN);
    return { type: "FunctionDecl", returnType, name, params, body: this.parseBlock() };
  }

  private parseFnFunction(): FunctionDeclNode {
    this.expect(TokenType.FN);
    const nameToken = this.advance();
    const name = nameToken.value;
    this.expect(TokenType.LPAREN);
    
    const params: { type: string; name: string }[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const pType = this.parseType();
        const pName = this.expect(TokenType.IDENTIFIER, "Ожидается имя параметра").value;
        params.push({ type: pType, name: pName });
      } while (this.match(TokenType.COMMA));
    }
    
    this.expect(TokenType.RPAREN);
    
    let returnType = "void";
    if (this.match(TokenType.ARROW)) {
      returnType = this.parseType();
    }
    
    return { type: "FunctionDecl", returnType, name, params, body: this.parseBlock() };
  }

  private parseType(): string {
    if (this.check(TokenType.CREATE)) {
      this.advance();
    }
    
    const t = this.current(); 
    let type = "";
    switch (t.type) {
      case TokenType.TYPE_STRING: type = "string"; break; 
      case TokenType.TYPE_INT: type = "int"; break;
      case TokenType.TYPE_FLOAT: type = "float"; break; 
      case TokenType.TYPE_BOOL: type = "bool"; break;
      case TokenType.TYPE_LIST: type = "list"; break; 
      case TokenType.TYPE_DICT: type = "dict"; break;
      case TokenType.TYPE_LINK: type = "link"; break; 
      case TokenType.TYPE_VOID: type = "void"; break;
      case TokenType.VAR: type = "var"; break;
      default: this.error(`Ожидался тип, получено: '${t.value}'`);
    }
    this.advance(); 
    return type;
  }

  private parseTopLevel(): ASTNode {
    if (this.check(TokenType.MAIN)) return this.parseMain();
    this.error(`Неожиданный токен на верхнем уровне: '${this.current().value}'`);
    return null as never;
  }

  private parseMain(): MainNode {
    this.expect(TokenType.MAIN); this.expect(TokenType.LPAREN); this.expect(TokenType.RPAREN);
    return { type: "Main", body: this.parseBlock() };
  }

  private parseBlock(): BlockNode {
    this.expect(TokenType.LBRACE);
    const statements: ASTNode[] = [];
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) statements.push(this.parseStatement());
    this.expect(TokenType.RBRACE);
    return { type: "Block", statements };
  }

  private parseStatement(): ASTNode {
    const token = this.current();
    switch (token.type) {
      case TokenType.ECHO: return this.parseEcho();
      case TokenType.CREATE: return this.parseCreateVar();
      case TokenType.IDENTIFIER: return this.parseIdentifierStatement();
      case TokenType.MULTIPLY: return this.parseDereferenceAssignment();
      case TokenType.IF: return this.parseIf();
      case TokenType.WHILE: return this.parseWhile();
      case TokenType.FOR: return this.parseFor();
      case TokenType.RETURN: return this.parseReturn();
      case TokenType.BREAK: return this.parseBreak();
      case TokenType.CONTINUE: return this.parseContinue();
      case TokenType.INCREMENT:
      case TokenType.DECREMENT: return this.parseUpdateStatement();
      case TokenType.LPAREN: return this.parseExprStatement();
      default: this.error(`Неожиданная инструкция: '${token.value}'`); return null as never;
    }
  }

  private parseAssignmentOperator(): string {
    if (this.match(TokenType.PLUS_ASSIGN)) return "+=";
    if (this.match(TokenType.MINUS_ASSIGN)) return "-=";
    if (this.match(TokenType.MULTIPLY_ASSIGN)) return "*=";
    if (this.match(TokenType.DIVIDE_ASSIGN)) return "/=";
    this.expect(TokenType.ASSIGN);
    return "=";
  }

  private parseUpdateStatement(): ASTNode {
    const op = this.advance().value;
    const operand = this.parseUnary();
    this.expect(TokenType.SEMICOLON);
    return { type: "UpdateExpr", operator: op, target: operand, isPrefix: true } as UpdateExprNode;
  }

  private parseExprStatement(): ASTNode {
    const expr = this.parseExpression();
    if (this.check(TokenType.PLUS_ASSIGN) || this.check(TokenType.MINUS_ASSIGN) ||
        this.check(TokenType.MULTIPLY_ASSIGN) || this.check(TokenType.DIVIDE_ASSIGN) ||
        this.check(TokenType.ASSIGN)) {
      const operator = this.parseAssignmentOperator();
      const value = this.parseExpression();
      this.expect(TokenType.SEMICOLON);
      return { type: "AssignVar", target: expr, value, operator } as AssignVarNode;
    }
    if (this.check(TokenType.INCREMENT) || this.check(TokenType.DECREMENT)) {
      const op = this.advance().value;
      this.expect(TokenType.SEMICOLON);
      return { type: "UpdateExpr", operator: op, target: expr, isPrefix: false } as UpdateExprNode;
    }
    this.expect(TokenType.SEMICOLON);
    return expr;
  }

  private parseReturn(): ReturnNode {
    this.expect(TokenType.RETURN);
    let value: ASTNode | null = null;
    if (!this.check(TokenType.SEMICOLON)) value = this.parseExpression();
    this.expect(TokenType.SEMICOLON);
    return { type: "Return", value };
  }

  private parseBreak(): BreakNode {
    this.expect(TokenType.BREAK);
    this.expect(TokenType.SEMICOLON);
    return { type: "Break" };
  }

  private parseContinue(): ContinueNode {
    this.expect(TokenType.CONTINUE);
    this.expect(TokenType.SEMICOLON);
    return { type: "Continue" };
  }

  private parseDereferenceAssignment(): ASTNode {
    this.expect(TokenType.MULTIPLY);
    const name = this.expect(TokenType.IDENTIFIER).value;
    const target: DereferenceNode = { type: "Dereference", target: { type: "Identifier", name } };
    const operator = this.parseAssignmentOperator();
    const value = this.parseExpression();
    this.expect(TokenType.SEMICOLON);
    return { type: "AssignVar", target, value, operator } as AssignVarNode;
  }

  private parseEcho(): EchoNode {
    this.expect(TokenType.ECHO); this.expect(TokenType.LPAREN);
    const expressions: ASTNode[] = [];
    if (!this.check(TokenType.RPAREN)) {
      expressions.push(this.parseExpression());
      while (this.match(TokenType.COMMA)) expressions.push(this.parseExpression());
    }
    this.expect(TokenType.RPAREN); this.expect(TokenType.SEMICOLON);
    return { type: "Echo", expressions };
  }

  private parseCreateVar(): MultiCreateNode {
    this.expect(TokenType.CREATE);
    const typeToken = this.current(); let varType = "";
    switch (typeToken.type) {
      case TokenType.TYPE_STRING: varType = "string"; break; case TokenType.TYPE_INT: varType = "int"; break;
      case TokenType.TYPE_FLOAT: varType = "float"; break; case TokenType.TYPE_BOOL: varType = "bool"; break;
      case TokenType.TYPE_LIST: varType = "list"; break; case TokenType.TYPE_DICT: varType = "dict"; break;
      case TokenType.TYPE_LINK: varType = "link"; break; case TokenType.TYPE_VOID: varType = "void"; break;
      case TokenType.VAR: varType = "var"; break;
      default: this.error(`Ожидался тип переменной, получено: '${typeToken.value}'`);
    }
    this.advance();
    const declarations: CreateVarNode[] = [];
    do {
      const name = this.expect(TokenType.IDENTIFIER).value;
      let initializer: ASTNode | undefined = undefined;
      if (this.match(TokenType.ASSIGN)) initializer = this.parseExpression();
      declarations.push({ type: "CreateVar", varType, name, initializer });
    } while (this.match(TokenType.COMMA));
    this.expect(TokenType.SEMICOLON);
    return { type: "MultiCreate", declarations };
  }

  private parseIdentifierStatement(): ASTNode {
    const name = this.advance().value;

    if (this.check(TokenType.DOT)) {
      this.advance();
      const methodToken = this.current(); let method = "";
      if (methodToken.type === TokenType.ADD) method = "add";
      else if (methodToken.type === TokenType.DELETE) method = "delete";
      else if (methodToken.type === TokenType.CLEAR) method = "clear";
      else this.error(`Ожидался метод (add/delete/clear), получено: '${methodToken.value}'`);
      this.advance();
      this.expect(TokenType.COLON);
      const collTypeToken = this.current(); let collectionType = "";
      if (collTypeToken.type === TokenType.TYPE_LIST) collectionType = "list";
      else if (collTypeToken.type === TokenType.TYPE_DICT) collectionType = "dict";
      else this.error(`Ожидался тип коллекции (list/dict), получено: '${collTypeToken.value}'`);
      this.advance();
      this.expect(TokenType.LPAREN);
      const args: ASTNode[] = [];
      if (!this.check(TokenType.RPAREN)) {
        args.push(this.parseExpression());
        if (method === "add" && collectionType === "dict" && this.check(TokenType.COLON)) { this.advance(); args.push(this.parseExpression()); }
        while (this.match(TokenType.COMMA)) args.push(this.parseExpression());
      }
      this.expect(TokenType.RPAREN); this.expect(TokenType.SEMICOLON);
      return { type: "MethodCall", object: name, method, collectionType, args } as MethodCallNode;
    }

    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      const index = this.parseExpression();
      this.expect(TokenType.RBRACKET);
      
      if (this.check(TokenType.INCREMENT) || this.check(TokenType.DECREMENT)) {
        const op = this.advance().value;
        this.expect(TokenType.SEMICOLON);
        const target: IndexAccessNode = { type: "IndexAccess", object: { type: "Identifier", name }, index };
        return { type: "UpdateExpr", operator: op, target, isPrefix: false } as UpdateExprNode;
      }
      
      const operator = this.parseAssignmentOperator();
      const value = this.parseExpression();
      this.expect(TokenType.SEMICOLON);
      const target: IndexAccessNode = { type: "IndexAccess", object: { type: "Identifier", name }, index };
      return { type: "AssignVar", target, value, operator } as AssignVarNode;
    }

    if (this.check(TokenType.INCREMENT) || this.check(TokenType.DECREMENT)) {
      const op = this.advance().value;
      this.expect(TokenType.SEMICOLON);
      const target: IdentifierNode = { type: "Identifier", name };
      return { type: "UpdateExpr", operator: op, target, isPrefix: false } as UpdateExprNode;
    }

    if (this.check(TokenType.ASSIGN) || this.check(TokenType.PLUS_ASSIGN) || this.check(TokenType.MINUS_ASSIGN) || this.check(TokenType.MULTIPLY_ASSIGN) || this.check(TokenType.DIVIDE_ASSIGN)) {
      const operator = this.parseAssignmentOperator();
      const value = this.parseExpression();
      this.expect(TokenType.SEMICOLON);
      const target: IdentifierNode = { type: "Identifier", name };
      return { type: "AssignVar", target, value, operator } as AssignVarNode;
    }

    if (this.check(TokenType.LPAREN)) {
      this.advance();
      const args: ASTNode[] = [];
      if (!this.check(TokenType.RPAREN)) {
        args.push(this.parseExpression());
        while (this.match(TokenType.COMMA)) args.push(this.parseExpression());
      }
      this.expect(TokenType.RPAREN); this.expect(TokenType.SEMICOLON);
      if (name === "rand") return { type: "RandCall", min: args[0], max: args[1] } as RandCallNode;
      return { type: "FunctionCall", name, args } as FunctionCallNode;
    }

    this.error(`Неожиданный токен после идентификатора '${name}'`);
    return null as never;
  }

  private parseIf(): IfNode {
    this.expect(TokenType.IF); this.expect(TokenType.LPAREN);
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const thenBranch = this.parseBlock();
    let elseBranch: BlockNode | IfNode | null = null;
    if (this.match(TokenType.ELSE)) elseBranch = this.check(TokenType.IF) ? this.parseIf() : this.parseBlock();
    return { type: "If", condition, thenBranch, elseBranch };
  }

  private parseWhile(): WhileNode {
    this.expect(TokenType.WHILE); this.expect(TokenType.LPAREN);
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN);
    return { type: "While", condition, body: this.parseBlock() };
  }

  private parseFor(): ForNode {
    this.expect(TokenType.FOR); this.expect(TokenType.LPAREN);
    let init: ASTNode | null = null;
    if (this.check(TokenType.CREATE)) {
      const multi = this.parseCreateVar();
      if (multi.declarations.length !== 1) this.error("В инициализаторе for допускается только одно объявление переменной");
      init = multi.declarations[0];
    } else if (!this.check(TokenType.SEMICOLON)) {
      if (this.check(TokenType.IDENTIFIER)) {
        const name = this.advance().value;
        if (this.check(TokenType.INCREMENT) || this.check(TokenType.DECREMENT)) {
          init = { type: "UpdateExpr", operator: this.advance().value, target: { type: "Identifier", name }, isPrefix: false } as UpdateExprNode;
        } else {
          const operator = this.parseAssignmentOperator();
          init = { type: "AssignVar", target: { type: "Identifier", name }, value: this.parseExpression(), operator } as AssignVarNode;
        }
      } else init = this.parseExpression();
      this.expect(TokenType.SEMICOLON);
    } else this.advance();

    let condition: ASTNode = this.check(TokenType.SEMICOLON) ? { type: "BoolLiteral", value: true } : this.parseExpression();
    this.expect(TokenType.SEMICOLON);

    let update: ASTNode | null = null;
    if (!this.check(TokenType.RPAREN)) {
      if (this.check(TokenType.IDENTIFIER)) {
        const name = this.advance().value;
        if (this.check(TokenType.INCREMENT) || this.check(TokenType.DECREMENT)) {
          update = { type: "UpdateExpr", operator: this.advance().value, target: { type: "Identifier", name }, isPrefix: false } as UpdateExprNode;
        } else {
          const operator = this.parseAssignmentOperator();
          update = { type: "AssignVar", target: { type: "Identifier", name }, value: this.parseExpression(), operator } as AssignVarNode;
        }
      } else update = this.parseExpression();
    }
    this.expect(TokenType.RPAREN);
    return { type: "For", init, condition, update, body: this.parseBlock() };
  }

  private parseExpression(): ASTNode { return this.parseOr(); }
  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.check(TokenType.OR)) left = { type: "BinaryExpr", operator: this.advance().value, left, right: this.parseAnd() };
    return left;
  }
  private parseAnd(): ASTNode {
    let left = this.parseEquality();
    while (this.check(TokenType.AND)) left = { type: "BinaryExpr", operator: this.advance().value, left, right: this.parseEquality() };
    return left;
  }
  private parseEquality(): ASTNode {
    let left = this.parseComparison();
    while (this.check(TokenType.EQUALS) || this.check(TokenType.NOT_EQUALS)) left = { type: "BinaryExpr", operator: this.advance().value, left, right: this.parseComparison() };
    return left;
  }
  private parseComparison(): ASTNode {
    let left = this.parseAddition();
    while (this.check(TokenType.LESS) || this.check(TokenType.GREATER) || this.check(TokenType.LESS_EQ) || this.check(TokenType.GREATER_EQ)) left = { type: "BinaryExpr", operator: this.advance().value, left, right: this.parseAddition() };
    return left;
  }
  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();
    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) left = { type: "BinaryExpr", operator: this.advance().value, left, right: this.parseMultiplication() };
    return left;
  }
  private parseMultiplication(): ASTNode {
    let left = this.parsePower();
    while (this.check(TokenType.MULTIPLY) || this.check(TokenType.DIVIDE) || this.check(TokenType.MODULO)) left = { type: "BinaryExpr", operator: this.advance().value, left, right: this.parsePower() };
    return left;
  }
  private parsePower(): ASTNode {
    let left = this.parseUnary();
    if (this.check(TokenType.POWER)) left = { type: "BinaryExpr", operator: this.advance().value, left, right: this.parsePower() };
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.check(TokenType.MINUS) || this.check(TokenType.NOT)) return { type: "UnaryExpr", operator: this.advance().value, operand: this.parseUnary() };
    if (this.check(TokenType.REFERENCE)) {
      this.advance();
      const target = this.parsePostfix();
      if (target.type === "Identifier") {
        return { type: "Reference", target: (target as IdentifierNode).name } as ReferenceNode;
      } else if (target.type === "IndexAccess") {
        const indexAccess = target as IndexAccessNode;
        if (indexAccess.object.type === "Identifier") {
          return { type: "ArrayElementRef", array: (indexAccess.object as IdentifierNode).name, index: indexAccess.index } as ArrayElementRefNode;
        }
        this.error("Ссылка поддерживается только на переменные и элементы массивов");
      }
      this.error("После & ожидается переменная или arr[index]");
    }
    if (this.check(TokenType.MULTIPLY)) {
      this.advance();
      const target = this.parseUnary();
      if (target.type === "Identifier" || target.type === "IndexAccess" || target.type === "ArrayElementRef") {
        return { type: "Dereference", target } as DereferenceNode;
      }
      this.error("После * ожидается переменная, arr[index] или ссылка");
    }
    if (this.check(TokenType.INCREMENT) || this.check(TokenType.DECREMENT)) return { type: "UpdateExpr", operator: this.advance().value, target: this.parseUnary(), isPrefix: true } as UpdateExprNode;
    return this.parsePostfix();
  }

  private parsePostfix(): ASTNode {
    let node = this.parsePrimary();
    while (true) {
      if (this.check(TokenType.LBRACKET)) {
        this.advance(); const index = this.parseExpression(); this.expect(TokenType.RBRACKET);
        node = { type: "IndexAccess", object: node, index } as IndexAccessNode;
      } else if (this.check(TokenType.INCREMENT) || this.check(TokenType.DECREMENT)) {
        node = { type: "UpdateExpr", operator: this.advance().value, target: node, isPrefix: false } as UpdateExprNode;
      } else break;
    }
    return node;
  }

  private parsePrimary(): ASTNode {
    const token = this.current();
    switch (token.type) {
      case TokenType.INT_LITERAL: this.advance(); return { type: "NumberLiteral", value: parseInt(token.value, 10) };
      case TokenType.FLOAT_LITERAL: this.advance(); return { type: "FloatLiteral", value: parseFloat(token.value) };
      case TokenType.STRING_LITERAL: this.advance(); return { type: "StringLiteral", value: token.value };
      case TokenType.BOOL_LITERAL: this.advance(); return { type: "BoolLiteral", value: token.value === "true" };
      case TokenType.LBRACKET: return this.parseListLiteral();
      case TokenType.LBRACE: return this.parseDictLiteral();
      case TokenType.IDENTIFIER: {
        const name = this.advance();
        if (this.check(TokenType.NAMESPACE_SEP)) {
          this.advance();
          const funcName = this.expect(TokenType.IDENTIFIER, "Ожидается имя функции").value;
          this.expect(TokenType.LPAREN);
          const args: ASTNode[] = [];
          if (!this.check(TokenType.RPAREN)) {
            args.push(this.parseExpression());
            while (this.match(TokenType.COMMA)) args.push(this.parseExpression());
          }
          this.expect(TokenType.RPAREN);
          return { type: "NamespaceCall", namespace: name.value, name: funcName, args } as NamespaceCallNode;
        }
        if (this.check(TokenType.LPAREN)) {
          this.advance(); const args: ASTNode[] = [];
          if (!this.check(TokenType.RPAREN)) { args.push(this.parseExpression()); while (this.match(TokenType.COMMA)) args.push(this.parseExpression()); }
          this.expect(TokenType.RPAREN);
          return { type: "FunctionCall", name: name.value, args };
        }
        return { type: "Identifier", name: name.value };
      }
      case TokenType.WRITE: return this.parseWriteExpr();
      case TokenType.LPAREN: { this.advance(); const expr = this.parseExpression(); this.expect(TokenType.RPAREN); return expr; }
      case TokenType.RAND: return this.parseRandCall();
      default: this.error(`Неожиданный токен в выражении: '${token.value}'`); return null as never;
    }
  }

  private parseListLiteral(): ListLiteralNode {
    this.expect(TokenType.LBRACKET); const elements: ASTNode[] = [];
    if (!this.check(TokenType.RBRACKET)) { elements.push(this.parseExpression()); while (this.match(TokenType.COMMA)) elements.push(this.parseExpression()); }
    this.expect(TokenType.RBRACKET); return { type: "ListLiteral", elements };
  }

  private parseDictLiteral(): DictLiteralNode {
    this.expect(TokenType.LBRACE); const entries: { key: ASTNode; value: ASTNode }[] = [];
    if (!this.check(TokenType.RBRACE)) {
      const key = this.parseExpression(); this.expect(TokenType.COLON); entries.push({ key, value: this.parseExpression() });
      while (this.match(TokenType.COMMA)) { const k = this.parseExpression(); this.expect(TokenType.COLON); entries.push({ key: k, value: this.parseExpression() }); }
    }
    this.expect(TokenType.RBRACE); return { type: "DictLiteral", entries };
  }

  private parseWriteExpr(): WriteNode { this.expect(TokenType.WRITE); this.expect(TokenType.LPAREN); const prompt = this.parseExpression(); this.expect(TokenType.RPAREN); return { type: "Write", prompt }; }
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