#!/usr/bin/env node
//Void Language Interpreter
//Точка входа.

if (process.platform === 'win32') {
  const { execSync } = require('child_process');
  try { execSync('chcp 65001', { stdio: 'ignore' }); } catch (e) {}
}

import * as fs from "fs";
import * as path from "path";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Interpreter } from "./interpreter";

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

function printBanner(): void {
  console.log(colors.cyan(`
╔══════════════════════════════════╗
║     🌀 Void Language v1.4        ║
║     Interpreter by TypeScript    ║
╚══════════════════════════════════╝
`));
}

function preprocessSource(source: string): string {
  let processed = source;
  
  const importPattern = /@VoidImport\s+"([^"]+)"\s*;/g;
  processed = processed.replace(importPattern, '');
  
  const voidEndPattern = /@VoidEnd\s*;/;
  const match = processed.match(voidEndPattern);
  if (match && match.index !== undefined) {
    return processed.substring(0, match.index + match[0].length);
  }
  return processed;
}

function extractImports(source: string): string[] {
  const imports: string[] = [];
  const importPattern = /@VoidImport\s+"([^"]+)"\s*;/g;
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function loadAndParseFile(filePath: string): ReturnType<typeof Parser.prototype.parse> {
  const source = fs.readFileSync(filePath, "utf-8");
  const processedSource = preprocessSource(source);
  const lexer = new Lexer(processedSource);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

function runFile(filePath: string): void {
  const ext = path.extname(filePath);
  if (ext !== ".void") {
    console.error(colors.red(`Ошибка: Ожидается файл с расширением .void, получен '${ext}'`));
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(colors.red(`Ошибка: Файл '${filePath}' не найден`));
    process.exit(1);
  }

  const source = fs.readFileSync(filePath, "utf-8");
  const imports = extractImports(source);
  const dir = path.dirname(filePath);

  try {
    const interpreter = new Interpreter();
    
    for (const importPath of imports) {
      const fullPath = path.resolve(dir, importPath);
      if (!fs.existsSync(fullPath)) {
        console.error(colors.red(`Ошибка: Файл библиотеки '${fullPath}' не найден`));
        process.exit(1);
      }
      const libAst = loadAndParseFile(fullPath);
      if (!libAst.isLib) {
        console.error(colors.red(`Ошибка: '${importPath}' не является библиотекой (нет @VoidLibs)`));
        process.exit(1);
      }
      interpreter.registerLibrary(libAst);
    }
    
    const processedSource = preprocessSource(source);
    const lexer = new Lexer(processedSource);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    interpreter.execute(ast);
  } catch (error) {
    if (error instanceof Error) {
      console.error(colors.red(`\n${error.message}`));
    } else {
      console.error(colors.red(`\nНеизвестная ошибка: ${error}`));
    }
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
${colors.bold("Использование:")}
void <файл.void>         Запустить файл
void --help               Показать помощь
void --version            Показать версию

${colors.bold("Синтаксис Void:")}
${colors.cyan("Структура программы:")}
@VoidApp "ИмяПриложения";
@VoidSetting max_iteration = -1;
@VoidSetting automatic_type = true;
using style "Abyss";

fn sum(int a, int b) -> int {
    return a + b;
}

main() {
    // код
}
@VoidEnd;

${colors.cyan("Библиотеки:")}
@VoidLibs "MathLib";
namespace "math";
fn add(int a, int b) -> int { return a + b; }
@VoidEnd;

// Импорт: @VoidImport "libs/math.void";
// Вызов: math::add(1, 2);

${colors.cyan("Переменные и Ссылки:")}
create:string name = "значение";
create:int age = 25;
create:var x = "авто-тип";
create:void y = 42;
create:link ptr = &age;
create:link arrRef = &arr[0];
*ptr += 5;

${colors.cyan("Ввод/вывод:")}
echo("Hello, World!", *ptr);
create:string input = write("Введите: ");

${colors.cyan("Управляющие конструкции:")}
if (условие) { ... } else { ... }
while (условие) { ... }
for (init; condition; update) { ... }
break;    // выход из цикла
continue; // следующая итерация
`);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printBanner();
    printHelp();
    process.exit(0);
  }
  const arg = args[0];
  switch (arg) {
    case "--help":
    case "-h":
      printBanner();
      printHelp();
      break;
    case "--version":
    case "-v":
      console.log("Void Language v1.4");
      break;
    default:
      printBanner();
      runFile(arg);
      break;
  }
}

main();