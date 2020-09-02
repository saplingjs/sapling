const rfs = require("fs");
const path = require("path");
const { console } = require("../lib/Cluster");

var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};

var spaceRx = /\s+/;
var _slice = Array.prototype.slice;

function escapeHtml (string) {
    if (string === null || string === undefined) {
        return string;
    }

    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
    });
}

function asyncEach (arr, ctx, iterator, callback) {
    callback = callback || function () {};
    if (!arr || !arr.length) {
        return callback.call(ctx);
    }

    var completed = 0;
    var iterate = function () {
        iterator.call(ctx, arr[completed], function (err) {
            if (err) {
                console.error("ERROR", err, err.stack)
                callback.call(ctx, err);
                callback = function () {};
            }
            else {
                completed += 1;
                if (completed >= arr.length) {
                    callback.call(ctx, null);
                }
                else {
                    iterate.call(ctx);
                }
            }
        });
    };
    iterate();
}

function asyncForEach (arr, ctx, iterator, callback) {
    callback = callback || function () {};
    if (!arr) {
        return callback.call(ctx);
    }

    var isArray = Array.isArray(arr);
    var keys = arr;
    if (!isArray && typeof arr == 'object') {
        keys = Object.keys(arr);
    }

    // exit if no properties or elements to iterate
    if (!keys.length) {
        return callback.call(ctx);
    }

    var completed = 0;
    var iterate = function () {
        var key = isArray ? completed : keys[completed];
        var val = arr[key];

        iterator.call(ctx, val, key, function (err) {
            console.log("ITERATE", val, key)
            if (err) {
                console.error("ERROR", err, err.stack)
                callback.call(ctx, err);
                callback = function () {};
            }
            else {
                completed += 1;
                if (completed >= keys.length) {
                    callback.call(ctx, null);
                }
                else {
                    iterate.call(ctx);
                }
            }
        });
    };
    iterate();
}

var types = {
    "VAR": "var",
    "CONDITION": "condition",
    "LOOP": "loop",
    "INCLUDE": "include"
};

function Greenhouse (hooks, fs) {
    //save compile errors
    this.compileErrors = [];
    this.isError = false;

    //allow hooks into the template language
    this.hooks = hooks || {};

    this.hooks.set = function (block, next) {
        var expand = block.expr;
        var expr = expand.split(" ");
        var name = expr[0];
        var value = expr.slice(1).join(" ");

        this.data[name] = value;
        Greenhouse.saveDots(name, value, this.data);
        next();
    }

    this.pieces = [];
    this.fs = fs || rfs;
}

Greenhouse.toJSON = function (adt) {
    return JSON.stringify(adt, null, '\t');
}

/**
* Take a string of a variable and expand it
* without using eval()
*/
Greenhouse.extractDots = function (line, data) {
    var openQuote = -1;
    var closedQuote = -1;
    var ref = data;
    var start = 0;

    for (var i = 0; i < line.length; ++i) {
        if (line[i] == '.') {
            if (openQuote > -1) {
                continue;
            }

            var end = i;
            if (closedQuote > -1) {
                end = closedQuote;
                closedQuote = -1;
            }

            var key = line.substring(start, end);
            ref = ref[key];
            if (!ref) return undefined;
            start = i + 1;
        } else if (line[i] == '"') {
            if (openQuote == -1) {
                openQuote = i;
                start++;
            } else {
                openQuote = -1;
                closedQuote = i;
            }
        }
    }

    if (closedQuote > -1) {
        i = closedQuote;
    }

    var key = line.substring(start, i);
    return ref[key];
};

/**
* Take a string of a variable and modify the value
*/
Greenhouse.saveDots = function (line, value, data) {
    var openQuote = -1;
    var closedQuote = -1;
    var start = 0;
    var ref = data;

    for (var i = 0; i < line.length; ++i) {
        if (line[i] == '.') {
            // skip the split inside quote
            if (openQuote > -1) {
                continue;
            }

            var end = i;
            if (closedQuote > -1) {
                end = closedQuote;
                closedQuote = -1;
            }

            var key = line.substring(start, end);
            start = i + 1;

            // make the key the object
            if (typeof ref[key] !== "object") {
                ref[key] = {};
            }

            ref = ref[key];
        } else if (line[i] == '"') {
            if (openQuote !== -1) {
                openQuote = -1;
                closedQuote = i;
            } else {
                openQuote = i;
                start++;
            }
        }
    }

    if (closedQuote > -1) {
        i = closedQuote;
    }

    var key = line.substring(start, i);
    ref[key] = value;
}

Greenhouse.prototype.extractDots = function (line) {
    return Greenhouse.extractDots(line, this.data);
}

Greenhouse.prototype.saveDots = function (line, value) {
    return Greenhouse.saveDots(line, value, this.data);
}

/**
* Parse template char by char
* look for {
    * parse the expression
    * save the inner html
    * save the start and end char points in template
* look for }
*/
Greenhouse.prototype.render = function (template, data, includeHash) {
    this.compileErrors.length = 0;

    this.data = data;   

    if (!template) {
        return this.onerror && this.onerror.call(this, "No template provided");
    }

    //tokenize and set error flag
    var tokens = this.tokenize(template);
    this.isError = !!this.compileErrors.length;

    if (this.isError) {
        console.error("We found an error!")
        console.error(this.compileErrors);
        this.onerror && this.onerror.call(this, this.compileErrors);
        return;
    }

    this.start = 0;
    this.pieces = [];
    this.includeHash = includeHash || {};

    this.process(template, tokens, function () {
        console.log("---- TEMPLATE COMPILED -----");
        this.pieces.push(template.substring(this.start, template.length));
        this.oncompiled && this.oncompiled.call(this, this.pieces.join(""));
    });
}


function getLineFromIndex (template, index) {
    var prevLineBreak = template.lastIndexOf("\n", index) + 1;
    var nextLineBreak = template.indexOf("\n", index);
    
    var lines = template.split("\n");
    var line = template.substring(prevLineBreak, nextLineBreak);
    var num = 0;

    for (var i = 0; i < lines.length; ++i) {
        if (lines[i] == line) {
            num = i + 1;
            break;
        }
    }

    console.log(num + ":\t" + line);
    return num + ":\t" + line;
}

Greenhouse.prototype.parseExpression = function (expr, func) {
    var self = this;
    if (typeof expr !== "string") { return expr; }

    function replacer (a, name) {
        var result = Greenhouse.extractDots(name, self.data);
        if (func) { result = func(result); }
        return result;
    }

    //colon syntax :my.var.name
    expr = expr && expr.replace(/:([a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*)/g, replacer);
    //bash syntax $(my.var.name)
    expr = expr && expr.replace(/\$\(([a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*)\)/g, replacer);

    return expr;
}

/**
* [
    {type: "condition", start: 6, end: 20, t: [], f: []}
* ]
*/
Greenhouse.prototype.tokenize = function (template) {
    //flags to keep track of
    //open expressions
    var openTag = -1;
    var openCondition = []; //stack
    var openLoop = []; //stack

    var tokens = [];
    var parent = tokens;

    //loop over every fucking character :\
    for (var idx = 0; idx < template.length; ++idx) {
        var tag = template.substr(idx, 2);

        //open tag
        if (tag === '{{') {
            if (template[idx - 1] === "\\") {
                continue;
            }

            //already open
            if (openTag !== -1) {
                //this.compileErrors.push("Tag already opened at `" + openTag + "`");
                getLineFromIndex(template, openTag);
                //return;
                continue;
            }

            openTag = idx + 1;
        }

        //closedTag
        if (tag === '}}') {
            if (template[idx - 1] === "\\") {
                continue;
            }

            if (openTag === -1) {
                //this.compileErrors.push("Tag not opened at" + idx);
                getLineFromIndex(template, idx);
                continue;
            }

            //grab the expression from last open tag
            var expression = template.substring(openTag + 1, idx).trim();

            var token = {};
            if (!parent) {
                this.compileErrors.push("Unclosed tag")
                this.compileErrors.push(getLineFromIndex(template, idx));
                continue;
            }

            parent.push(token);

            var keyword = expression.split(" ")[0].toLowerCase();
            //look for a standard hook
            if (this.hooks[keyword]) {
                token.type = keyword;
                token.rawExpr = expression.substr(keyword.length).trim();
                token.start = openTag - 1;
                token.end = idx + 1;
            }
            //check includes
            else if (keyword === "include" ||
					 keyword === "#include") {

                token.type = types.INCLUDE;
                token.path = expression.split(" ").slice(1).join(" ");
                token.start = openTag - 1;
                token.end = idx + 1;
				token.eval = expression[0] !== "#";
            }
            //a conditional statement
            else if (keyword === "if" ||
                     keyword === "unless") {

                token.type = types.CONDITION;
                token.negate = keyword == "unless";
                token.expr = expression.substr(keyword.length).trim();
                token.startTrue = idx + 2;
                token.start = openTag - 1;
                
                var ifOptions = token.expr.split(spaceRx);
                token.thing = ifOptions[0];
                token.operator = (ifOptions[1] || "eq").toLowerCase();

                //merge every split term into one string value
                //e.g. "This", "is", "a", "string" => "This is a string"
                if (ifOptions.length > 3) {
                    token.value = ifOptions.slice(2).join(" ");
                } else {
                    //otherwise just take the value
                    //and default to true
                    token.value = ifOptions[2] || true;
                }

                //nested template blocks
                token.onTrue = [];
                token.onFalse = [];

                //push the current condition
                //on the stack
                openCondition.push(token);
                token.parent = parent;

                //subsequent blocks fall under this
                parent = token.onTrue;
            }
            //an else statement
            else if (expression.toLowerCase() === "else") {
                token.skipFrom = openTag - 1;
                token.skipTo = idx + 2;
                token.type = "else";
                var lastCondition = openCondition.pop();
                
                //save pointers to the start and end
                //of the else
                lastCondition.endTrue = openTag - 1;
                lastCondition.startFalse = idx + 2;
                lastCondition.else = true;

                parent = lastCondition.onFalse;
                openCondition.push(lastCondition);
            }
            //loop
            else if (keyword === "each") {
                token.type = types.LOOP;
                token.startLoop = idx + 2;
                token.start = openTag - 1;
                token.loop = [];

                //parse the loop expression
                var eachOptions = expression.substr(5).split(/[\s,]+/);
                token.list = eachOptions[0];
                token.iterator = eachOptions[2];
                if (eachOptions.length === 4) { 
                    token.index = eachOptions[3]; 
                }

                openCondition.push(token);
                token.parent = parent;
                parent = token.loop;
            }
            //close the last expression
            else if (expression[0] === '/') {
                //skip the entire tag
                token.skipFrom = openTag - 1;
                token.skipTo = idx + 2;

                //need to swap the parent
                //to the parent of the last condition
                var lastCondition = openCondition.pop();

                if (!lastCondition) {
                    continue
                }

                //save a pointer to the end of condition
                if (lastCondition.else) { lastCondition.endFalse = idx + 2; }
                else { lastCondition.endTrue = idx + 2; }

                parent = lastCondition.parent;
                delete lastCondition.parent;
            }
            //placeholder
            else {
                token.type = types.VAR;
                token.start = openTag;
                token.end = idx + 1;
                token.placeholder = expression;
            }

            //reset open tag flag
            openTag = -1;
        }
    }

    if (openTag !== -1) {
        //this.compileErrors.push("Tag not closed at " + openTag);
        getLineFromIndex(template, openTag);
        return;
    }

    return tokens;
}

Greenhouse.prototype.process = function (template, adt, gnext) {
    asyncEach(adt, this, function (block, next) {
        //empty block, skip
        if (block.skipFrom) {
            this.pieces.push(template.substring(this.start, block.skipFrom));
            this.start = block.skipTo;
            return next(); 
        }

        switch (block.type) {
            /**
            * {include}
            */
            case types.INCLUDE:
                this.pieces.push(template.substring(this.start, block.start - 1))
                this.start = block.end + 1;
                
                //trying to include file outside of
                //directory
                block.path = this.parseExpression(block.path);
                if (block.path.indexOf("..") !== -1) {
                    return next();
                }

                // already visited, must be a loop
                if (this.includeHash[block.path]) {
                    console.log("Loop detected:", block.path);
                    return next();
                }

                this.includeHash[block.path] = true;

                var viewPath = path.join(this.data.self.dir, block.path);
                if (viewPath.indexOf(".") == -1) {
                    viewPath += ".sap";
                }

                if(this.fs.existsSync(viewPath)) {
                    let contents = this.fs.readFileSync(viewPath);
                } else {
                    console.error("In include: FILE NOT EXISTS", viewPath);
                    let contents = "";
                }

                if (!(contents === "" || !block.eval)) {
                    contents = contents.toString();
    
                    var g = new Greenhouse(this.hooks);
                    g.oncompiled = (html) => {
                        this.pieces.push(html);
                    };
                    g.render(contents, this.data, this.includeHash);
                }

                return next();

            /**
            * {<var>}
            */
            case types.VAR: 
                var placeholder = block.placeholder;
                var escape = true;

                //trim the hash and don't escape
                if (placeholder[0] === "#") {
                    placeholder = placeholder.substr(1);
                    escape = false;
                }

                var value = Greenhouse.extractDots(placeholder, this.data);
                if (escape) { value = escapeHtml(value); }
            
                this.pieces.push(template.substring(this.start, block.start - 1))
                if (value !== null && value !== undefined && value !== "") { 
                    this.pieces.push(value); 
                }

                this.start = block.end + 1;

                return next();
                break;
            
            /**
            * {if <var> <operator> <value>}
            */
            case types.CONDITION:
                this.pieces.push(template.substring(this.start, block.start));

                var result = false;
                
                var thing = this.extractDots(this.parseExpression(block.thing));
                var operator = block.operator;
                var value = this.parseExpression(block.value);

                //convert thing to boolean
                if (typeof value === "boolean") {
                    thing = !!thing;
                }

                switch (operator) {
                    case "=":
                    case "==":
                    case "eq":
                        result = (thing == value);
                        break;

                    case "<>":
                    case "!=":
                    case "neq":
                        result = (thing != value);
                        break;

                    case ">":
                    case "gt":
                        result = (thing > value);
                        break;

                    case "<":
                    case "lt":
                        result = (thing < value);
                        break;

                    case ">=":
                    case "gte":
                        result = (thing >= value);
                        break;

                    case "<=":
                    case "lte":
                        result = (thing <= value);
                        break;
                }

                var wrapNext = function () {
                    if (block.else) { this.start = block.endFalse; }
                    else { this.start = block.endTrue; }
                    next();
                };
                
                if (block.negate) {
                    result = !result;
                }

                //if the expressions evaluates to
                //true, execute the onTrue blocks
                if (result) {
                    if (block.onTrue) {
                        this.start = block.startTrue;
                        this.process(template, block.onTrue, wrapNext);
                    } else {
                        //skip it entirely
                        this.start = block.endTrue;
                        next();
                    }
                } else {
                    if (block.onFalse && block.else) {
                        this.start = block.startFalse
                        this.process(template, block.onFalse, wrapNext);
                    } else {
                        //skip it entirely, REFACTOR
                        this.start = block.endTrue;
                        next();
                    }
                }

                return;
                break;

            /**
            * {each <list> as <item>[, <index>]}
            */
            case types.LOOP:
                this.pieces.push(template.substring(this.start, block.start));

                var list = this.data[block.list] || [];
                var j = 0;
                
                asyncForEach(list, this, function (item, key, next) {
                    this.data[block.iterator] = item;
                    this.data[block.index] = key;
                    this.data['i'] = j++;

                    this.start = block.startLoop;
                    this.process.call(this, template, block.loop, next);
                }, function () {
                    this.start = block.endTrue;
                    next();
                });

                return;
                break;

            /**
            * Nothing found. Look for a hook.
            */
            default:
                var hook = this.hooks[block.type];
                block.expr = this.parseExpression(block.rawExpr);
                this.pieces.push(template.substring(this.start, block.start));

                if (hook) {
                    hook.call(this, block, function (html) {
                        if (html) { this.pieces.push(html); }
                        this.start = block.end + 1;
                        
                        next.call(this);
                    }.bind(this));
                } else {
                    console.log("NO HOOK", block.expr)
                    this.pieces.push(template.substring(this.start, block.end));
                    this.start = block.end;
                    return next();
                }

                break;
        }
    }, gnext);
}

module.exports = Greenhouse;
