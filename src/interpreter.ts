// Интерпретатор: выполняет AST.
import {
  ASTNode,
  ProgramNode,
  MainNode,
  BlockNode,
  EchoNode,
  WriteNode,
  CreateVarNode,
  AssignVarNode,
  IfNode,
  WhileNode,
  ForNode,
  BinaryExprNode,
  UnaryExprNode,
  NumberLiteralNode,
  FloatLiteralNode,
  StringLiteralNode,
  BoolLiteralNode,
  IdentifierNode,
  FunctionCallNode,
  RandCallNode,
} from "./parser";

import * as readlineSync from "readline-sync";

//Типизированные значения.

type VoidValue = string | number | boolean | null;

interface Variable {
  type: string;    //"string" | "int" | "float" | "bool"
  value: VoidValue;
}

//Окружение (scope).

class Environment {
  private variables: Map<string, Variable> = new Map();
  private parent: Environment | null;

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  //Определить переменную.
  define(name: string, type: string, value: VoidValue): void {
    if (this.variables.has(name)) {
      throw new Error(
        `[Runtime Error] Переменная '${name}' уже определена.`
      );
    }
    this.variables.set(name, { type, value });
  }

  //Получить переменную.
  get(name: string): Variable {
    if (this.variables.has(name)) {
      return this.variables.get(name)!;
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    throw new Error(
      `[Runtime Error] Переменная '${name}' не определена.`
    );
  }

  //Установить значение.
  set(name: string, value: VoidValue): void {
    if (this.variables.has(name)) {
      const variable = this.variables.get(name)!;
      variable.value = value;
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    throw new Error(
      `[Runtime Error] Переменная '${name}' не определена.`
    );
  }

  //Проверить существование.
  has(name: string): boolean {
    if (this.variables.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }
}

// Интерпретатор.

export class Interpreter {
  private globalEnv: Environment;
  private appName: string = "";
  private style: string | null = null;

  constructor() {
    this.globalEnv = new Environment();
  }

  // Основной метод.

  public execute(program: ProgramNode): void {
    this.appName = program.appName;
    this.style = program.style;

    console.log(`\x1b[36m═══ Void App: ${this.appName} ═══\x1b[0m`);
    if (this.style) {
      console.log(`\x1b[90mСтиль: ${this.style}\x1b[0m`);
    }
    console.log();

    //Выполняем тело программы.
    for (const node of program.body) {
      this.executeNode(node, this.globalEnv);
    }

    console.log();
    console.log(`\x1b[36m═══ Конец ${this.appName} ═══\x1b[0m`);
  }

  //Выполнение узлов.

  private executeNode(node: ASTNode, env: Environment): VoidValue {
    switch (node.type) {
      case "Main":
        return this.executeMain(node as MainNode, env);
      case "Block":
        return this.executeBlock(node as BlockNode, env);
      case "Echo":
        return this.executeEcho(node as EchoNode, env);
      case "Write":
        return this.executeWrite(node as WriteNode, env);
      case "CreateVar":
        return this.executeCreateVar(node as CreateVarNode, env);
      case "AssignVar":
        return this.executeAssignVar(node as AssignVarNode, env);
      case "If":
        return this.executeIf(node as IfNode, env);
      case "While":
        return this.executeWhile(node as WhileNode, env);
      case "For":
        return this.executeFor(node as ForNode, env);
      case "BinaryExpr":
        return this.executeBinaryExpr(node as BinaryExprNode, env);
      case "UnaryExpr":
        return this.executeUnaryExpr(node as UnaryExprNode, env);
      case "NumberLiteral":
        return (node as NumberLiteralNode).value;
      case "FloatLiteral":
        return (node as FloatLiteralNode).value;
      case "StringLiteral":
        return (node as StringLiteralNode).value;
      case "BoolLiteral":
        return (node as BoolLiteralNode).value;
      case "Identifier":
        return this.executeIdentifier(node as IdentifierNode, env);
      case "FunctionCall":
        return this.executeFunctionCall(node as FunctionCallNode, env);
      case "RandCall":
        return this.executeRandCall(node as RandCallNode, env);
      default:
        throw new Error(
          `[Runtime Error] Неизвестный узел AST: ${(node as any).type}.`
        );
    }
  }

  // Умное сравнение с приведением типов bool ↔ number.
  private areEqual(left: VoidValue, right: VoidValue): boolean {
      // Одинаковые типы — сравниваем напрямую
      if (typeof left === typeof right) {
          return left === right;
      }

      //bool и number — приводим оба к number.
      if (
          (typeof left === "boolean" || typeof left === "number") &&
          (typeof right === "boolean" || typeof right === "number")
      ) {
          return this.toNumber(left) === this.toNumber(right);
      }

      //Разные типы — сравниваем как строки.
      return this.stringify(left) === this.stringify(right);
  }

  //main() { ... }
  private executeMain(node: MainNode, env: Environment): VoidValue {
    return this.executeBlock(node.body, env);
  }

  //Блок { ... }
  private executeBlock(node: BlockNode, parentEnv: Environment): VoidValue {
    const blockEnv = new Environment(parentEnv);
    let result: VoidValue = null;
    for (const stmt of node.statements) {
      result = this.executeNode(stmt, blockEnv);
    }
    return result;
  }

  //echo(...)
  private executeEcho(node: EchoNode, env: Environment): VoidValue {
    const values = node.expressions.map((expr) =>
      this.executeNode(expr, env)
    );
    const output = values
      .map((v) => this.stringify(v))
      .join(" ");
    console.log(output);
    return null;
  }

  //write("prompt") — чтение ввода
  private executeWrite(node: WriteNode, env: Environment): VoidValue {
    const prompt = this.stringify(this.executeNode(node.prompt, env));
    // Используем readlineSync.question для корректной обработки кодировки
    const input = readlineSync.question(prompt);
    return input;
  }

  //create:type name = value.
  private executeCreateVar(
    node: CreateVarNode,
    env: Environment
  ): VoidValue {
    let value = this.executeNode(node.value, env);

    //Приведение типов.
    value = this.castValue(value, node.varType, node.name);

    env.define(node.name, node.varType, value);
    return value;
  }

  //name = value;
  private executeAssignVar(
    node: AssignVarNode,
    env: Environment
  ): VoidValue {
    const variable = env.get(node.name);
    let value = this.executeNode(node.value, env);
    value = this.castValue(value, variable.type, node.name);
    env.set(node.name, value);
    return value;
  }

  //if
  private executeIf(node: IfNode, env: Environment): VoidValue {
    const condition = this.executeNode(node.condition, env);
    if (this.isTruthy(condition)) {
      return this.executeBlock(node.thenBranch, env);
    } else if (node.elseBranch) {
      if (node.elseBranch.type === "If") {
        return this.executeIf(node.elseBranch as IfNode, env);
      }
      return this.executeBlock(node.elseBranch as BlockNode, env);
    }
    return null;
  }

  //while
  private executeWhile(node: WhileNode, env: Environment): VoidValue {
    let iterations = 0;
    const MAX_ITERATIONS = 1000000;
    while (this.isTruthy(this.executeNode(node.condition, env))) {
      this.executeBlock(node.body, env);
      iterations++;
      if (iterations > MAX_ITERATIONS) {
        throw new Error(
          `[Runtime Error] Превышено максимальное число итераций ` +
          `(${MAX_ITERATIONS}). Возможен бесконечный цикл.`
        );
      }
    }
    return null;
  }

  //for
  private executeFor(node: ForNode, env: Environment): VoidValue {
    const forEnv = new Environment(env);
    let iterations = 0;
    const MAX_ITERATIONS = 1000000;

    // init
    if (node.init) {
      this.executeNode(node.init, forEnv);
    }

    //loop
    while (this.isTruthy(this.executeNode(node.condition, forEnv))) {
      this.executeBlock(node.body, forEnv);
      if (node.update) {
        this.executeNode(node.update, forEnv);
      }
      iterations++;
      if (iterations > MAX_ITERATIONS) {
        throw new Error(
          `[Runtime Error] Превышено максимальное число итераций.`
        );
      }
    }
    return null;
  }

  //Выражения.

  //Бинарные операции.
  private executeBinaryExpr(
    node: BinaryExprNode,
    env: Environment
  ): VoidValue {
    const left = this.executeNode(node.left, env);
    const right = this.executeNode(node.right, env);

    switch (node.operator) {
      //Арифметика.
      case "+": {
        if (typeof left === "string" || typeof right === "string") {
          return this.stringify(left) + this.stringify(right);
        }
        if (typeof left === "number" && typeof right === "number") {
          return left + right;
        }
        throw new Error(
          `[Runtime Error] Невозможно сложить ` +
          `${typeof left} и ${typeof right}.`
        );
      }
      case "-":
        return this.toNumber(left) - this.toNumber(right);
      case "*":
        return this.toNumber(left) * this.toNumber(right);
      case "/": {
        const divisor = this.toNumber(right);
        if (divisor === 0) {
          throw new Error("[Runtime Error] Деление на ноль.");
        }
        return this.toNumber(left) / divisor;
      }
      case "%": {
        const mod = this.toNumber(right);
        if (mod === 0) {
          throw new Error("[Runtime Error] Деление на ноль (модуль).");
        }
        return this.toNumber(left) % mod;
      }
      case "**":
        return Math.pow(this.toNumber(left), this.toNumber(right));

      //Сравнение.
      case "==":
        return this.areEqual(left, right);
      case "!=":
        return !this.areEqual(left, right);
      case "<":
        return this.toNumber(left) < this.toNumber(right);
      case ">":
        return this.toNumber(left) > this.toNumber(right);
      case "<=":
        return this.toNumber(left) <= this.toNumber(right);
      case ">=":
        return this.toNumber(left) >= this.toNumber(right);

      //Логические.
      case "&&":
        return this.isTruthy(left) && this.isTruthy(right);
      case "||":
        return this.isTruthy(left) || this.isTruthy(right);

      default:
        throw new Error(
          `[Runtime Error] Неизвестный оператор: ${node.operator}.`
        );
    }
  }

  //Унарные операции.
  private executeUnaryExpr(
    node: UnaryExprNode,
    env: Environment
  ): VoidValue {
    const operand = this.executeNode(node.operand, env);

    switch (node.operator) {
      case "-":
        return -this.toNumber(operand);
      case "!":
        return !this.isTruthy(operand);
      default:
        throw new Error(
          `[Runtime Error] Неизвестный унарный оператор: ${node.operator}.`
        );
    }
  }

  //Идентификатор.
  private executeIdentifier(
    node: IdentifierNode,
    env: Environment
  ): VoidValue {
    const variable = env.get(node.name);
    return variable.value;
  }

  //Вызов встроенных функций.
  private executeFunctionCall(
    node: FunctionCallNode,
    env: Environment
  ): VoidValue {
    const args = node.args.map((arg) => this.executeNode(arg, env));

    switch (node.name) {
      //Математические функции.
      case "abs":
        this.expectArgs(node.name, args, 1);
        return Math.abs(this.toNumber(args[0]));
      case "sqrt":
        this.expectArgs(node.name, args, 1);
        return Math.sqrt(this.toNumber(args[0]));
      case "floor":
        this.expectArgs(node.name, args, 1);
        return Math.floor(this.toNumber(args[0]));
      case "ceil":
        this.expectArgs(node.name, args, 1);
        return Math.ceil(this.toNumber(args[0]));
      case "round":
        this.expectArgs(node.name, args, 1);
        return Math.round(this.toNumber(args[0]));
      case "min":
        this.expectArgs(node.name, args, 2);
        return Math.min(
          this.toNumber(args[0]),
          this.toNumber(args[1])
        );
      case "max":
        this.expectArgs(node.name, args, 2);
        return Math.max(
          this.toNumber(args[0]),
          this.toNumber(args[1])
        );
      case "random":
        return Math.random();

      //Конвертация типов.
      case "toInt":
        this.expectArgs(node.name, args, 1);
        return parseInt(String(args[0]), 10) || 0;
      case "toFloat":
        this.expectArgs(node.name, args, 1);
        return parseFloat(String(args[0])) || 0.0;
      case "toString":
        this.expectArgs(node.name, args, 1);
        return this.stringify(args[0]);
      case "toBool":
        this.expectArgs(node.name, args, 1);
        return this.isTruthy(args[0]);

      //Строковые функции.
      case "length":
        this.expectArgs(node.name, args, 1);
        return String(args[0]).length;
      case "upper":
        this.expectArgs(node.name, args, 1);
        return String(args[0]).toUpperCase();
      case "lower":
        this.expectArgs(node.name, args, 1);
        return String(args[0]).toLowerCase();
      case "trim":
        this.expectArgs(node.name, args, 1);
        return String(args[0]).trim();
      case "contains":
        this.expectArgs(node.name, args, 2);
        return String(args[0]).includes(String(args[1]));

      default:
        throw new Error(
          `[Runtime Error] Неизвестная функция: '${node.name}'.`
        );
    }
  }

  private executeRandCall(node: RandCallNode, env: Environment): VoidValue {
    const min = this.toNumber(this.executeNode(node.min, env));
    const max = this.toNumber(this.executeNode(node.max, env));

    if (isNaN(min) || isNaN(max)) {
      throw new Error(`[Runtime Error] Аргументы rand() должны быть числами.`);
    }
    if  (min > max) {
      throw new Error(`[Runtime Error] rand(min, max): min не может быть больше max.`);
    }

    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  //Вспомогательные методы.

  private expectArgs(
    name: string,
    args: VoidValue[],
    expected: number
  ): void {
    if (args.length !== expected) {
      throw new Error(
        `[Runtime Error] Функция '${name}' ожидает ` +
        `${expected} аргумент(ов), получено ${args.length}.`
      );
    }
  }

  //Приведение значения к типу переменной.
  private castValue(
    value: VoidValue,
    type: string,
    varName: string
  ): VoidValue {
    switch (type) {
      case "string":
        return this.stringify(value);
      case "int": {
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(
            `[Runtime Error] Невозможно преобразовать ` +
            `'${value}' в int для переменной '${varName}'.`
          );
        }
        return Math.floor(num);
      }
      case "float": {
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(
            `[Runtime Error] Невозможно преобразовать ` +
            `'${value}' в float для переменной '${varName}'.`
          );
        }
        return num;
      }
      case "bool":
        return this.isTruthy(value);
      default:
        return value;
    }
  }

  //Преобразовать в строку.
  private stringify(value: VoidValue): string {
    if (value === null) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
  }

  //Преобразовать в число.
  private toNumber(value: VoidValue): number {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const n = Number(value);
      if (isNaN(n)) {
        throw new Error(
          `[Runtime Error] Невозможно преобразовать '${value}' в число.`
        );
      }
      return n;
    }
    if (typeof value === "boolean") return value ? 1 : 0;
    return 0;
  }

  //Проверить истинность.
  private isTruthy(value: VoidValue): boolean {
    if (value === null) return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") return value.length > 0;
    return true;
  }
}