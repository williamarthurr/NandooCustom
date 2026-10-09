import { readFile, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function splitStatements(sql) {
    const statements = [];
    let statement = "";
    let quote = null;
    let lineComment = false;
    let blockComment = false;

    for (let index = 0; index < sql.length; index += 1) {
        const character = sql[index];
        const next = sql[index + 1];

        if (lineComment) {
            if (character === "\n") {
                lineComment = false;
                statement += "\n";
            }
            continue;
        }
        if (blockComment) {
            if (character === "*" && next === "/") {
                blockComment = false;
                index += 1;
            }
            continue;
        }
        if (quote) {
            statement += character;
            if (quote !== "`" && character === "\\" && index + 1 < sql.length) {
                statement += sql[index + 1];
                index += 1;
            } else if (character === quote) {
                if (next === quote) {
                    statement += next;
                    index += 1;
                } else {
                    quote = null;
                }
            }
            continue;
        }

        if (character === "'" || character === '"' || character === "`") {
            quote = character;
            statement += character;
        } else if (character === "#" || (character === "-" && next === "-" && /\s|$/.test(sql[index + 2] ?? ""))) {
            lineComment = true;
            if (character === "-") index += 1;
        } else if (character === "/" && next === "*") {
            blockComment = true;
            index += 1;
        } else if (character === ";") {
            if (statement.trim()) statements.push(statement.trim());
            statement = "";
        } else {
            statement += character;
        }
    }

    if (quote || blockComment) throw new Error("malformed");
    if (statement.trim()) statements.push(statement.trim());
    return statements;
}

function skipWhitespace(input, cursor) {
    while (/\s/.test(input[cursor.index] ?? "")) cursor.index += 1;
}

function readIdentifier(input, cursor) {
    skipWhitespace(input, cursor);
    if (input[cursor.index] === "`") {
        cursor.index += 1;
        let value = "";
        while (cursor.index < input.length) {
            const character = input[cursor.index];
            if (character === "`") {
                if (input[cursor.index + 1] === "`") {
                    value += "`";
                    cursor.index += 2;
                } else {
                    cursor.index += 1;
                    return value;
                }
            } else {
                value += character;
                cursor.index += 1;
            }
        }
        throw new Error("malformed");
    }

    const match = /^[A-Za-z_$][\w$]*/.exec(input.slice(cursor.index));
    if (!match) throw new Error("malformed");
    cursor.index += match[0].length;
    return match[0];
}

function sqliteIdentifier(identifier) {
    return `"${identifier.replaceAll('"', '""')}"`;
}

function decodeMysqlString(input, cursor) {
    const delimiter = input[cursor.index];
    cursor.index += 1;
    let value = "";
    while (cursor.index < input.length) {
        const character = input[cursor.index];
        if (character === delimiter) {
            if (input[cursor.index + 1] === delimiter) {
                value += delimiter;
                cursor.index += 2;
                continue;
            }
            cursor.index += 1;
            return value;
        }
        if (character === "\\") {
            cursor.index += 1;
            if (cursor.index >= input.length) throw new Error("malformed");
            const escaped = input[cursor.index];
            const escapes = {
                "0": "\0",
                b: "\b",
                n: "\n",
                r: "\r",
                t: "\t",
                Z: "\x1a",
                "\\": "\\",
                "'": "'",
                '"': '"'
            };
            value += Object.hasOwn(escapes, escaped) ? escapes[escaped] : escaped;
            cursor.index += 1;
            continue;
        }
        value += character;
        cursor.index += 1;
    }
    throw new Error("malformed");
}

function sqliteString(value) {
    const parts = value.split("\0");
    if (parts.length === 1) return `'${value.replaceAll("'", "''")}'`;
    const expressions = [];
    for (let index = 0; index < parts.length; index += 1) {
        if (index > 0) expressions.push("char(0)");
        if (parts[index]) expressions.push(`'${parts[index].replaceAll("'", "''")}'`);
    }
    return expressions.join(" || ") || "''";
}

function readValue(input, cursor) {
    skipWhitespace(input, cursor);
    const character = input[cursor.index];
    if (character === "'" || character === '"') {
        return sqliteString(decodeMysqlString(input, cursor));
    }

    const match = /^(?:NULL|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)/i.exec(input.slice(cursor.index));
    if (!match) throw new Error("malformed");
    const token = match[0];
    const following = input[cursor.index + token.length] ?? "";
    if (/[A-Za-z0-9_$\.]/.test(following)) throw new Error("malformed");
    cursor.index += token.length;
    return /^null$/i.test(token) ? "NULL" : token;
}

function readValues(input, cursor) {
    const tuples = [];
    skipWhitespace(input, cursor);
    while (cursor.index < input.length) {
        if (input[cursor.index] !== "(") throw new Error("malformed");
        cursor.index += 1;
        const values = [];
        skipWhitespace(input, cursor);
        if (input[cursor.index] === ")") throw new Error("malformed");
        while (true) {
            values.push(readValue(input, cursor));
            skipWhitespace(input, cursor);
            if (input[cursor.index] === ",") {
                cursor.index += 1;
                continue;
            }
            if (input[cursor.index] === ")") {
                cursor.index += 1;
                break;
            }
            throw new Error("malformed");
        }
        tuples.push(`(${values.join(", ")})`);
        skipWhitespace(input, cursor);
        if (cursor.index === input.length) break;
        if (input[cursor.index] !== ",") throw new Error("malformed");
        cursor.index += 1;
        skipWhitespace(input, cursor);
    }
    if (!tuples.length) throw new Error("malformed");
    return tuples;
}

function parseCreateTable(statement) {
    if (!/^CREATE\s+TABLE\b/i.test(statement)) return null;
    const cursor = { index: /^CREATE\s+TABLE\b/i.exec(statement)[0].length };
    if (/^IF\s+NOT\s+EXISTS\b/i.test(statement.slice(cursor.index).trimStart())) {
        skipWhitespace(statement, cursor);
        cursor.index += /^IF\s+NOT\s+EXISTS\b/i.exec(statement.slice(cursor.index))[0].length;
    }
    const identifiers = [readIdentifier(statement, cursor)];
    skipWhitespace(statement, cursor);
    while (statement[cursor.index] === ".") {
        cursor.index += 1;
        identifiers.push(readIdentifier(statement, cursor));
        skipWhitespace(statement, cursor);
    }
    if (statement[cursor.index] !== "(") return null;

    cursor.index += 1;
    let depth = 1;
    let quote = null;
    let segment = "";
    const columns = [];
    while (cursor.index < statement.length && depth > 0) {
        const character = statement[cursor.index];
        const next = statement[cursor.index + 1];
        if (quote) {
            segment += character;
            if (character === quote) {
                if (next === quote) {
                    segment += next;
                    cursor.index += 1;
                } else {
                    quote = null;
                }
            } else if (quote !== "`" && character === "\\" && cursor.index + 1 < statement.length) {
                segment += next;
                cursor.index += 1;
            }
        } else if (character === "`" || character === "'" || character === '"') {
            quote = character;
            segment += character;
        } else if (character === "(") {
            depth += 1;
            segment += character;
        } else if (character === ")") {
            depth -= 1;
            if (depth === 0) {
                const match = /^\s*`((?:``|[^`])+)`\s+/.exec(segment);
                if (match) columns.push(match[1].replaceAll("``", "`"));
            } else {
                segment += character;
            }
        } else if (character === "," && depth === 1) {
            const match = /^\s*`((?:``|[^`])+)`\s+/.exec(segment);
            if (match) columns.push(match[1].replaceAll("``", "`"));
            segment = "";
        } else {
            segment += character;
        }
        cursor.index += 1;
    }
    if (depth !== 0 || quote) throw new Error("malformed");
    return { table: identifiers.at(-1), columns };
}

function parseInsert(statement, schemas = null) {
    if (!/^INSERT\s+INTO\b/i.test(statement)) return null;
    const cursor = { index: 0 };
    const keyword = /^INSERT\s+INTO\b/i.exec(statement);
    cursor.index = keyword[0].length;
    const identifiers = [readIdentifier(statement, cursor)];
    skipWhitespace(statement, cursor);
    while (statement[cursor.index] === ".") {
        cursor.index += 1;
        identifiers.push(readIdentifier(statement, cursor));
        skipWhitespace(statement, cursor);
    }
    const table = identifiers.at(-1);

    let columns = null;
    if (statement[cursor.index] === "(") {
        cursor.index += 1;
        columns = [];
        while (true) {
            columns.push(readIdentifier(statement, cursor));
            skipWhitespace(statement, cursor);
            if (statement[cursor.index] === ")") {
                cursor.index += 1;
                break;
            } else {
                if (statement[cursor.index] !== ",") throw new Error("malformed");
                cursor.index += 1;
            }
        }
    } else if (schemas?.get(table)?.length) {
        columns = schemas.get(table);
    }

    skipWhitespace(statement, cursor);
    const valuesKeyword = /^VALUES\b/i.exec(statement.slice(cursor.index));
    if (!valuesKeyword) throw new Error("malformed");
    cursor.index += valuesKeyword[0].length;
    const tuples = readValues(statement, cursor);
    const columnSql = columns ? ` (${columns.map(sqliteIdentifier).join(", ")})` : "";
    return {
        table,
        rows: tuples.length,
        sql: `INSERT INTO ${sqliteIdentifier(table)}${columnSql} VALUES ${tuples.join(", ")};`
    };
}

export function convertMysqlDump(sql) {
    const inserts = [];
    const counts = new Map();
    const schemas = new Map();
    const insertOrder = new Map([
        ["masterbarang", 0],
        ["masterpelanggan", 1],
        ["mastersupplier", 2],
        ["users", 3],
        ["stokin", 4],
        ["penjualan", 5],
        ["detailstokin", 6],
        ["detailpenjualan", 7],
        ["inventorystock", 8],
        ["inventorylog", 9]
    ]);
    const sourceStatements = splitStatements(sql);
    for (const statement of sourceStatements) {
        if (!/^CREATE\s+TABLE\b/i.test(statement)) continue;
        try {
            const schema = parseCreateTable(statement);
            if (schema?.columns.length) schemas.set(schema.table, schema.columns);
        } catch {
            throw new Error("Unsupported or malformed CREATE TABLE statement.");
        }
    }

    let statementNumber = 0;
    for (const statement of sourceStatements) {
        statementNumber += 1;
        if (!/^INSERT\s+INTO\b/i.test(statement)) continue;
        try {
            const insert = parseInsert(statement, schemas);
            inserts.push({ ...insert, statementNumber });
            counts.set(insert.table, (counts.get(insert.table) ?? 0) + insert.rows);
        } catch {
            throw new Error(`Unsupported or malformed INSERT statement ${statementNumber}.`);
        }
    }
    inserts.sort((left, right) =>
        (insertOrder.get(left.table) ?? Number.MAX_SAFE_INTEGER) -
            (insertOrder.get(right.table) ?? Number.MAX_SAFE_INTEGER) ||
        left.statementNumber - right.statementNumber
    );
    return { sql: inserts.length ? `${inserts.map((insert) => insert.sql).join("\n")}\n` : "", counts };
}

export function parseArguments(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const name = args[index];
        if (name !== "--input" && name !== "--output") throw new Error("Invalid arguments.");
        if (options[name.slice(2)] || !args[index + 1] || args[index + 1].startsWith("--")) {
            throw new Error("Invalid arguments.");
        }
        options[name.slice(2)] = args[index + 1];
        index += 1;
    }
    if (!options.input || !options.output ||
        !path.isAbsolute(options.input) || !path.isAbsolute(options.output)) {
        throw new Error("Both --input and --output must be absolute paths.");
    }
    if (path.resolve(options.input).toLowerCase() === path.resolve(options.output).toLowerCase()) {
        throw new Error("Input and output paths must be different.");
    }
    return options;
}

export async function importMysqlDump({ input, output }) {
    const source = await realpath(input);
    let destination;
    try {
        destination = await realpath(output);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        destination = path.resolve(output);
    }
    if (source.toLowerCase() === destination.toLowerCase()) {
        throw new Error("Input and output paths must be different.");
    }

    const dump = await readFile(input, "utf8");
    const converted = convertMysqlDump(dump);
    await writeFile(output, converted.sql, { encoding: "utf8", flag: "wx" });
    return converted.counts;
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const counts = await importMysqlDump(options);
    for (const [table, count] of counts) console.log(`${table}: ${count}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch(() => {
        console.error("Import failed.");
        process.exitCode = 1;
    });
}
