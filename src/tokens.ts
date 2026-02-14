//Типы токенов для лексера.

export enum TokenType {
  //Ключевые слова и директивы.
  VOID_APP = "VOID_APP",           //@VoidApp
  VOID_END = "VOID_END",           //@VoidEnd
  USING = "USING",                 //using
  STYLE = "STYLE",                 //style
  MAIN = "MAIN",                   //main
  CREATE = "CREATE",               //create:
  ECHO = "ECHO",                   //echo
  WRITE = "WRITE",                 //write
  IF = "IF",                       //if
  ELSE = "ELSE",                   //else
  WHILE = "WHILE",                 //while
  FOR = "FOR",                     //for

  //Типы данных.
  TYPE_STRING = "TYPE_STRING",     //string
  TYPE_INT = "TYPE_INT",           //int
  TYPE_FLOAT = "TYPE_FLOAT",       //float
  TYPE_BOOL = "TYPE_BOOL",         //bool

  //Литералы.
  STRING_LITERAL = "STRING_LITERAL",
  INT_LITERAL = "INT_LITERAL",
  FLOAT_LITERAL = "FLOAT_LITERAL",
  BOOL_LITERAL = "BOOL_LITERAL",

  //Идентификаторы.
  IDENTIFIER = "IDENTIFIER",

  //Операторы.
  ASSIGN = "ASSIGN",               //=
  PLUS = "PLUS",                   //+
  MINUS = "MINUS",                 //-
  MULTIPLY = "MULTIPLY",           //*
  DIVIDE = "DIVIDE",               ///
  MODULO = "MODULO",               //%
  POWER = "POWER",                 //**

  //Операторы сравнения.
  EQUALS = "EQUALS",               //==
  NOT_EQUALS = "NOT_EQUALS",       //!=
  LESS = "LESS",                   //<
  GREATER = "GREATER",             //>
  LESS_EQ = "LESS_EQ",             //<=
  GREATER_EQ = "GREATER_EQ",       //>=

  //Логические операторы.
  AND = "AND",                     //&&
  OR = "OR",                       //||
  NOT = "NOT",                     //!

  //Разделители.
  LPAREN = "LPAREN",               //(
  RPAREN = "RPAREN",               //)
  LBRACE = "LBRACE",               //{
  RBRACE = "RBRACE",               //}
  SEMICOLON = "SEMICOLON",         //;
  DOT = "DOT",                     //.
  COMMA = "COMMA",                 //,
  COLON = "COLON",                 //:

  //Специальные.
  EOF = "EOF",
  NEWLINE = "NEWLINE",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export function createToken(
  type: TokenType,
  value: string,
  line: number,
  column: number
): Token {
  return { type, value, line, column };
}