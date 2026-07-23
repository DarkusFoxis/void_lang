// Интерпретатор: выполняет AST.
import {
  ASTNode, ProgramNode, MainNode, BlockNode, EchoNode, WriteNode,
  CreateVarNode, MultiCreateNode, AssignVarNode, IfNode, WhileNode,
  ForNode, BinaryExprNode, UnaryExprNode, NumberLiteralNode,
  FloatLiteralNode, StringLiteralNode, BoolLiteralNode, IdentifierNode,
  FunctionCallNode, RandCallNode, ListLiteralNode, DictLiteralNode,
  IndexAccessNode, MethodCallNode, FunctionDeclNode, ReturnNode, DereferenceNode, UpdateExprNode,
  VoidConfig, ReferenceNode, ArrayElementRefNode, NamespaceCallNode
} from "./parser";
import * as readlineSync from "readline-sync";

type VoidValue = string | number | boolean | null | VoidValue[] | VoidDict | VoidLink | VoidArrayElementRef;

interface VoidDict { __isDict: true; keys: VoidValue[]; values: VoidValue[]; }
interface VoidLink { __isLink: true; targetName: string; }
interface VoidArrayElementRef { __isArrayElementRef: true; arrayName: string; indexNode: any; }
function createVoidDict(): VoidDict { return { __isDict: true, keys: [], values: [] }; }
function isVoidDict(val: VoidValue): val is VoidDict { return val !== null && typeof val === "object" && !Array.isArray(val) && (val as any).__isDict === true; }
function isVoidLink(val: VoidValue): val is VoidLink { return val !== null && typeof val === "object" && (val as any).__isLink === true; }
function isVoidArrayElementRef(val: VoidValue): val is VoidArrayElementRef { return val !== null && typeof val === "object" && (val as any).__isArrayElementRef === true; }

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
  setType(name: string, type: string): void {
    if (this.variables.has(name)) { this.variables.get(name)!.type = type; return; }
    if (this.parent) { this.parent.setType(name, type); return; }
    throw new Error(`[Runtime Error] Переменная '${name}' не определена.`);
  }
  has(name: string): boolean { return this.variables.has(name) || (this.parent ? this.parent.has(name) : false); }
}

class ReturnSignal { constructor(public value: VoidValue) {} }
class BreakSignal {}
class ContinueSignal {}

export class Interpreter {
  private globalEnv: Environment;
  private appName: string = "";
  private style: string | null = null;
  private config: VoidConfig = { maxIteration: 1_000_000, automaticType: false };
  private functions: Map<string, FunctionDeclNode> = new Map();
  private namespaces: Map<string, Map<string, FunctionDeclNode>> = new Map();
  private importedNamespaces: Map<string, Map<string, FunctionDeclNode>> = new Map();

  constructor() { this.globalEnv = new Environment(); }

  public execute(program: ProgramNode): void {
    this.appName = program.appName; this.style = program.style;
    this.config = program.config;
    
    if (!program.isLib) {
      console.log(`\x1b[36m═══ Void App: ${this.appName} ═══\x1b[0m`);
      if (this.style) console.log(`\x1b[90mСтиль: ${this.style}\x1b[0m`);
      if (this.config.maxIteration === -1) console.log(`\x1b[90mНастройки: max_iteration = ∞\x1b[0m`);
      if (this.config.automaticType) console.log(`\x1b[90mНастройки: automatic_type = true\x1b[0m`);
      console.log();
    }
    
    for (const func of program.functions) this.functions.set(func.name, func);
    
    if (program.isLib && program.namespace) {
      const nsFuncs = new Map<string, FunctionDeclNode>();
      for (const func of program.functions) nsFuncs.set(func.name, func);
      this.namespaces.set(program.namespace, nsFuncs);
    }
    
    if (!program.isLib) {
      try { for (const node of program.body) this.executeNode(node, this.globalEnv); } 
      catch (e) { if (e instanceof ReturnSignal) throw new Error("[Runtime Error] Оператор return использован вне функции."); throw e; }
      console.log(`\x1b[36m═══ Конец ${this.appName} ═══\x1b[0m`);
    }
  }

  public registerLibrary(program: ProgramNode): void {
    for (const func of program.functions) this.functions.set(func.name, func);
    if (program.namespace) {
      const nsFuncs = new Map<string, FunctionDeclNode>();
      for (const func of program.functions) nsFuncs.set(func.name, func);
      this.namespaces.set(program.namespace, nsFuncs);
      this.importedNamespaces.set(program.namespace, nsFuncs);
    }
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
      case "Reference": return this.executeReference(node as ReferenceNode, env);
      case "ArrayElementRef": return this.executeArrayElementRef(node as ArrayElementRefNode, env);
      case "Dereference": return this.executeDereference(node as DereferenceNode, env);
      case "NamespaceCall": return this.executeNamespaceCall(node as NamespaceCallNode, env);
      case "Break": throw new BreakSignal();
      case "Continue": throw new ContinueSignal();
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
      const derefNode = target as DereferenceNode;
      const derefValue = this.executeDereference(derefNode, env);
      currentValue = this.toNumber(derefValue);
      setter = (newValue: number) => {
        if (derefNode.target.type === "Identifier") {
          const name = (derefNode.target as IdentifierNode).name;
          const variable = env.get(name);
          if (isVoidLink(variable.value)) {
            const targetName = variable.value.targetName;
            const targetVar = env.get(targetName);
            env.set(targetName, this.castValue(newValue, targetVar.type, targetName));
          }
        } else if (derefNode.target.type === "ArrayElementRef") {
          const ref = this.executeArrayElementRef(derefNode.target as ArrayElementRefNode, env);
          const { arr, idx } = this.getArrayElementRef(ref, env);
          arr[idx] = newValue;
        }
      };
    } else if (target.type === "ArrayElementRef") {
      const refNode = target as ArrayElementRefNode;
      const ref = this.executeArrayElementRef(refNode, env);
      const { arr, idx } = this.getArrayElementRef(ref, env);
      currentValue = this.toNumber(arr[idx]);
      setter = (newValue: number) => { arr[idx] = newValue; };
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
    let actualType = node.varType;
    
    if (node.initializer) {
      value = this.executeNode(node.initializer, env);
      
      if (node.varType === "var") {
        actualType = this.inferType(value);
      } else if (node.varType === "void") {
        actualType = "void";
      }
    } else {
      switch (node.varType) {
        case "string": value = ""; break;
        case "int": value = 0; break;
        case "float": value = 0.0; break;
        case "bool": value = false; break;
        case "list": value = []; break;
        case "dict": value = createVoidDict(); break;
        case "link": value = null; break;
        case "var": value = null; actualType = "null"; break;
        case "void": value = null; actualType = "null"; break;
        default: value = null;
      }
    }
    
    if (node.varType !== "list" && node.varType !== "dict" && node.varType !== "link" && 
        node.varType !== "var" && node.varType !== "void") {
      value = this.castValue(value, node.varType, node.name);
    } else {
      if (node.varType === "list" && !Array.isArray(value)) throw new Error(`Переменная '${node.name}' типа list ожидает список.`);
      if (node.varType === "dict" && !isVoidDict(value)) throw new Error(`Переменная '${node.name}' типа dict ожидает словарь.`);
      if (node.varType === "link" && !isVoidLink(value) && !isVoidArrayElementRef(value) && value !== null) throw new Error(`Переменная '${node.name}' типа link ожидает ссылку.`);
    }
    
    env.define(node.name, actualType, value);
    return value;
  }

  private inferType(value: VoidValue): string {
    if (value === null) return "null";
    if (typeof value === "string") return "string";
    if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
    if (typeof value === "boolean") return "bool";
    if (Array.isArray(value)) return "list";
    if (isVoidDict(value)) return "dict";
    if (isVoidLink(value)) return "link";
    return "null";
  }
  private executeMultiCreate(node: MultiCreateNode, env: Environment): VoidValue { for (const decl of node.declarations) this.executeCreateVar(decl, env); return null; }
  
  private executeAssignVar(node: AssignVarNode, env: Environment): VoidValue {
    let value = this.executeNode(node.value, env);
    if (node.target.type === "Identifier") {
      const name = (node.target as IdentifierNode).name;
      const variable = env.get(name);
      
      if (node.operator !== "=") {
        value = this.applyBinaryOp(node.operator.substring(0, 1), variable.value, value);
      }
      
      if (variable.type === "var" || variable.type === "void") {
        env.setType(name, this.inferType(value));
      } else if (variable.type !== "list" && variable.type !== "dict" && variable.type !== "link") {
        value = this.castValue(value, variable.type, name);
      }
      
      env.set(name, value);
    } else if (node.target.type === "Dereference") {
      const derefNode = node.target as DereferenceNode;
      if (derefNode.target.type === "Identifier") {
        const linkName = (derefNode.target as IdentifierNode).name;
        const linkVar = env.get(linkName);
        if (isVoidLink(linkVar.value)) {
          const targetName = linkVar.value.targetName;
          const targetVar = env.get(targetName);
          
          if (node.operator !== "=") {
            value = this.applyBinaryOp(node.operator.substring(0, 1), targetVar.value, value);
          }
          
          if (targetVar.type === "var" || targetVar.type === "void") {
            env.setType(targetName, this.inferType(value));
          } else if (targetVar.type !== "list" && targetVar.type !== "dict" && targetVar.type !== "link") {
            value = this.castValue(value, targetVar.type, targetName);
          }
          
          env.set(targetName, value);
        } else if (isVoidArrayElementRef(linkVar.value)) {
          const { arr, idx } = this.getArrayElementRef(linkVar.value, env);
          
          if (node.operator !== "=") {
            value = this.applyBinaryOp(node.operator.substring(0, 1), arr[idx], value);
          }
          
          arr[idx] = value;
        } else {
          throw new Error(`[Runtime Error] '${linkName}' не ссылка.`);
        }
      } else if (derefNode.target.type === "ArrayElementRef") {
        const ref = this.executeArrayElementRef(derefNode.target as ArrayElementRefNode, env);
        const { arr, idx } = this.getArrayElementRef(ref, env);
        
        if (node.operator !== "=") {
          value = this.applyBinaryOp(node.operator.substring(0, 1), arr[idx], value);
        }
        
        arr[idx] = value;
      }
    } else if (node.target.type === "IndexAccess") {
      this.assignIndex(node.target as IndexAccessNode, value, node.operator, env);
    }
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
    let i = 0;
    while (this.isTruthy(this.executeNode(node.condition, env))) {
      try {
        this.executeBlock(node.body, env);
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
      if (this.config.maxIteration !== -1 && ++i > this.config.maxIteration) {
        throw new Error(`[Runtime Error] Превышен лимит итераций (${this.config.maxIteration}).`);
      }
    }
    return null;
  }

  private executeFor(node: ForNode, env: Environment): VoidValue {
    const forEnv = new Environment(env);
    let i = 0;
    if (node.init) this.executeNode(node.init, forEnv);
    while (this.isTruthy(this.executeNode(node.condition, forEnv))) {
      try {
        this.executeBlock(node.body, forEnv);
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) {
          if (node.update) this.executeNode(node.update, forEnv);
          continue;
        }
        throw e;
      }
      if (node.update) this.executeNode(node.update, forEnv);
      if (this.config.maxIteration !== -1 && ++i > this.config.maxIteration) {
        throw new Error(`[Runtime Error] Превышен лимит итераций (${this.config.maxIteration}).`);
      }
    }
    return null;
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
    if (node.operator === "-") {
      const operand = this.executeNode(node.operand, env);
      return -this.toNumber(operand);
    }
    if (node.operator === "!") {
      const operand = this.executeNode(node.operand, env);
      return !this.isTruthy(operand);
    }
    throw new Error(`[Runtime Error] Неизвестный унарный оператор.`);
  }

  private executeReference(node: ReferenceNode, env: Environment): VoidValue {
    return { __isLink: true, targetName: node.target } as VoidLink;
  }

  private executeArrayElementRef(node: ArrayElementRefNode, env: Environment): VoidArrayElementRef {
    return { __isArrayElementRef: true, arrayName: node.array, indexNode: node.index };
  }

  private getArrayElementRef(ref: VoidArrayElementRef, env: Environment): { arr: VoidValue[]; idx: number } {
    const arr = env.get(ref.arrayName).value;
    if (!Array.isArray(arr)) throw new Error(`[Runtime Error] '${ref.arrayName}' не массив.`);
    const index = this.toNumber(this.executeNode(ref.indexNode, env));
    let resolvedIdx = index < 0 ? arr.length + index : index;
    if (resolvedIdx < 0 || resolvedIdx >= arr.length) throw new Error(`[Runtime Error] Индекс вне границ.`);
    return { arr, idx: resolvedIdx };
  }

  private executeDereference(node: DereferenceNode, env: Environment): VoidValue {
    const target = node.target;
    if (target.type === "Identifier") {
      const name = (target as IdentifierNode).name;
      const variable = env.get(name);
      if (isVoidLink(variable.value)) {
        return env.get(variable.value.targetName).value;
      }
      if (isVoidArrayElementRef(variable.value)) {
        const { arr, idx } = this.getArrayElementRef(variable.value, env);
        return arr[idx];
      }
      throw new Error(`[Runtime Error] * только для ссылок.`);
    } else if (target.type === "ArrayElementRef") {
      const refNode = target as ArrayElementRefNode;
      const ref = { __isArrayElementRef: true as const, arrayName: refNode.array, indexNode: refNode.index };
      const arr = env.get(ref.arrayName).value;
      if (!Array.isArray(arr)) throw new Error(`[Runtime Error] '${ref.arrayName}' не массив.`);
      const index = this.toNumber(this.executeNode(ref.indexNode, env));
      let resolvedIdx = index < 0 ? arr.length + index : index;
      if (resolvedIdx < 0 || resolvedIdx >= arr.length) throw new Error(`[Runtime Error] Индекс вне границ.`);
      return arr[resolvedIdx];
    } else if (target.type === "IndexAccess") {
      const indexAccess = target as IndexAccessNode;
      const obj = this.executeNode(indexAccess.object, env);
      const index = this.executeNode(indexAccess.index, env);
      if (Array.isArray(obj)) {
        const idx = this.toNumber(index);
        let resolvedIdx = idx < 0 ? obj.length + idx : idx;
        if (resolvedIdx < 0 || resolvedIdx >= obj.length) throw new Error(`[Runtime Error] Индекс вне границ.`);
        return obj[resolvedIdx];
      }
      throw new Error(`[Runtime Error] * не применим.`);
    }
    throw new Error(`[Runtime Error] * не применим.`);
  }

  private executeIdentifier(node: IdentifierNode, env: Environment): VoidValue { return env.get(node.name).value; }
  
  private executeNamespaceCall(node: NamespaceCallNode, env: Environment): VoidValue {
    const nsFuncs = this.namespaces.get(node.namespace);
    if (!nsFuncs) throw new Error(`[Runtime Error] Пространство имён '${node.namespace}' не найдено.`);
    const func = nsFuncs.get(node.name);
    if (!func) throw new Error(`[Runtime Error] Функция '${node.name}' не найдена в '${node.namespace}'.`);
    
    const args = node.args.map(arg => this.executeNode(arg, env));
    if (args.length !== func.params.length) throw new Error(`[Runtime Error] Неверное кол-во аргументов для '${node.namespace}::${node.name}'.`);
    
    const funcEnv = new Environment(env);
    for (let i = 0; i < func.params.length; i++) {
      let argVal = args[i];
      if (func.params[i].type !== "list" && func.params[i].type !== "dict" && func.params[i].type !== "link") {
        argVal = this.castValue(argVal, func.params[i].type, func.params[i].name);
      }
      funcEnv.define(func.params[i].name, func.params[i].type, argVal);
    }
    
    try { this.executeBlock(func.body, funcEnv); } catch (e) { if (e instanceof ReturnSignal) return e.value; throw e; }
    return null;
  }

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