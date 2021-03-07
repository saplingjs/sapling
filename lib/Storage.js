/**
 * Storage
 *
 * Middleware between the app and the database driver to do all
 * the higher level heavy lifting with data.
 */

'use strict';


/* Dependencies */
const _ = require('underscore');
const moment = require('moment');

const { console } = require('./Cluster');
const SaplingError = require('./SaplingError');
const Response = require('./Response');
const Validation = require('./Validation');


/* Default user structure */
/* Extensible through a users model */
const userStructure = {
	email: { type: 'String', minlen: 3, unique: true, required: true, identifiable: true },
	password: { type: 'String', minlen: 3, required: true, access: 'owner' },
	_salt: { type: 'String', access: 'owner' },
	role: { type: 'String', values: ['admin', 'member'], default: 'member', access: { r: 'anyone', w: 'admin' } },
	_authkey: { type: 'String', access: 'owner' }
};


/* File uploads structure */
const uploadStructure = {
	// URL to the full original file
	url: { type: 'String', required: true },
	// Type, one of "image", "document", "archive", "other"
	type: { type: 'String', values: ['image', 'video', 'audio', 'document', 'archive', 'font', 'other'], default: 'other' },
	// URL to a Sapling-generated thumbnail
	// thumbnail_url: {type: "String"},
	// Filesize of the original in bytes
	filesize: { type: 'Number' },
	// File extension as presented
	extension: { type: 'String' },
	// Detected mimetype
	mimetype: { type: 'String' }
	// Width in pixels for uploads of the "image" type
	// width: {type: "Number"},
	// Height in pixels for uploads of the "image" type
	// height: {type: "Number"}
};


/**
 * The Storage class
 */
module.exports = class Storage {
	/**
	 * Initialise the Storage class
	 *
	 * @param {object} App The App instance
	 * @param {object} opts Initialisation options
	 */
	constructor(App, options) {
		/* Load the options into the class */
		this.app = App;
		this.name = options.name;
		this.schema = options.schema;
		this.config = options.config;
		this.dir = options.dir;

		/* Every app with storage needs a users collection */
		if ('users' in this.schema) {
			/* Allow customization of the structure */
			_.defaults(this.schema.users, userStructure);
		} else {
			this.schema.users = userStructure;
		}

		/* Create uploads collection if uploads are enabled */
		/* Cold override as this cannot be customised by a model */
		if (this.app.uploads) {
			this.schema.uploads = uploadStructure;
		}

		/* Create dbs */
		this.createDatabase(options);
	}


	/**
	 * Take an incoming request and make sense of it
	 *
	 * @param {object} request The request object from Express
	 */
	parseRequest(request) {
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
			isLogged: Boolean(request.session && request.session.user)
		});
	}


	/**
	 * Connect to the database and create each collection defined in the schema
	 *
	 * @param {object} opts Options object from constructor
	 */
	async createDatabase(options) {
		const dbConfig = this.config.db;
		dbConfig.name = this.name;
		dbConfig.dataLimit = this.config.dataLimit;

		/* Connect to the database backend with the desired driver */
		const driver = String(this.config.db.driver).toLowerCase();

		if (driver === 'memory') {
			this.db = new (require('../drivers/db/Memory'))(options);
		} else {
			this.db = new (require(`@sapling/db-driver-${driver}`))(options);
		}

		await this.db.connect(dbConfig);

		/* Create each collection in the schema in the database */
		for (const collection in this.schema) {
			if ({}.hasOwnProperty.call(this.schema, collection)) {
				const fields = this.schema[collection];

				try {
					await this.db.createCollection(collection, fields);
				} catch (error) {
					console.warn(error);
				}

				/* Go through all the fields in the model */
				for (const key in fields) {
					/* Create indices for any fields marked unique or identifiable */
					if (fields[key].unique || fields[key].identifiable) {
						await this.db.createIndex(collection, { [key]: 1 }, { unique: true });
					}
				}
			}
		}

		console.log('CREATED DBS');
	}


	/**
	 * Returns an array of fields that should
	 * be omitted from the response due to permissions.
	 *
	 * @param {string} role The role being checked
	 * @param {string} collection The collection being checked against
	 */
	disallowedFields(role, collection) {
		/* Get the collection definition */
		const rules = this.schema[collection];
		const omit = [];

		/* Loop every field in the collection */
		for (const key in rules) {
			if ({}.hasOwnProperty.call(rules, key)) {
				const rule = rules[key];

				/* Normalise the access rule to be an object with r,w */
				const access = typeof rule.access === 'string' ? {
					r: rule.access,
					w: rule.access
				} : rule.access;

				/* Skip if not defined or anyone can view */
				if (!access || access.r === 'anyone' || access.r === 'owner') {
					continue;
				}

				/* Leave out the fields that the viewer can't access */
				if (this.inheritRole(role, access.r) === false) {
					omit.push(key);
				}
			}
		}

		return omit;
	}


	/**
	 * Get a list of fields in a given collection that only "owner"
	 * level users are allowed to see.
	 *
	 * @param {string} collection The collection being checked
	 */
	ownerFields(collection) {
		/* Get the collection definition */
		const rules = this.schema[collection];
		const fields = [];

		/* Loop every field in the collection */
		for (const key in rules) {
			if ({}.hasOwnProperty.call(rules, key)) {
				const rule = rules[key];

				/* Normalise the access rule to be an object with r */
				const access = typeof rule.access === 'string' ? {
					r: rule.access
				} : rule.access;

				/* Get the fields that are owner-only */
				if (access && access.r === 'owner') {
					fields.push(key);
				}
			}
		}

		return fields;
	}


	/**
	 * Determine if a given role supersedes the required role.
	 *
	 * @param {string} test The role being tested
	 * @param {string} role The access level being tested against
	 * @returns {boolean} true if "test" is a higher or equal level role as "role"; false if it is lesser
	 */
	inheritRole(test, role) {
		/* Get the indices of both comparison targets */
		const roleIndex = this.schema.users.role.values.indexOf(role);
		const testIndex = this.schema.users.role.values.indexOf(test);

		/* "admin" or "anyone" must always return true */
		if (test === 'admin' || role === 'anyone') {
			return true;
		}

		/* If we cannot find the role, assume no */
		if (roleIndex === -1 || testIndex === -1) {
			return false;
		}

		/* Otherwise do a straight comparison of indices */
		return (testIndex <= roleIndex);
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
		const rules = this.schema[collection] || {};

		let errors = [];
		const data = body || {};

		/* Get the role from session, if any */
		const role = this.getRole({ session });

		/* Model must be defined before pushing data */
		if (!rules && this.config.strict) {
			new Response(this.app, request, response, new SaplingError({
				status: '500',
				code: '1010',
				title: 'Non-existent',
				detail: 'This model does not exist.',
				meta: {
					type: 'data',
					error: 'nonexistent'
				}
			}));
			return false;
		}

		/* Go through every key in incoming data */
		for (const key in data) {
			if ({}.hasOwnProperty.call(data, key)) {
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
					if (this.config.strict) {
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
				if (this.inheritRole(role, access) === false) {
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
							rule: 'required'
						}
					});
				}

				/* Set the data to the default value, if provided */
				if ('default' in rules[key]) {
					data[key] = rules[key].default;
				}
			}
		}

		console.log('ERRORS', errors);

		return errors.length > 0 && errors;
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
	 * Get the user role from the session
	 *
	 * @param {object} request Request object from Express
	 * @returns {string/null} Role as string, or null if not logged in
	 */
	getRole(request) {
		let role = null;

		if (request.session && request.session.user) {
			role = request.session.user.role;
		}

		return role;
	}


	/**
	 * Serve an incoming GET request from the database
	 *
	 * @param {object} request Request object from Express
	 * @param {object} response Response object from Express
	 */
	async get(request, response) {
		/* Prepare the raw request */
		request = this.parseRequest(request);

		/* Get the collection definition */
		const rules = this.schema[request.collection] || {};
		const options = {};
		let conditions = {};

		/* Get the user role from session */
		const role = this.getRole(request);

		/* Check if we're logged in */
		this.app.user.isUserAuthenticatedForRoute(request, response);

		/* Parse limit options */
		if ('limit' in request.query) {
			const limit = request.query.limit.split(',');
			options.limit = Number(limit[1]) || Number(limit[0]);
			if (limit.length === 2) {
				options.skip = Number(limit[0]);
			}
		}

		/* Parse sorting option */
		if ('sort' in request.query) {
			const sort = request.query.sort.split(',');
			const sorter = sort[1] === 'desc' ? -1 : 1;
			options.sort = [[sort[0], sorter]];
		}

		/* Parse "where" clause, if any */
		/* If the permission is "owner", check that we are the owner, or an admin */
		conditions = _.extend(conditions, this.getConstraints(request), this.getCreatorConstraint(request, role));

		/* If we have reference fields */
		const references = [];
		for (const field of Object.keys(rules)) {
			const rule = rules[field];
			if (typeof rule !== 'string' && rule.type.toLowerCase() === 'reference') {
				references.push({
					from: rule.in,
					localField: rule.by || field,
					foreignField: rule.to,
					as: `${field}_data`
				});
			}
		}

		console.group('Storage GET');
		console.log('Collection:', request.collection);
		console.log('Conditions:', conditions);
		console.log('Options:', options);
		console.groupEnd();

		/* Get it from the database */
		try {
			const array = await this.db.read(request.collection, conditions, options, references);

			/* Get the list of fields we should not be able to see */
			const omit = this.disallowedFields(role, request.collection);

			/* Get the list of fields that only owners can see */
			const ownerFields = this.ownerFields(request.collection);

			/* Process fields against both lists */
			for (let i = 0; i < array.length; ++i) {
				/* Omit fields from the disallowedFields */
				array[i] = _.omit(array[i], omit);

				/* Check for ownership */
				const owner = array[i]._creator || array[i]._id;

				if (role !== 'admin' && (!request.isLogged || owner !== request.session.user._id)) {
					for (const ownerField of ownerFields) {
						delete array[i][ownerField];
					}
				}
			}

			/* If we only have a single result, return it bare */
			/* Otherwise, an array */
			if (request.query.single && array.length > 0) {
				return array[0];
			}

			return array;
		} catch (error) {
			new Response(this.app, request, response, new SaplingError(error));
		}
	}


	/**
	 * Serve an incoming POST request to the database
	 *
	 * @param {object} request Request object from Express
	 * @param {object} response Response object from Express
	 */
	async post(request, response) {
		/* Prepare the raw request */
		request = this.parseRequest(request);

		/* Check if we're logged in */
		this.app.user.isUserAuthenticatedForRoute(request, response);

		/* Get the collection definition */
		const rules = this.schema[request.collection] || {};

		let conditions = {};
		const data = request.body;

		/* Validate the updated data */
		const errors = this.validateData(request, response);
		if (errors) {
			new Response(this.app, request, response, new SaplingError(errors));
			return false;
		}

		/* Get the user role from session */
		const role = this.getRole(request);

		/* Specially format certain fields */
		for (const field of Object.keys(rules)) {
			const rule = rules[field];
			const type = (rule.type || rule).toLowerCase();

			/* Format reference fields */
			if (type === 'reference' || type === 'id') {
				if (conditions.references) {
					conditions.references.push(field);
				} else {
					conditions.references = [field];
				}
			}

			if (data[field]) {
				/* Format date fields */
				if (type === 'date') {
					data[field] = Number(moment(data[field]).format('x'));
				}

				/* Format boolean fields */
				if (type === 'boolean') {
					data[field] = Boolean(data[field]);
				}
			}
		}

		/* Deal with file uploads */
		if (request.files) {
			if (this.app.uploads) {
				_.extend(data, await this.app.uploads.handleUpload(request, response, rules));
			} else {
				new Response(this.app, request, response, new SaplingError('File uploads are not allowed'));
			}
		}

		console.group('Storage POST');
		console.log('Request type:', request.type);
		console.log('Request body:', request.body);
		console.log('Collection:', request.collection);
		console.log('Conditions:', conditions);
		console.groupEnd();

		/* If we're updating an existing record */
		if (request.type === 'filter') {
			/* Parse "where" clause, if any */
			/* If the permission is "owner", check that we are the owner, or an admin */
			conditions = _.extend(conditions, this.getConstraints(request), this.getCreatorConstraint(request, role));

			/* Update hidden fields */
			data._lastUpdated = Date.now();
			if (request.session && request.session.user) {
				data._lastUpdator = request.session.user._id;
				data._lastUpdatorEmail = request.session.user.email;
			}

			/* Send to the database */
			return await this.db.modify(request.collection, conditions, data);
		}
		/* If we're creating a new record */

		/* Add in the user metadata */
		if (request.session && request.session.user) {
			data._creator = request.session.user._id;
			data._creatorEmail = request.session.user.email;
		}

		data._created = Date.now();

		/* Send to the database */
		return await this.db.write(request.collection, data);
	}


	/**
	 * Serve an incoming DELETE request to the database
	 *
	 * @param {object} request Request object from Express
	 */
	async delete(request) {
		/* Prepare the raw request */
		request = this.parseRequest(request);

		let conditions = {};

		/* Get the user role from session */
		const role = this.getRole(request);

		/* Parse "where" clause, if any */
		/* If the permission is "owner", check that we are the owner, or an admin */
		conditions = _.extend(conditions, this.getConstraints(request), this.getCreatorConstraint(request, role));

		/* Send it to the database */
		return await this.db.remove(request.collection, conditions);
	}
};
