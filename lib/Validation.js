/**
 * Validation
 *
 * Make sure the given data is valid.
 */


/* Dependencies */
const _ = require('underscore');
const { console } = require('./Cluster');


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
	 * Test field names for format
	 *
	 * @param {string} name Name of the field
	 * @param {boolean} strict Whether to allow underscores or not
	 */
	validateFieldName(name, strict) {
		if (!name) {
			return false;
		}

		if (strict) {
			return /^[a-zA-Z][a-zA-Z\d-]+$/.test(name);
		}

		return /^[a-zA-Z][\w-]+$/.test(name);
	}


	/**
	 * Validate a given value against the rules
	 *
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rule String or object of the rule from the model
	 */
	validate(value, key, rule) {
		/* Validate type */
		this.validateType(value, key, rule);

		/* Validate values list */
		this.validateValues(value, key, rule);

		/* Validate maximum length */
		this.validateMaxlen(value, key, rule);

		/* Validate minimum length */
		this.validateMinlen(value, key, rule);

		/* Validate maximum value */
		this.validateMax(value, key, rule);

		/* Validate minimum value */
		this.validateMin(value, key, rule);

		/* Validate email address */
		this.validateEmail(value, key, rule);

		/* Return all errors */
		return this.errors;
	}


	/**
	 * Validate a given value against type only
	 *
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rule String or object of the rule from the model
	 */
	validateType(value, key, rule) {
		/* Validate the type - if the rules are a string, assume it's the type */
		if (typeof rule === 'string' || rule.type) {
			/* Simplify the type */
			let type = (rule.type || rule).toLowerCase();

			/* If we're referencing an ID, pass it as a string for validation */
			if (type === 'reference') {
				type = 'string';
			}

			/* If it's boolean, coerce the value into a Boolean */
			if (type === 'boolean') {
				value = Boolean(value);
				type = 'boolean';
			}

			/* If it's a date, comparing as string is better */
			if (type === 'date') {
				value = String(value);
				type = 'string';
			}

			/* If it doesn't match, push an error */
			if (typeof value !== type) {
				this.errors.push({
					status: '422',
					code: '1002',
					title: 'Invalid Type',
					detail: `Value provided for \`${key}\` is not a ${type} as is required.`,
					meta: {
						key,
						rule: 'type',
						value: type
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
	 * @param {any} rule String or object of the rule from the model
	 */
	validateValues(value, key, rule) {
		/* Enforce only if submitted, it's required or there's no default */
		if (rule.values && (rule.required || !rule.default || value !== '')) {
			if (!rule.values.includes(value)) {
				this.errors.push({
					status: '422',
					code: '1003',
					title: 'Invalid Value',
					detail: `\`${key}\` must match one of the acceptable values: ${rule.values.join(', ')}`,
					meta: {
						key,
						rule: 'values',
						value: rule.values
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
	 * @param {any} rule String or object of the rule from the model
	 */
	validateMaxlen(value, key, rule) {
		/* Maximum length of string or array */
		if (rule.maxlen && value.length > rule.maxlen) {
			this.errors.push({
				status: '422',
				code: '1004',
				title: 'Input Too Long',
				detail: `\`${key}\` must be no more than ${rule.maxlen} characters long.`,
				meta: {
					key,
					rule: 'maxlen',
					value: rule.maxlen
				}
			});
		}
	}


	/**
	 * Validate a given value against a minimum length
	 *
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rule String or object of the rule from the model
	 */
	validateMinlen(value, key, rule) {
		/* Minimum length of string or array */
		if (rule.minlen && value.length < rule.minlen) {
			this.errors.push({
				status: '422',
				code: '1005',
				title: 'Input Too Short',
				detail: `\`${key}\` must be at least ${rule.minlen} characters long.`,
				meta: {
					key,
					rule: 'minlen',
					value: rule.minlen
				}
			});
		}
	}


	/**
	 * Validate a given value against a maximum value
	 *
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rule String or object of the rule from the model
	 */
	validateMax(value, key, rule) {
		/* Minimum length of string or array */
		if (rule.max && value > rule.max) {
			this.errors.push({
				status: '422',
				code: '1006',
				title: 'Input Too Large',
				detail: `\`${key}\` is larger than the maximum value ${rule.max}.`,
				meta: {
					key,
					rule: 'max',
					value: rule.max
				}
			});
		}
	}


	/**
	 * Validate a given value against a minimum value
	 *
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rule String or object of the rule from the model
	 */
	validateMin(value, key, rule) {
		/* Minimum length of string or array */
		if (rule.min && value < rule.min) {
			this.errors.push({
				status: '422',
				code: '1007',
				title: 'Input Too Small',
				detail: `\`${key}\` is smaller than the minimum value ${rule.min}.`,
				meta: {
					key,
					rule: 'min',
					value: rule.min
				}
			});
		}
	}


	/**
	 * Validate a given value against a minimum value
	 *
	 * @param {any} value The value being validated
	 * @param {string} key The key of the value
	 * @param {any} rule String or object of the rule from the model
	 */
	validateEmail(value, key, rule) {
		/* Must be a valid email address */
		if (rule.email) {
			const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[(?:\d{1,3}\.){3}\d{1,3}])|(([a-zA-Z\-\d]+\.)+[a-zA-Z]{2,}))$/;
			if (!re.test(value)) {
				this.errors.push({
					status: '422',
					code: '1008',
					title: 'Invalid Input',
					detail: `\`${key}\` is not a valid email address.`,
					meta: {
						key,
						rule: 'email'
					}
				});
			}
		}
	}


	/**
	 * Validate a given file against a maximum filesize
	 *
	 * @param {object} file File object from Express
	 * @param {string} key The key of the value
	 * @param {any} rule Object of the rule from the model
	 */
	validateFileMaxsize(file, key, rule) {
		/* Maximum size of the file */
		if (rule.maxsize) {
			let sizeLimit = rule.maxsize;

			/* Parse string based filesizes */
			if (typeof sizeLimit === 'string') {
				const sizeMultipliers = {
					B: 0,
					K: 1024,
					M: 1024 * 1024,
					G: 1024 * 1024 * 1024
				};

				/* Split to number and character */
				const sizeParts = sizeLimit.match(/^([.\d]+)([b|kmg)])$/gi);

				if (sizeParts) {
					sizeLimit = Number(sizeParts[0]) * sizeMultipliers[sizeParts[1].toUpperCase()];
				}
			}

			/* Check against maximum size in model */
			if (file.size > sizeLimit) {
				this.errors.push({
					status: '422',
					code: '2002',
					title: 'File Too Large',
					detail: `\`${key}\` must not be larger than ${sizeLimit} bytes.`,
					meta: {
						type: 'file',
						error: 'maxsize',
						value: sizeLimit
					}
				});
			}
		}
	}


	/**
	 * Validate a given file against a given list of file types
	 *
	 * @param {object} file File object from Express
	 * @param {string} key The key of the value
	 * @param {any} rule Object of the rule from the model
	 */
	validateFileType(file, key, rule) {
		if (rule.filetype) {
			/* Make sure it's an array */
			const acceptedTypes = Array.isArray(rule.filetype) ? rule.filetype : [rule.filetype];

			/* Ensure the file matches the given filetype (mime, group or ext) */
			if (!(file.mimetype in acceptedTypes || fileExtension in acceptedTypes || fileGroup in acceptedTypes)) {
				this.errors.push({
					status: '422',
					code: '2001',
					title: 'Wrong File Type',
					detail: `\`${key}\` must be one of ${acceptedTypes.join(', ')}.`,
					meta: {
						type: 'file',
						error: 'type',
						value: acceptedTypes
					}
				});
			}
		}
	}


	/**
	 * Validate a given image file dimensions against a minimum pixel width
	 *
	 * @param {object} dimensions Dimensions from image size analyser
	 * @param {string} key The key of the value
	 * @param {any} rule Object of the rule from the model
	 */
	validateFileMinwidth(dimensions, key, rule) {
		if (rule.minwidth && dimensions.width < rule.minwidth) {
			this.errors.push({
				status: '422',
				code: '2003',
				title: 'Image Too Small',
				detail: `Width of \`${key}\` must be at least ${rule.minwidth} pixels.`,
				meta: {
					type: 'file',
					error: 'minwidth',
					value: rule.minwidth
				}
			});
		}
	}


	/**
	 * Validate a given image file dimensions against a maximum pixel width
	 *
	 * @param {object} dimensions Dimensions from image size analyser
	 * @param {string} key The key of the value
	 * @param {any} rule Object of the rule from the model
	 */
	validateFileMaxwidth(dimensions, key, rule) {
		if (rule.maxwidth && dimensions.width > rule.maxwidth) {
			this.errors.push({
				status: '422',
				code: '2004',
				title: 'Image Too Large',
				detail: `Width of \`${key}\` must not be more than ${rule.maxwidth} pixels.`,
				meta: {
					type: 'file',
					error: 'maxwidth',
					value: rule.maxwidth
				}
			});
		}
	}


	/**
	 * Validate a given image file dimensions against a minimum pixel height
	 *
	 * @param {object} dimensions Dimensions from image size analyser
	 * @param {string} key The key of the value
	 * @param {any} rule Object of the rule from the model
	 */
	validateFileMinheight(dimensions, key, rule) {
		if (rule.minheight && dimensions.height < rule.minheight) {
			this.errors.push({
				status: '422',
				code: '2005',
				title: 'Image Too Small',
				detail: `height of \`${key}\` must be at least ${rule.minheight} pixels.`,
				meta: {
					type: 'file',
					error: 'minheight',
					value: rule.minheight
				}
			});
		}
	}


	/**
	 * Validate a given image file dimensions against a maximum pixel height
	 *
	 * @param {object} dimensions Dimensions from image size analyser
	 * @param {string} key The key of the value
	 * @param {any} rule Object of the rule from the model
	 */
	validateFileMaxheight(dimensions, key, rule) {
		if (rule.maxheight && dimensions.height > rule.maxheight) {
			this.errors.push({
				status: '422',
				code: '2006',
				title: 'Image Too Large',
				detail: `Height of \`${key}\` must not be more than ${rule.maxheight} pixels.`,
				meta: {
					type: 'file',
					error: 'maxheight',
					value: rule.maxheight
				}
			});
		}
	}
};
