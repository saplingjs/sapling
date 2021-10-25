/**
 * Request
 *
 * Utilities to parse and handle requests
 */

/* Dependencies */
import _ from 'underscore';
import { getQueryParams } from '@tinyhttp/url';

import { console } from './Cluster.js';
import Validation from './Validation.js';


/**
 * The Request class
 */
export default class Request {
	/**
	 * Initialise the Request class
	 *
	 * @param {object} App The App instance
	 */
	constructor(App) {
		this.app = App;
	}


	/**
	 * Parse URL segments into "where" clause constraints
	 *
	 * @param {object} request Request object from Express
	 */
	getConstraints(request) {
		const conditions = {};

		/* Add any and all constraints to the query */
		if (request.type === 'filter' && request.fields.length === request.values.length) {
			for (let index = 0; index < request.fields.length; ++index) {
				let values = request.values[index].split(',');
				if (values.length === 1) {
					values = values[0];
				}

				conditions[request.fields[index]] = values;
			}
		}

		return conditions;
	}


	/**
	 * Add a constraint for the creator to match the currently logged in
	 * user, if appropriate for the given request and role
	 *
	 * @param {object} request Request object from Express
	 * @param {string} role User role
	 */
	getCreatorConstraint(request, role) {
		const conditions = {};

		if (request.session && request.session.user && request.permission && request.permission.role.includes('owner') && role !== 'admin') {
			conditions._creator = request.session.user._id;
		}

		return conditions;
	}


	/**
	 * Take an incoming request and make sense of it
	 *
	 * @param {object} request The request object from Express
	 */
	parse(request) {
		/* Get the URL segments from the requested URL */
		const url = request.originalUrl || request.url;
		const query = new URL(url, 'https://localhost');
		const parts = query.pathname.split('/');

		/* Request method */
		const method = request.method && request.method.toUpperCase();

		/* Trim unneeded parts of the request */
		if (parts[0] === '') {
			parts.splice(0, 1);
		}

		if (parts[parts.length - 1] === '') {
			parts.splice(-1, 1);
		}

		if (parts[0] === 'data') {
			parts.splice(0, 1);
		}

		/* Name each of the URL segments */
		const collection = parts[0];
		const fields = [];
		const values = [];

		for (let i = 1; i < parts.length; i += 2) {
			fields.push(parts[i]);
			values.push(parts[i + 1]);
		}

		console.log('Request', collection, fields, values);

		/* Leave a warning if no permission on a writable request */
		if ((method === 'POST' || method === 'DELETE') && !request.permission) {
			console.warn(`You should add a permission for \`${request.url}\`.`);
		}

		/* Format incoming data */
		if (request.body) {
			/* Go through every key in incoming data */
			for (const key in request.body) {
				if (Object.prototype.hasOwnProperty.call(request.body, key)) {
					/* Get the corresponding ruleset */
					const rule = this.app.storage.getRule(key, collection);

					/* Trim incoming data unless otherwise specified in model */
					if (typeof request.body[key] === 'string' && (!rule || !('trim' in rule) || rule.trim !== false)) {
						request.body[key] = String(request.body[key]).trim();
					}

					/* If the data is a number, convert from string */
					if (rule && rule.type === 'number') {
						request.body[key] = Number.parseFloat(request.body[key], 10);
					}

					/* Ignore CSRF tokens */
					if (key === '_csrf') {
						delete request.body[key];
					}

					/* In strict mode, don't allow unknown fields */
					if (!rule && this.app.config.strict) {
						console.warn('UNKNOWN FIELD', key);
						delete request.body[key];
					}

					/* If this field has no defined access level, we can skip the rest of the checks */
					if (!rule || !rule.access) {
						continue;
					}

					/* Get the write access level */
					const access = rule.access.w || rule.access;

					/* If the field is owner-only, defer to individual op methods to check against it */
					if (access === 'owner') {
						continue;
					}

					/* Get the role from session, if any */
					const role = this.app.user.getRole({ session: request.session });

					/* If we do not have access, raise hell */
					if (this.app.user.isRoleAllowed(role, access) === false) {
						console.warn(`NO ACCESS TO FIELD '${key}'`);
						console.warn(`Current permission level: ${role}`);
						console.warn(`Required permission level: ${access}`);
						delete request.body[key];
					}
				}
			}

			/* Go through every rule */
			const rules = this.app.storage.getRules(collection);
			for (const key in rules) {
				/* If inserting, and a field with a default value is missing, apply default */
				if (parts.length <= 2 && !(key in request.body) && 'default' in rules[key]) {
					request.body[key] = rules[key].default;
				}
			}
		}

		/* Modify the request object */
		return _.extend(request, {
			collection,
			fields,
			values,
			query: url.includes('?') ? getQueryParams(url) : {}, // Query params
			type: parts.length >= 3 ? 'filter' : 'all',
			isLogged: Boolean(request.session && request.session.user),
		});
	}


	/**
	 * Validate the data of a given POST request
	 *
	 * @param {object} request Request object from Express
	 * @param {object} response Response object from Express
	 */
	validateData(request) {
		const { collection, body, type } = request;

		/* Get the collection definition */
		const rules = this.app.storage.getRules(collection);

		let errors = [];
		const data = body || {};

		/* Model must be defined before pushing data */
		if (Object.keys(rules).length === 0 && this.app.config.strict) {
			return [{
				status: '500',
				code: '1010',
				title: 'Non-existent',
				detail: 'This model does not exist.',
				meta: {
					type: 'data',
					error: 'nonexistent',
				},
			}];
		}

		/* Go through every key in incoming data */
		for (const key in data) {
			if (Object.prototype.hasOwnProperty.call(data, key)) {
				/* Get the corresponding ruleset */
				const rule = this.app.storage.getRule(key, collection);

				/* If the field isn't defined, skip */
				if (!rule) {
					continue;
				}

				/* Test in the validation library */
				const error = new Validation().validate(data[key], key, rule);
				if (error.length > 0) {
					errors = error;
				}
			}
		}

		/* For insertion, handle required fields and default values */
		if (type === 'all') {
			/* Go through every defined field */
			for (const key in rules) {
				/* If the value exists, it will have already been validated above */
				if (key in data) {
					continue;
				}

				/* We now know the given field does not have a corresponding value
				   in the incoming data */

				/* If required, generate error */
				if (rules[key].required) {
					errors.push({
						status: '422',
						code: '1001',
						title: 'Invalid Input',
						detail: `You must provide a value for key \`${key}\``,
						meta: {
							key,
							rule: 'required',
						},
					});
				}
			}
		}

		console.log('ERRORS', errors);

		return errors.length > 0 ? errors : [];
	}
}
