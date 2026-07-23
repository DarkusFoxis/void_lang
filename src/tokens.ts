//Типы токенов для лексера.
export enum TokenType {
  //Ключевые слова и директивы.
  VOID_APP = "VOID_APP",           //@VoidApp
  VOID_END = "VOID_END",           //@VoidEnd
  VOID_FUNC = "VOID_FUNC",         //@VoidFunction
  VOID_IMPORT = "VOID_IMPORT",     //@VoidImport
  VOID_SETTING = "VOID_SETTING",   //@VoidSetting
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
  RAND = "RAND",                   //rand
  ADD = "ADD",                     //add
  DELETE = "DELETE",               //delete
  CLEAR = "CLEAR",                 //clear
  RETURN = "RETURN",               //return
  VAR = "VAR",                     //var
  BREAK = "BREAK",                 //break
  CONTINUE = "CONTINUE",           //continue
  FN = "FN",                       //fn
  ARROW = "ARROW",                 //->
  VOID_LIBS = "VOID_LIBS",         //@VoidLibs
  NAMESPACE = "NAMESPACE",         //namespace
  NAMESPACE_SEP = "NAMESPACE_SEP", //::
  
  //Типы данных.
  TYPE_STRING = "TYPE_STRING",     //string
  TYPE_INT = "TYPE_INT",           //int
  TYPE_FLOAT = "TYPE_FLOAT",       //float
  TYPE_BOOL = "TYPE_BOOL",         //bool
  TYPE_VOID = "TYPE_VOID",         //void
  TYPE_LIST = "TYPE_LIST",         //list
  TYPE_DICT = "TYPE_DICT",         //dict
  TYPE_LINK = "TYPE_LINK",         //link
  TYPE_VAR = "TYPE_VAR",           //var
  
  //Литералы.
  STRING_LITERAL = "STRING_LITERAL",
  INT_LITERAL = "INT_LITERAL",
  FLOAT_LITERAL = "FLOAT_LITERAL",
  BOOL_LITERAL = "BOOL_LITERAL",
  
  //Идентификаторы.
  IDENTIFIER = "IDENTIFIER",
  
  //Операторы.
  ASSIGN = "ASSIGN",               //=
  PLUS_ASSIGN = "PLUS_ASSIGN",     //+=
  MINUS_ASSIGN = "MINUS_ASSIGN",   //-=
  MULTIPLY_ASSIGN = "MULTIPLY_ASSIGN", //*=
  DIVIDE_ASSIGN = "DIVIDE_ASSIGN", ///=
  PLUS = "PLUS",                   //+
  MINUS = "MINUS",                 //-
  MULTIPLY = "MULTIPLY",           //*
  DIVIDE = "DIVIDE",               ///
  MODULO = "MODULO",               //%
  POWER = "POWER",                 //**
  REFERENCE = "REFERENCE",         //&
  INCREMENT = "INCREMENT",         //++
  DECREMENT = "DECREMENT",         //--
  
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
  COMMA = "COMMA",                 //,
  COLON = "COLON",                 //:
  LBRACKET = "LBRACKET",           //[
  RBRACKET = "RBRACKET",           //]
  DOT = "DOT",                     //.
  
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