var _ = require("underscore");

exports.test = function (value, key, rule) {
	var errors = [];

	console.log("TESTING", value, rule);

	//only validate the type
	if (typeof rule === "string" || rule.type) {
		var type = (rule.type || rule).toLowerCase();

		// if we're referencing an ID, pass it as a string for validation
		if(type === "reference" || type === "id") 
			type = "string";

		if(type === "boolean") {
			value = Boolean(value);
			type = "boolean";
		}

		if(type === "date") {
			value = String(value);
			type = "string";
		}

		if (typeof value !== type) {
			errors.push({
				"status": "422",
				"code": "1002",
				"title": "Invalid Type",
				"detail": "Value provided for `"+key+"` is not a "+type+" as is required.",
				"meta": {
					"key": key,
					"rule": "type",
					"value": type
				}
			});
		}
	}

	// list of accepted values
	// only enforced if submitted, it's required or there's no default
	if (rule.values && (rule.required || !rule.default || value !== "")) {
		if (rule.values.indexOf(value) === -1)
			errors.push({
				"status": "422",
				"code": "1003",
				"title": "Invalid Value",
				"detail": "`"+key+"` must match one of the acceptable values: " + rule.values.join(", "),
				"meta": {
					"key": key,
					"rule": "values",
					"value": rule.values
				}
			});
	}

	//maximum length of string or array
	if (rule.maxlen) {
		if (value.length > rule.maxlen)
			errors.push({
				"status": "422",
				"code": "1004",
				"title": "Input Too Long",
				"detail": "`"+key+"` must be no more than "+rule.maxlen+" characters long.",
				"meta": {
					"key": key,
					"rule": "maxlen",
					"value": rule.maxlen
				}
			});
	}

	//minimum length of string or array
	if (rule.minlen) {
		if (value.length < rule.minlen)
			errors.push({
				"status": "422",
				"code": "1005",
				"title": "Input Too Short",
				"detail": "`"+key+"` must be at least "+rule.minlen+" characters long.",
				"meta": {
					"key": key,
					"rule": "minlen",
					"value": rule.minlen
				}
			});
	}

	//maximum value for Number
	if (rule.max) {
		if (value > rule.max)
			errors.push({
				"status": "422",
				"code": "1006",
				"title": "Input Too Small",
				"detail": "`"+key+"` is larger than the maximum value "+rule.max+".",
				"meta": {
					"key": key,
					"rule": "max",
					"value": rule.max
				}
			});
	}

	//minimum value for Number
	if (rule.min) {
		if (value < rule.min)
			errors.push({
				"status": "422",
				"code": "1007",
				"title": "Input Too Small",
				"detail": "`"+key+"` is smaller than the minimum value "+rule.min+".",
				"meta": {
					"key": key,
					"rule": "min",
					"value": rule.min
				}
			});
	}

	//must be a valid email address
	if (rule.email) {
		var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    	if(!re.test(value))
			errors.push({
				"status": "422",
				"code": "1008",
				"title": "Invalid Input",
				"detail": "`"+key+"` is not a valid email address.",
				"meta": {
					"key": key,
					"rule": "email"
				}
			});
	}

	return errors;
};

var naughty = [
	"internal",
	"sapling",
	"private",
	"official",
	"meta",
	"support",
	"blog",
	"help",
	"questions",
	"cache",
	"www",
	"ftp",
	"mail",
	"admin",
	"docs"
];

exports.testFieldName = function (name, strict) {
	if (!name) { return false; }
	
	name = name.trim();
	for (var i = 0; i < naughty.length; ++i) {
		if (name == naughty[i]) {
			return false;
		}
	}

	if (strict) {
		return /^[a-zA-Z][a-zA-Z0-9-]+$/.test(name)
	} else {
		return /^[a-zA-Z][a-zA-Z0-9_-]+$/.test(name)
	}
}