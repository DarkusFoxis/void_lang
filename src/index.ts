#!/usr/bin/env node
//Void Language Interpreter
//Точка входа.

// Установка UTF-8 кодировки для Windows консоли
if (process.platform === 'win32') {
  const { execSync } = require('child_process');
  try {
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch (e) {
    // Игнорируем ошибки, консоль может быть с ограничениями
  }
}

import * as fs from "fs";
import * as path from "path";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Interpreter } from "./interpreter";

//Цвета для консоли.

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

//Баннер.

function printBanner(): void {
  console.log(colors.cyan(`
  ╔══════════════════════════════════╗
  ║     🌀 Void Language v1.0.1      ║
  ║     Interpreter by TypeScript    ║
  ╚══════════════════════════════════╝
  `));
}

//Обработка содержимого до @VoidEnd

function preprocessSource(source: string): string {
  //Находим @VoidEnd и обрезаем всё после него.
  const voidEndPattern = /@VoidEnd\s*;/;
  const match = source.match(voidEndPattern);
  if (match && match.index !== undefined) {
    return source.substring(0, match.index + match[0].length);
  }
  return source;
}

//Запуск файла.

function runFile(filePath: string): void {
  //Проверяем расширение.
  const ext = path.extname(filePath);
  if (ext !== ".void") {
    console.error(
      colors.red(`Ошибка: Ожидается файл с расширением .void, ` +
      `получен '${ext}'`)
    );
    process.exit(1);
  }

  //Проверяем существование файла.
  if (!fs.existsSync(filePath)) {
    console.error(
      colors.red(`Ошибка: Файл '${filePath}' не найден`)
    );
    process.exit(1);
  }

  //Читаем файл.
  const source = fs.readFileSync(filePath, "utf-8");
  const processedSource = preprocessSource(source);

  try {
    //Лексер.
    const lexer = new Lexer(processedSource);
    const tokens = lexer.tokenize();

    //Парсер.
    const parser = new Parser(tokens);
    const ast = parser.parse();

    //Интерпретатор.
    const interpreter = new Interpreter();
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

//Режим помощи.

function printHelp(): void {
  console.log(`
${colors.bold("Использование:")}
  void <файл.void>         Запустить файл
  void --help               Показать помощь
  void --version            Показать версию

${colors.bold("Синтаксис Void:")}

  ${colors.cyan("Структура программы:")}
    @VoidApp "ИмяПриложения";
    using style "Abyss";
    
    main() {
      // код
    }
    
    @VoidEnd;

  ${colors.cyan("Переменные:")}
    create:string name = "значение".
    create:int age = 25.
    create:float pi = 3.14.
    create:bool flag = true.

  ${colors.cyan("Ввод/вывод:")}
    echo("Hello, World!");
    create:string input = write("Введите: ");

  ${colors.cyan("Арифметика:")}
    + - * / % **

  ${colors.cyan("Сравнение:")}
    == != < > <= >=

  ${colors.cyan("Логические:")}
    && || !

  ${colors.cyan("Управляющие конструкции:")}
    if (условие) { ... } else { ... }
    while (условие) { ... }
    for (init; condition; update) { ... }

  ${colors.cyan("Комментарии:")}
    // Однострочный
    #* Многострочный *#

  ${colors.cyan("Встроенные функции:")}
    abs, sqrt, floor, ceil, round, min, max, random
    toInt, toFloat, toString, toBool
    length, upper, lower, trim, contains
  `);
}

//Main.

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
      console.log("Void Language v1.0.0");
      break;
    default:
      printBanner();
      runFile(arg);
      break;
  }
}
main();