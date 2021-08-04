/**
 * Request
 *
 * Utilities to parse and handle requests
 */

/* Dependencies */
import _ from 'underscore';

import { console } from './Cluster.js';
import Response from './Response.js';
import SaplingError from './SaplingError.js';
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

		if (request.permission && request.permission.role.includes('owner') && role !== 'admin') {
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
		const query = new URL(request.url, `${request.protocol}://${request.hostname}`);
		const parts = query.pathname.split('/');

		/* Request method */
		const method = request.method && request.method.toUpperCase();

		/* Trim uneeded parts of the request */
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

		/* Convert URLSearchParams to a regular object */
		const queryObject = {};
		for (const queryKey of query.searchParams.keys()) {
			if (query.searchParams.getAll(queryKey).length > 1) {
				queryObject[queryKey] = query.searchParams.getAll(queryKey);
			} else {
				queryObject[queryKey] = query.searchParams.get(queryKey);
			}
		}

		/* Modify the request object */
		return _.extend(request, {
			collection,
			fields,
			values,
			query: queryObject, // Query params
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
	validateData(request, response) {
		const { collection, body, session, type } = request;

		/* Get the collection definition */
		const rules = this.app.storage.schema[collection] || {};

		let errors = [];
		const data = body || {};

		/* Get the role from session, if any */
		const role = this.app.user.getRole({ session });

		/* Model must be defined before pushing data */
		if (!rules && this.app.config.strict) {
			new Response(this.app, request, response, new SaplingError({
				status: '500',
				code: '1010',
				title: 'Non-existent',
				detail: 'This model does not exist.',
				meta: {
					type: 'data',
					error: 'nonexistent',
				},
			}));
			return false;
		}

		/* Go through every key in incoming data */
		for (const key in data) {
			if (Object.prototype.hasOwnProperty.call(data, key)) {
				/* Ignore CSRF tokens */
				if (key === '_csrf') {
					delete data[key];
				}

				/* Get the corresponding ruleset */
				const rule = rules[key];

				/* Trim incoming data unless otherwise specified in model */
				if (typeof data[key] === 'string' && (!rule || !('trim' in rule) || rule.trim !== false)) {
					data[key] = String(data[key]).trim();
				}

				/* If the field isn't defined */
				if (!rule) {
					/* In strict mode, don't allow unknown fields */
					if (this.app.config.strict) {
						console.warn('UNKNOWN FIELD', key);
						delete data[key];
					}

					/* Otherwise skip this field */
					continue;
				}

				const dataType = (rule.type || rule).toLowerCase();

				/* If the data is a number, convert from string */
				if (dataType === 'number') {
					data[key] = Number.parseFloat(data[key], 10);
				}

				/* Test in the validation library */
				const error = new Validation().validate(data[key], key, rule);
				if (error.length > 0) {
					errors = error;
				}

				/* If this field has no defined access level, we can skip the rest of the checks */
				if (!rule.access) {
					continue;
				}

				/* Get the write access level */
				const access = rule.access.w || rule.access;

				/* If the field is owner-only, defer to individual op methods to check against it */
				if (access === 'owner') {
					continue;
				}

				/* If we do not have access, raise hell */
				if (this.app.user.isRoleAllowed(role, access) === false) {
					console.warn(`NO ACCESS TO FIELD '${key}'`);
					console.warn('Current permission level:', role);
					console.warn('Required permission level:', access);
					delete data[key];
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

				if (typeof rules[key] !== 'object') {
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

				/* Set the data to the default value, if provided */
				if ('default' in rules[key]) {
					data[key] = rules[key].default;
				}
			}
		}

		console.log('ERRORS', errors);

		return errors.length > 0 ? errors : [];
	}
}
