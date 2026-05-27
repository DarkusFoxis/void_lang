// Интерпретатор: выполняет AST.
import {
  ASTNode, ProgramNode, MainNode, BlockNode, EchoNode, WriteNode,
  CreateVarNode, MultiCreateNode, AssignVarNode, IfNode, WhileNode,
  ForNode, BinaryExprNode, UnaryExprNode, NumberLiteralNode,
  FloatLiteralNode, StringLiteralNode, BoolLiteralNode, IdentifierNode,
  FunctionCallNode, RandCallNode, ListLiteralNode, DictLiteralNode,
  IndexAccessNode, MethodCallNode, FunctionDeclNode, ReturnNode, DereferenceNode, UpdateExprNode
} from "./parser";
import * as readlineSync from "readline-sync";

type VoidValue = string | number | boolean | null | VoidValue[] | VoidDict | VoidLink;

interface VoidDict { __isDict: true; keys: VoidValue[]; values: VoidValue[]; }
interface VoidLink { __isLink: true; targetName: string; }
function createVoidDict(): VoidDict { return { __isDict: true, keys: [], values: [] }; }
function isVoidDict(val: VoidValue): val is VoidDict { return val !== null && typeof val === "object" && !Array.isArray(val) && (val as any).__isDict === true; }
function isVoidLink(val: VoidValue): val is VoidLink { return val !== null && typeof val === "object" && (val as any).__isLink === true; }

interface Variable { type: string; value: VoidValue; }

class Environment {
  private variables: Map<string, Variable> = new Map();
  private parent: Environment | null;
  constructor(parent: Environment | null = null) { this.parent = parent; }
  define(name: string, type: string, value: VoidValue): void {
    if (this.variables.has(name)) throw new Error(`[Runtime Error] Переменная '${name}' уже определена.`);
    this.variables.set(name, { type, value });
  }
  get(name: string): Variable {
    if (this.variables.has(name)) return this.variables.get(name)!;
    if (this.parent) return this.parent.get(name);
    throw new Error(`[Runtime Error] Переменная '${name}' не определена.`);
  }
  set(name: string, value: VoidValue): void {
    if (this.variables.has(name)) { this.variables.get(name)!.value = value; return; }
    if (this.parent) { this.parent.set(name, value); return; }
    throw new Error(`[Runtime Error] Переменная '${name}' не определена.`);
  }
  has(name: string): boolean { return this.variables.has(name) || (this.parent ? this.parent.has(name) : false); }
}

class ReturnSignal { constructor(public value: VoidValue) {} }

export class Interpreter {
  private globalEnv: Environment;
  private appName: string = "";
  private style: string | null = null;
  private functions: Map<string, FunctionDeclNode> = new Map();

  constructor() { this.globalEnv = new Environment(); }

  public execute(program: ProgramNode): void {
    this.appName = program.appName; this.style = program.style;
    console.log(`\x1b[36m═══ Void App: ${this.appName} ═══\x1b[0m`);
    if (this.style) console.log(`\x1b[90mСтиль: ${this.style}\x1b[0m`);
    console.log();
    for (const func of program.functions) this.functions.set(func.name, func);
    try { for (const node of program.body) this.executeNode(node, this.globalEnv); } 
    catch (e) { if (e instanceof ReturnSignal) throw new Error("[Runtime Error] Оператор return использован вне функции."); throw e; }
    console.log(`\x1b[36m═══ Конец ${this.appName} ═══\x1b[0m`);
  }

  private executeNode(node: ASTNode, env: Environment): VoidValue {
    switch (node.type) {
      case "Main": return this.executeMain(node as MainNode, env);
      case "Block": return this.executeBlock(node as BlockNode, env);
      case "Echo": return this.executeEcho(node as EchoNode, env);
      case "Write": return this.executeWrite(node as WriteNode, env);
      case "CreateVar": return this.executeCreateVar(node as CreateVarNode, env);
      case "MultiCreate": return this.executeMultiCreate(node as MultiCreateNode, env);
      case "AssignVar": return this.executeAssignVar(node as AssignVarNode, env);
      case "If": return this.executeIf(node as IfNode, env);
      case "While": return this.executeWhile(node as WhileNode, env);
      case "For": return this.executeFor(node as ForNode, env);
      case "BinaryExpr": return this.executeBinaryExpr(node as BinaryExprNode, env);
      case "UnaryExpr": return this.executeUnaryExpr(node as UnaryExprNode, env);
      case "UpdateExpr": return this.executeUpdateExpr(node as UpdateExprNode, env);
      case "NumberLiteral": return (node as NumberLiteralNode).value;
      case "FloatLiteral": return (node as FloatLiteralNode).value;
      case "StringLiteral": return (node as StringLiteralNode).value;
      case "BoolLiteral": return (node as BoolLiteralNode).value;
      case "Identifier": return this.executeIdentifier(node as IdentifierNode, env);
      case "FunctionCall": return this.executeFunctionCall(node as FunctionCallNode, env);
      case "RandCall": return this.executeRandCall(node as RandCallNode, env);
      case "ListLiteral": return this.executeListLiteral(node as ListLiteralNode, env);
      case "DictLiteral": return this.executeDictLiteral(node as DictLiteralNode, env);
      case "IndexAccess": return this.executeIndexAccess(node as IndexAccessNode, env);
      case "MethodCall": return this.executeMethodCall(node as MethodCallNode, env);
      case "Return": return this.executeReturn(node as ReturnNode, env);
      case "FunctionDecl": return null;
      default: throw new Error(`[Runtime Error] Неизвестный узел AST: ${(node as any).type}.`);
    }
  }

  private executeUpdateExpr(node: UpdateExprNode, env: Environment): VoidValue {
    const target = node.target;
    let currentValue: number;
    let setter: (newValue: number) => void;

    if (target.type === "Identifier") {
      const name = (target as IdentifierNode).name;
      const variable = env.get(name);
      currentValue = this.toNumber(variable.value);
      setter = (newValue: number) => env.set(name, this.castValue(newValue, variable.type, name));
    } else if (target.type === "IndexAccess") {
      const indexNode = target as IndexAccessNode;
      const obj = this.executeNode(indexNode.object, env);
      const index = this.executeNode(indexNode.index, env);
      if (Array.isArray(obj)) {
        const idx = this.toNumber(index);
        let resolvedIdx = idx < 0 ? obj.length + idx : idx;
        if (resolvedIdx < 0 || resolvedIdx >= obj.length) throw new Error(`[Runtime Error] Индекс ${idx} выходит за границы списка.`);
        currentValue = this.toNumber(obj[resolvedIdx]);
        setter = (newValue: number) => { obj[resolvedIdx] = newValue; };
      } else if (isVoidDict(obj)) {
        const keyIdx = this.findDictKey(obj, index);
        if (keyIdx === -1) throw new Error(`[Runtime Error] Ключ '${this.stringify(index)}' не найден.`);
        currentValue = this.toNumber(obj.values[keyIdx]);
        setter = (newValue: number) => { obj.values[keyIdx] = newValue; };
      } else throw new Error(`[Runtime Error] Оператор ${node.operator} не применим к типу ${typeof obj}.`);
    } else if (target.type === "Dereference") {
      const linkName = (target as DereferenceNode).target;
      const linkVar = env.get(linkName);
      if (!isVoidLink(linkVar.value)) throw new Error(`[Runtime Error] '${linkName}' не ссылка.`);
      const targetName = linkVar.value.targetName;
      const targetVar = env.get(targetName);
      currentValue = this.toNumber(targetVar.value);
      setter = (newValue: number) => env.set(targetName, this.castValue(newValue, targetVar.type, targetName));
    } else throw new Error(`[Runtime Error] Оператор ${node.operator} применим только к переменным/индексам.`);

    const newValue = node.operator === "++" ? currentValue + 1 : currentValue - 1;
    setter(newValue);
    return node.isPrefix ? newValue : currentValue;
  }

  private executeReturn(node: ReturnNode, env: Environment): VoidValue { throw new ReturnSignal(node.value ? this.executeNode(node.value, env) : null); }
  private areEqual(left: VoidValue, right: VoidValue): boolean {
    if (typeof left === typeof right) return left === right;
    if ((typeof left === "boolean" || typeof left === "number") && (typeof right === "boolean" || typeof right === "number")) return this.toNumber(left) === this.toNumber(right);
    return this.stringify(left) === this.stringify(right);
  }
  private executeMain(node: MainNode, env: Environment): VoidValue { return this.executeBlock(node.body, env); }
  private executeBlock(node: BlockNode, parentEnv: Environment): VoidValue {
    const blockEnv = new Environment(parentEnv); let result: VoidValue = null;
    for (const stmt of node.statements) result = this.executeNode(stmt, blockEnv);
    return result;
  }
  private executeEcho(node: EchoNode, env: Environment): VoidValue { console.log(node.expressions.map(expr => this.stringify(this.executeNode(expr, env))).join(" ")); return null; }
  private executeWrite(node: WriteNode, env: Environment): VoidValue { return readlineSync.question(this.stringify(this.executeNode(node.prompt, env))); }
  
  private executeCreateVar(node: CreateVarNode, env: Environment): VoidValue {
    let value: VoidValue;
    if (node.initializer) value = this.executeNode(node.initializer, env);
    else {
      switch (node.varType) {
        case "string": value = ""; break; case "int": value = 0; break; case "float": value = 0.0; break;
        case "bool": value = false; break; case "list": value = []; break; case "dict": value = createVoidDict(); break;
        case "link": value = null; break; default: value = null;
      }
    }
    if (node.varType !== "list" && node.varType !== "dict" && node.varType !== "link") value = this.castValue(value, node.varType, node.name);
    else {
      if (node.varType === "list" && !Array.isArray(value)) throw new Error(`Переменная '${node.name}' типа list ожидает список.`);
      if (node.varType === "dict" && !isVoidDict(value)) throw new Error(`Переменная '${node.name}' типа dict ожидает словарь.`);
      if (node.varType === "link" && !isVoidLink(value) && value !== null) throw new Error(`Переменная '${node.name}' типа link ожидает ссылку.`);
    }
    env.define(node.name, node.varType, value); return value;
  }
  private executeMultiCreate(node: MultiCreateNode, env: Environment): VoidValue { for (const decl of node.declarations) this.executeCreateVar(decl, env); return null; }
  
  private executeAssignVar(node: AssignVarNode, env: Environment): VoidValue {
    let value = this.executeNode(node.value, env);
    if (node.target.type === "Identifier") {
      const name = (node.target as IdentifierNode).name; const variable = env.get(name);
      if (node.operator !== "=") value = this.applyBinaryOp(node.operator.substring(0, 1), variable.value, value);
      if (variable.type !== "list" && variable.type !== "dict" && variable.type !== "link") value = this.castValue(value, variable.type, name);
      env.set(name, value);
    } else if (node.target.type === "Dereference") {
      const linkName = (node.target as DereferenceNode).target; const linkVar = env.get(linkName);
      if (!isVoidLink(linkVar.value)) throw new Error(`[Runtime Error] '${linkName}' не ссылка.`);
      const targetName = linkVar.value.targetName; const targetVar = env.get(targetName);
      if (node.operator !== "=") value = this.applyBinaryOp(node.operator.substring(0, 1), targetVar.value, value);
      if (targetVar.type !== "list" && targetVar.type !== "dict" && targetVar.type !== "link") value = this.castValue(value, targetVar.type, targetName);
      env.set(targetName, value);
    } else if (node.target.type === "IndexAccess") this.assignIndex(node.target as IndexAccessNode, value, node.operator, env);
    return value;
  }

  private assignIndex(node: IndexAccessNode, value: VoidValue, operator: string, env: Environment): void {
    const obj = this.executeNode(node.object, env); const index = this.executeNode(node.index, env);
    if (Array.isArray(obj)) {
      const idx = this.toNumber(index); let resolvedIdx = idx < 0 ? obj.length + idx : idx;
      if (resolvedIdx < 0 || resolvedIdx >= obj.length) throw new Error(`[Runtime Error] Индекс вне границ.`);
      obj[resolvedIdx] = operator === "=" ? value : this.applyBinaryOp(operator.substring(0, 1), obj[resolvedIdx], value);
    } else if (isVoidDict(obj)) {
      const keyIdx = this.findDictKey(obj, index);
      if (keyIdx === -1) throw new Error(`[Runtime Error] Ключ не найден.`);
      obj.values[keyIdx] = operator === "=" ? value : this.applyBinaryOp(operator.substring(0, 1), obj.values[keyIdx], value);
    } else throw new Error(`[Runtime Error] [] не применим для записи.`);
  }

  private executeIf(node: IfNode, env: Environment): VoidValue {
    if (this.isTruthy(this.executeNode(node.condition, env))) return this.executeBlock(node.thenBranch, env);
    else if (node.elseBranch) return node.elseBranch.type === "If" ? this.executeIf(node.elseBranch as IfNode, env) : this.executeBlock(node.elseBranch as BlockNode, env);
    return null;
  }
  private executeWhile(node: WhileNode, env: Environment): VoidValue {
    let i = 0; while (this.isTruthy(this.executeNode(node.condition, env))) { this.executeBlock(node.body, env); if (++i > 1000000) throw new Error(`[Runtime Error] Бесконечный цикл.`); } return null;
  }
  private executeFor(node: ForNode, env: Environment): VoidValue {
    const forEnv = new Environment(env); let i = 0; if (node.init) this.executeNode(node.init, forEnv);
    while (this.isTruthy(this.executeNode(node.condition, forEnv))) { this.executeBlock(node.body, forEnv); if (node.update) this.executeNode(node.update, forEnv); if (++i > 1000000) throw new Error(`[Runtime Error] Бесконечный цикл.`); } return null;
  }
  
  private executeListLiteral(node: ListLiteralNode, env: Environment): VoidValue { return node.elements.map(e => this.executeNode(e, env)); }
  private executeDictLiteral(node: DictLiteralNode, env: Environment): VoidValue {
    const dict = createVoidDict(); for (const entry of node.entries) { dict.keys.push(this.executeNode(entry.key, env)); dict.values.push(this.executeNode(entry.value, env)); } return dict;
  }
  private executeIndexAccess(node: IndexAccessNode, env: Environment): VoidValue {
    const obj = this.executeNode(node.object, env); const index = this.executeNode(node.index, env);
    if (Array.isArray(obj) || typeof obj === "string") {
      const idx = this.toNumber(index); let resolvedIdx = idx < 0 ? obj.length + idx : idx;
      if (resolvedIdx < 0 || resolvedIdx >= obj.length) throw new Error(`[Runtime Error] Индекс вне границ.`);
      return obj[resolvedIdx];
    }
    if (isVoidDict(obj)) { const keyIdx = this.findDictKey(obj, index); if (keyIdx === -1) throw new Error(`[Runtime Error] Ключ не найден.`); return obj.values[keyIdx]; }
    throw new Error(`[Runtime Error] [] не применим.`);
  }
  
  private executeMethodCall(node: MethodCallNode, env: Environment): VoidValue {
    const variable = env.get(node.object);
    if (node.method === "add") {
      if (node.collectionType === "list") (variable.value as VoidValue[]).push(this.executeNode(node.args[0], env));
      else { const k = this.executeNode(node.args[0], env); const v = this.executeNode(node.args[1], env); const d = variable.value as VoidDict; const i = this.findDictKey(d, k); if (i !== -1) d.values[i] = v; else { d.keys.push(k); d.values.push(v); } }
    } else if (node.method === "delete") {
      if (node.collectionType === "list") { const i = this.toNumber(this.executeNode(node.args[0], env)); (variable.value as VoidValue[]).splice(i < 0 ? (variable.value as VoidValue[]).length + i : i, 1); }
      else { const i = this.findDictKey(variable.value as VoidDict, this.executeNode(node.args[0], env)); (variable.value as VoidDict).keys.splice(i, 1); (variable.value as VoidDict).values.splice(i, 1); }
    } else if (node.method === "clear") {
      if (node.collectionType === "list") (variable.value as VoidValue[]).length = 0;
      else { (variable.value as VoidDict).keys.length = 0; (variable.value as VoidDict).values.length = 0; }
    }
    return null;
  }
  private findDictKey(dict: VoidDict, key: VoidValue): number { for (let i = 0; i < dict.keys.length; i++) if (this.areEqual(dict.keys[i], key)) return i; return -1; }

  private applyBinaryOp(operator: string, left: VoidValue, right: VoidValue): VoidValue {
    switch (operator) {
      case "+": if (typeof left === "string" || typeof right === "string") return this.stringify(left) + this.stringify(right); if (typeof left === "number" && typeof right === "number") return left + right; if (Array.isArray(left) && Array.isArray(right)) return [...left, ...right]; throw new Error(`[Runtime Error] Нельзя сложить.`);
      case "-": return this.toNumber(left) - this.toNumber(right);
      case "*": return this.toNumber(left) * this.toNumber(right);
      case "/": const d = this.toNumber(right); if (d === 0) throw new Error("[Runtime Error] Деление на 0."); return this.toNumber(left) / d;
      case "%": const m = this.toNumber(right); if (m === 0) throw new Error("[Runtime Error] Деление на 0."); return this.toNumber(left) % m;
      case "**": return Math.pow(this.toNumber(left), this.toNumber(right));
      case "==": return this.areEqual(left, right); case "!=": return !this.areEqual(left, right);
      case "<": return this.toNumber(left) < this.toNumber(right); case ">": return this.toNumber(left) > this.toNumber(right);
      case "<=": return this.toNumber(left) <= this.toNumber(right); case ">=": return this.toNumber(left) >= this.toNumber(right);
      case "&&": return this.isTruthy(left) && this.isTruthy(right); case "||": return this.isTruthy(left) || this.isTruthy(right);
      default: throw new Error(`[Runtime Error] Неизвестный оператор.`);
    }
  }
  private executeBinaryExpr(node: BinaryExprNode, env: Environment): VoidValue { return this.applyBinaryOp(node.operator, this.executeNode(node.left, env), this.executeNode(node.right, env)); }
  
  private executeUnaryExpr(node: UnaryExprNode, env: Environment): VoidValue {
    const operand = this.executeNode(node.operand, env);
    switch (node.operator) {
      case "-": return -this.toNumber(operand);
      case "!": return !this.isTruthy(operand);
      case "&": if (node.operand.type === "Identifier") return { __isLink: true, targetName: (node.operand as IdentifierNode).name } as VoidLink; throw new Error("[Runtime Error] Ссылка только на переменную.");
      case "*": if (isVoidLink(operand)) return env.get(operand.targetName).value; throw new Error("[Runtime Error] * только для ссылок.");
      default: throw new Error(`[Runtime Error] Неизвестный унарный оператор.`);
    }
  }

  private executeIdentifier(node: IdentifierNode, env: Environment): VoidValue { return env.get(node.name).value; }
  
  private executeFunctionCall(node: FunctionCallNode, env: Environment): VoidValue {
    const args = node.args.map(arg => this.executeNode(arg, env));
    switch (node.name) {
      case "abs": return Math.abs(this.toNumber(args[0])); case "sqrt": return Math.sqrt(this.toNumber(args[0]));
      case "floor": return Math.floor(this.toNumber(args[0])); case "ceil": return Math.ceil(this.toNumber(args[0]));
      case "round": return Math.round(this.toNumber(args[0])); case "min": return Math.min(this.toNumber(args[0]), this.toNumber(args[1]));
      case "max": return Math.max(this.toNumber(args[0]), this.toNumber(args[1])); case "random": return Math.random();
      case "toInt": return parseInt(String(args[0]), 10) || 0; case "toFloat": return parseFloat(String(args[0])) || 0.0;
      case "toString": return this.stringify(args[0]); case "toBool": return this.isTruthy(args[0]);
      case "length": if (Array.isArray(args[0])) return args[0].length; if (isVoidDict(args[0])) return (args[0] as VoidDict).keys.length; return String(args[0]).length;
      case "upper": return String(args[0]).toUpperCase(); case "lower": return String(args[0]).toLowerCase(); case "trim": return String(args[0]).trim();
      case "contains": if (Array.isArray(args[0])) return (args[0] as VoidValue[]).some(item => this.areEqual(item, args[1])); return String(args[0]).includes(String(args[1]));
      default:
        const func = this.functions.get(node.name);
        if (func) {
          if (args.length !== func.params.length) throw new Error(`[Runtime Error] Неверное кол-во аргументов.`);
          const funcEnv = new Environment(env);
          for (let i = 0; i < func.params.length; i++) {
            let argVal = args[i]; if (func.params[i].type !== "list" && func.params[i].type !== "dict" && func.params[i].type !== "link") argVal = this.castValue(argVal, func.params[i].type, func.params[i].name);
            funcEnv.define(func.params[i].name, func.params[i].type, argVal);
          }
          try { this.executeBlock(func.body, funcEnv); } catch (e) { if (e instanceof ReturnSignal) return e.value; throw e; }
          return null;
        }
        throw new Error(`[Runtime Error] Неизвестная функция: '${node.name}'.`);
    }
  }
  
  private executeRandCall(node: RandCallNode, env: Environment): VoidValue {
    const min = this.toNumber(this.executeNode(node.min, env)), max = this.toNumber(this.executeNode(node.max, env));
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  
  private castValue(value: VoidValue, type: string, varName: string): VoidValue {
    switch (type) {
      case "string": return this.stringify(value);
      case "int": const n1 = Number(value); if (isNaN(n1)) throw new Error(`[Runtime Error] Нельзя в int.`); return Math.floor(n1);
      case "float": const n2 = Number(value); if (isNaN(n2)) throw new Error(`[Runtime Error] Нельзя в float.`); return n2;
      case "bool": return this.isTruthy(value);
      case "link": if (isVoidLink(value) || value === null) return value; throw new Error(`[Runtime Error] Нельзя в link.`);
      default: return value;
    }
  }
  
  private stringify(value: VoidValue): string {
    if (value === null) return "null"; if (typeof value === "boolean") return value ? "true" : "false";
    if (Array.isArray(value)) return `[${value.map(v => this.stringify(v)).join(", ")}]`;
    if (isVoidDict(value)) return `{${value.keys.map((k, i) => `${this.stringify(k)}:${this.stringify(value.values[i])}`).join(", ")}}`;
    if (isVoidLink(value)) return `&${value.targetName}`; return String(value);
  }
  private toNumber(value: VoidValue): number {
    if (typeof value === "number") return value; if (typeof value === "boolean") return value ? 1 : 0;
    const n = Number(value); if (isNaN(n) && typeof value === "string") throw new Error(`[Runtime Error] Нельзя в число.`); return n || 0;
  }
  private isTruthy(value: VoidValue): boolean {
    if (value === null) return false; if (typeof value === "boolean") return value; if (typeof value === "number") return value !== 0;
    if (typeof value === "string") return value.length > 0; if (Array.isArray(value)) return value.length > 0; if (isVoidDict(value)) return value.keys.length > 0; return true;
  }
}