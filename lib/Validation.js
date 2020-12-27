/**
 * Validation
 * 
 * Make sure the given data is valid.
 */


/* Dependencies */
const _ = require("underscore");
const { console } = require("./Cluster");


/**
 * The Validation class
 */
module.exports = class Validation {

	/**
	 * Initialise the Validation class
	 */
	constructor() {
		/* Create an error bin */
		this.errors = [];
	}


	/**
	 * Validate a given value against the rules
	 * 
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rules String or object of the rule from the model
	 */
	validate(value, key, rules) {

		/* Validate type */
		this.validateType(value, key, rules);

		/* Validate values list */
		this.validateValues(value, key, rules);

		/* Validate maximum length */
		this.validateMaxlen(value, key, rules);

		/* Validate minimum length */
		this.validateMinlen(value, key, rules);

		/* Validate maximum value */
		this.validateMax(value, key, rules);

		/* Validate minimum value */
		this.validateMin(value, key, rules);

		/* Validate email address */
		this.validateEmail(value, key, rules);

		/* Return all errors */
		return this.errors;
	}


	/**
	 * Validate a given value against type only
	 * 
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rules String or object of the rule from the model
	 */
	validateType(value, key, rules) {
		/* Validate the type - if the rules are a string, assume it's the type */
		if (typeof rules === 'string' || rules.type) {
			/* Simplify the type */
			let type = (rules.type || rules).toLowerCase();
	
			/* If we're referencing an ID, pass it as a string for validation */
			if(type === 'reference') 
				type = 'string';
	
			/* If it's boolean, coerce the value into a Boolean */
			if(type === 'boolean') {
				value = Boolean(value);
				type = 'boolean';
			}
	
			/* If it's a date, comparing as string is better */
			if(type === 'date') {
				value = String(value);
				type = 'string';
			}
	
			/* If it doesn't match, push an error */
			if (typeof value !== type) {
				this.errors.push({
					"status": "422",
					"code": "1002",
					"title": "Invalid Type",
					"detail": `Value provided for \`${key}\` is not a ${type} as is required.`,
					"meta": {
						"key": key,
						"rule": "type",
						"value": type
					}
				});
			}
		}
	}


	/**
	 * Validate a given value against a list of values
	 * 
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rules String or object of the rule from the model
	 */
	validateValues(value, key, rules) {
		/* Enforce only if submitted, it's required or there's no default */
		if (rules.values && (rules.required || !rules.default || value !== "")) {
			if (!rules.values.includes(value)) {
				this.errors.push({
					"status": "422",
					"code": "1003",
					"title": "Invalid Value",
					"detail": `\`${key}\` must match one of the acceptable values: ${rules.values.join(", ")}`,
					"meta": {
						"key": key,
						"rule": "values",
						"value": rules.values
					}
				});
			}
		}
	}


	/**
	 * Validate a given value against a maximum length
	 * 
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rules String or object of the rule from the model
	 */
	validateMaxlen(value, key, rules) {
		/* Maximum length of string or array */
		if (rules.maxlen) {
			if (value.length > rules.maxlen) {
				this.errors.push({
					"status": "422",
					"code": "1004",
					"title": "Input Too Long",
					"detail": `\`${key}\` must be no more than ${rules.maxlen} characters long.`,
					"meta": {
						"key": key,
						"rule": "maxlen",
						"value": rules.maxlen
					}
				});
			}
		}
	}


	/**
	 * Validate a given value against a minimum length
	 * 
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rules String or object of the rule from the model
	 */
	validateMinlen(value, key, rules) {
		/* Minimum length of string or array */
		if (rules.minlen) {
			if (value.length > rules.minlen) {
				this.errors.push({
					"status": "422",
					"code": "1005",
					"title": "Input Too Short",
					"detail": `\`${key}\` must be at least ${rules.minlen} characters long.`,
					"meta": {
						"key": key,
						"rule": "minlen",
						"value": rules.minlen
					}
				});
			}
		}
	}


	/**
	 * Validate a given value against a maximum value
	 * 
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rules String or object of the rule from the model
	 */
	validateMax(value, key, rules) {
		/* Minimum length of string or array */
		if (rules.max) {
			if (value.length > rules.max) {
				this.errors.push({
					"status": "422",
					"code": "1006",
					"title": "Input Too Large",
					"detail": `\`${key}\` is larger than the maximum value ${rules.max}.`,
					"meta": {
						"key": key,
						"rule": "max",
						"value": rules.max
					}
				});
			}
		}
	}


	/**
	 * Validate a given value against a minimum value
	 * 
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rules String or object of the rule from the model
	 */
	validateMin(value, key, rules) {
		/* Minimum length of string or array */
		if (rules.min) {
			if (value.length > rules.min) {
				this.errors.push({
					"status": "422",
					"code": "1007",
					"title": "Input Too Small",
					"detail": `\`${key}\` is smaller than the minimum value ${rules.min}.`,
					"meta": {
						"key": key,
						"rule": "min",
						"value": rules.min
					}
				});
			}
		}
	}


	/**
	 * Validate a given value against a minimum value
	 * 
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rules String or object of the rule from the model
	 */
	validateEmail(value, key, rules) {
		/* Must be a valid email address */
		if (rules.email) {
			const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
			if(!re.test(value)) {
				this.errors.push({
					"status": "422",
					"code": "1008",
					"title": "Invalid Input",
					"detail": `\`${key}\` is not a valid email address.`,
					"meta": {
						"key": key,
						"rule": "email"
					}
				});
			}
		}
	}


	/**
	 * Test field names for format
	 * 
	 * @param {string} name Name of the field
	 * @param {boolean} strict Whether to allow underscores or not
	 */
	validateFieldName(name, strict) {
		if (!name) { return false; }
	
		if (strict) {
			return /^[a-zA-Z][a-zA-Z0-9-]+$/.test(name)
		} else {
			return /^[a-zA-Z][a-zA-Z0-9_-]+$/.test(name)
		}
	}
};
