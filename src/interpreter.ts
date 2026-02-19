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
  ListLiteralNode,
  DictLiteralNode,
  IndexAccessNode,
  MethodCallNode,
} from "./parser";

import * as readlineSync from "readline-sync";

//Типизированные значения.

type VoidValue = string | number | boolean | null | VoidValue[] | VoidDict;

interface VoidDict {
  __isDict: true;
  keys: VoidValue[];
  values: VoidValue[];
}

function createVoidDict(): VoidDict {
  return { __isDict: true, keys: [], values: [] };
}

function isVoidDict(val: VoidValue): val is VoidDict {
  return (
    val !== null &&
    typeof val === "object" &&
    !Array.isArray(val) &&
    (val as any).__isDict === true
  );
}

interface Variable {
  type: string;    //"string" | "int" | "float" | "bool" | "list" | "dict"
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
      case "ListLiteral":
        return this.executeListLiteral(node as ListLiteralNode, env);
      case "DictLiteral":
        return this.executeDictLiteral(node as DictLiteralNode, env);
      case "IndexAccess":
        return this.executeIndexAccess(node as IndexAccessNode, env);
      case "MethodCall":
        return this.executeMethodCall(node as MethodCallNode, env);
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

  //echo(...);
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

  //write("prompt") — чтение ввода.
  private executeWrite(node: WriteNode, env: Environment): VoidValue {
    const prompt = this.stringify(this.executeNode(node.prompt, env));
    const input = readlineSync.question(prompt);
    return input;
  }

  //create:type name = value.
  private executeCreateVar(
    node: CreateVarNode,
    env: Environment
  ): VoidValue {
    let value = this.executeNode(node.value, env);

    //Приведение типов (для list и dict не приводим).
    if (node.varType !== "list" && node.varType !== "dict") {
      value = this.castValue(value, node.varType, node.name);
    } else {
      //Валидация типа.
      if (node.varType === "list" && !Array.isArray(value)) {
        throw new Error(
          `[Runtime Error] Переменная '${node.name}' типа list ожидает список, получено: ${this.stringify(value)}`
        );
      }
      if (node.varType === "dict" && !isVoidDict(value)) {
        throw new Error(
          `[Runtime Error] Переменная '${node.name}' типа dict ожидает словарь, получено: ${this.stringify(value)}`
        );
      }
    }

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
    if (variable.type !== "list" && variable.type !== "dict") {
      value = this.castValue(value, variable.type, node.name);
    }
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

    if (node.init) {
      this.executeNode(node.init, forEnv);
    }

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

  //Списки и словари.
  //Создание литерала списка.
  private executeListLiteral(node: ListLiteralNode, env: Environment): VoidValue {
    const elements: VoidValue[] = [];
    for (const elem of node.elements) {
      elements.push(this.executeNode(elem, env));
    }
    return elements;
  }

  //Создание литерала словаря.
  private executeDictLiteral(node: DictLiteralNode, env: Environment): VoidValue {
    const dict = createVoidDict();
    for (const entry of node.entries) {
      const key = this.executeNode(entry.key, env);
      const value = this.executeNode(entry.value, env);
      dict.keys.push(key);
      dict.values.push(value);
    }
    return dict;
  }

  //Доступ по индексу/ключу: Variable[0], Dict["key"].
  private executeIndexAccess(node: IndexAccessNode, env: Environment): VoidValue {
    const obj = this.executeNode(node.object, env);
    const index = this.executeNode(node.index, env);

    //Список.
    if (Array.isArray(obj)) {
      const idx = this.toNumber(index);
      const len = obj.length;
      //Поддержка отрицательных индексов.
      let resolvedIdx = idx;
      if (idx < 0) {
        resolvedIdx = len + idx;
      }
      if (resolvedIdx < 0 || resolvedIdx >= len) {
        throw new Error(
          `[Runtime Error] Индекс ${idx} выходит за границы списка (длина: ${len}).`
        );
      }
      return obj[resolvedIdx];
    }

    //Словарь.
    if (isVoidDict(obj)) {
      const keyIdx = this.findDictKey(obj, index);
      if (keyIdx === -1) {
        throw new Error(
          `[Runtime Error] Ключ '${this.stringify(index)}' не найден в словаре.`
        );
      }
      return obj.values[keyIdx];
    }

    //Строка — доступ к символу по индексу.
    if (typeof obj === "string") {
      const idx = this.toNumber(index);
      let resolvedIdx = idx;
      if (idx < 0) {
        resolvedIdx = obj.length + idx;
      }
      if (resolvedIdx < 0 || resolvedIdx >= obj.length) {
        throw new Error(
          `[Runtime Error] Индекс ${idx} выходит за границы строки (длина: ${obj.length}).`
        );
      }
      return obj[resolvedIdx];
    }

    throw new Error(
      `[Runtime Error] Оператор [] не применим к типу ${typeof obj}.`
    );
  }

  //Вызов метода: Variable.add:list("Data"); и т.д.
  private executeMethodCall(node: MethodCallNode, env: Environment): VoidValue {
    const variable = env.get(node.object);
    const obj = variable.value;

    switch (node.method) {
      case "add":
        return this.executeMethodAdd(node, env, variable);
      case "delete":
        return this.executeMethodDelete(node, env, variable);
      case "clear":
        return this.executeMethodClear(node, env, variable);
      default:
        throw new Error(
          `[Runtime Error] Неизвестный метод: '${node.method}'.`
        );
    }
  }

  //add:list(value) / add:dict(key:value)
  private executeMethodAdd(
    node: MethodCallNode,
    env: Environment,
    variable: Variable
  ): VoidValue {
    if (node.collectionType === "list") {
      if (!Array.isArray(variable.value)) {
        throw new Error(
          `[Runtime Error] Переменная '${node.object}' не является списком.`
        );
      }
      if (node.args.length !== 1) {
        throw new Error(
          `[Runtime Error] add:list() ожидает 1 аргумент.`
        );
      }
      const value = this.executeNode(node.args[0], env);
      (variable.value as VoidValue[]).push(value);
    } else if (node.collectionType === "dict") {
      if (!isVoidDict(variable.value)) {
        throw new Error(
          `[Runtime Error] Переменная '${node.object}' не является словарём.`
        );
      }
      if (node.args.length !== 2) {
        throw new Error(
          `[Runtime Error] add:dict() ожидает 2 аргумента (ключ:значение).`
        );
      }
      const key = this.executeNode(node.args[0], env);
      const value = this.executeNode(node.args[1], env);
      const dict = variable.value as VoidDict;

      //Если ключ уже существует — обновляем.
      const existingIdx = this.findDictKey(dict, key);
      if (existingIdx !== -1) {
        dict.values[existingIdx] = value;
      } else {
        dict.keys.push(key);
        dict.values.push(value);
      }
    }
    return null;
  }

  //delete:list(index) / delete:dict(key)
  private executeMethodDelete(
    node: MethodCallNode,
    env: Environment,
    variable: Variable
  ): VoidValue {
    if (node.collectionType === "list") {
      if (!Array.isArray(variable.value)) {
        throw new Error(
          `[Runtime Error] Переменная '${node.object}' не является списком.`
        );
      }
      if (node.args.length !== 1) {
        throw new Error(
          `[Runtime Error] delete:list() ожидает 1 аргумент (индекс).`
        );
      }
      const idx = this.toNumber(this.executeNode(node.args[0], env));
      const arr = variable.value as VoidValue[];
      let resolvedIdx = idx;
      if (idx < 0) {
        resolvedIdx = arr.length + idx;
      }
      if (resolvedIdx < 0 || resolvedIdx >= arr.length) {
        throw new Error(
          `[Runtime Error] Индекс ${idx} выходит за границы списка (длина: ${arr.length}).`
        );
      }
      arr.splice(resolvedIdx, 1);
    } else if (node.collectionType === "dict") {
      if (!isVoidDict(variable.value)) {
        throw new Error(
          `[Runtime Error] Переменная '${node.object}' не является словарём.`
        );
      }
      if (node.args.length !== 1) {
        throw new Error(
          `[Runtime Error] delete:dict() ожидает 1 аргумент (ключ).`
        );
      }
      const key = this.executeNode(node.args[0], env);
      const dict = variable.value as VoidDict;
      const keyIdx = this.findDictKey(dict, key);
      if (keyIdx === -1) {
        throw new Error(
          `[Runtime Error] Ключ '${this.stringify(key)}' не найден в словаре.`
        );
      }
      dict.keys.splice(keyIdx, 1);
      dict.values.splice(keyIdx, 1);
    }
    return null;
  }

  //clear:list() / clear:dict()
  private executeMethodClear(
    node: MethodCallNode,
    env: Environment,
    variable: Variable
  ): VoidValue {
    if (node.collectionType === "list") {
      if (!Array.isArray(variable.value)) {
        throw new Error(
          `[Runtime Error] Переменная '${node.object}' не является списком.`
        );
      }
      if (node.args.length !== 0) {
        throw new Error(
          `[Runtime Error] clear:list() не принимает аргументов.`
        );
      }
      (variable.value as VoidValue[]).length = 0;
    } else if (node.collectionType === "dict") {
      if (!isVoidDict(variable.value)) {
        throw new Error(
          `[Runtime Error] Переменная '${node.object}' не является словарём.`
        );
      }
      if (node.args.length !== 0) {
        throw new Error(
          `[Runtime Error] clear:dict() не принимает аргументов.`
        );
      }
      const dict = variable.value as VoidDict;
      dict.keys.length = 0;
      dict.values.length = 0;
    }
    return null;
  }

  // Поиск ключа в словаре
  private findDictKey(dict: VoidDict, key: VoidValue): number {
    for (let i = 0; i < dict.keys.length; i++) {
      if (this.areEqual(dict.keys[i], key)) {
        return i;
      }
    }
    return -1;
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
        //Конкатенация списков.
        if (Array.isArray(left) && Array.isArray(right)) {
          return [...left, ...right];
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
        if (Array.isArray(args[0])) {
          return args[0].length;
        }
        if (isVoidDict(args[0])) {
          return (args[0] as VoidDict).keys.length;
        }
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
        //Поддержка contains для списков.
        if (Array.isArray(args[0])) {
          const searchVal = args[1];
          return (args[0] as VoidValue[]).some(item => this.areEqual(item, searchVal));
        }
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
    if (min > max) {
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
    if (Array.isArray(value)) {
      const items = value.map(v => this.stringify(v));
      return `[${items.join(", ")}]`;
    }
    if (isVoidDict(value)) {
      const entries = value.keys.map((k, i) =>
        `${this.stringify(k)}:${this.stringify(value.values[i])}`
      );
      return `{${entries.join(", ")}}`;
    }
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
    if (Array.isArray(value)) return value.length > 0;
    if (isVoidDict(value)) return value.keys.length > 0;
    return true;
  }
}