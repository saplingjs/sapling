/**
 * Storage
 *
 * Middleware between the app and the database driver to do all
 * the higher level heavy lifting with data.
 */

/* Dependencies */
import _ from 'underscore';
import isobject from 'isobject';
import moment from 'moment';

import { console } from './Cluster.js';
import SaplingError from './SaplingError.js';
import Response from './Response.js';
import Utils from './Utils.js';


/* Default user structure */
/* Extensible through a users model */
const userStructure = {
	email: { type: 'String', minlen: 3, email: true, unique: true, required: true, identifiable: true },
	password: { type: 'String', minlen: 3, required: true, access: { r: 'owner', w: 'owner' } },
	_salt: { type: 'String', access: { r: 'owner', w: 'owner' } },
	role: { type: 'String', values: ['admin', 'member'], default: 'member', access: { r: 'anyone', w: 'admin' } },
	_authkey: { type: 'String', access: { r: 'owner', w: 'owner' } },
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
	mimetype: { type: 'String' },
	// Width in pixels for uploads of the "image" type
	// width: {type: "Number"},
	// Height in pixels for uploads of the "image" type
	// height: {type: "Number"}
};


/**
 * The Storage class
 */
export default class Storage {
	/**
	 * DB class
	 */
	db = null;


	/**
	 * Initialise the Storage class
	 *
	 * @param {object} App The App instance
	 * @param {object} schema Data structure
	 */
	constructor(App, schema) {
		/* Load the options into the class */
		this.app = App;
		this.schema = schema || {};

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
	}


	/**
	 * Import DB driver if needed; no-op if already loaded.
	 */
	async importDriver() {
		if (this.db === null) {
			/* Connect to the database backend with the desired driver */
			const driver = String(this.app.config.db.driver).toLowerCase();

			if (driver === 'memory') {
				const { default: Memory } = await import('../drivers/db/Memory.js');
				this.db = new Memory(this.options);
			} else {
				try {
					const { default: Driver } = await import(`@sapling/db-driver-${driver}`);
					this.db = new Driver(this.options);
				} catch {
					try {
						const { default: Custom } = await import(driver);
						this.db = new Custom(this.options);
					} catch {
						throw new SaplingError(`Cannot find any DB driver for '${driver}'`);
					}
				}
			}

			await this.createDatabase();
		}

		return this.db;
	}


	/**
	 * Connect to the database and create each collection defined in the scheme
	 */
	async createDatabase() {
		if (this.db === null) {
			await this.importDriver();
		} else {
			const dbConfig = this.app.config.db;
			dbConfig.name = this.app.name || 'app';
			dbConfig.dataLimit = this.app.config.dataLimit;

			await this.db.connect(dbConfig);

			/* Create each collection in the schema in the database */
			for (const collection in this.schema) {
				if (Object.prototype.hasOwnProperty.call(this.schema, collection)) {
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
							await this.db.createIndex(collection, { [key]: 'unique' });
						}
					}
				}
			}

			console.log('CREATED DBS');
		}
	}


	/**
	 * Return an object for all the rules of a given model.
	 * Returns an empty object if model is not defined.
	 *
	 * @param {string} collection The name of the model
	 * @returns {object} The mode ruleset
	 */
	getRules(collection) {
		const rules = new Utils().deepClone(this.schema[collection] || {});

		for (const key in rules) {
			if (Object.prototype.hasOwnProperty.call(rules, key)) {
				if (isobject(rules[key]) && 'type' in rules[key]) {
					rules[key].type = String(rules[key].type).toLowerCase();
				} else if (typeof rules[key] === 'string') {
					rules[key] = { type: rules[key].toLowerCase() };
				} else {
					rules[key] = { type: 'string' };
				}
			}
		}

		return rules;
	}


	/**
	 * Return an object for the rule of a given field in
	 * a given model.  In strict mode, returns null when
	 * no model is defined.  Otherwise, an object will
	 * always be returned.
	 *
	 * @param {string} field The name of the field
	 * @param {string} collection The name of the model
	 * @returns {object} The model rule
	 */
	getRule(field, collection) {
		const rules = this.getRules(collection);

		/* If it doesn't exist, return null in strict mode */
		if (!(field in rules) && this.app.config.strict) {
			return null;
		}

		/* Otherwise, send it */
		return rules[field] || { type: 'string' };
	}


	/**
	 * Format the response from the database driver to be uniform
	 *
	 * @param {any} response Response from DB driver
	 * @returns {object} Formatted response
	 */
	formatResponse(response) {
		const formattedResponse = {
			data: [],
			count: 0,
		};

		if (typeof response === 'boolean' || typeof response.data === 'boolean') {
			/* If it's a data-less boolean response (i.e. deleting a record) */
			delete formattedResponse.data;
			formattedResponse.count = 'count' in response ? response.count : 1;
			formattedResponse.success = true;
		} else if (isobject(response)) {
			/* Format the object with some guesswork */
			formattedResponse.data = 'data' in response ? response.data : response;
			formattedResponse.count = 'count' in response ? response.count : formattedResponse.data.length;
		} else if (Array.isArray(response)) {
			/* Assume the array is array of records */
			formattedResponse.data = response;
			formattedResponse.count = response.length;
		} else {
			/* Fallback */
			formattedResponse.data = response;
			formattedResponse.count = 1;
		}

		return formattedResponse;
	}


	/**
	 * Serve an incoming GET request from the database
	 *
	 * @param {object} request Request object from Express
	 * @param {object} response Response object from Express
	 */
	async get(request, response) {
		await this.importDriver();

		/* Prepare the raw request */
		request = this.app.request.parse(request);

		/* Get the collection definition */
		const rules = this.getRules(request.collection);
		const options = {};
		let conditions = {};

		/* Get the user role from session */
		const role = this.app.user.getRole(request);

		/* Check if we're logged in */
		this.app.user.isUserAuthenticatedForRoute(request, response);

		/* Parse max limit */
		const limit = (this.app.config.limit && this.app.config.limit > 0) ? this.app.config.limit : false;

		/* Parse limit options */
		if ('limit' in request.query && Number(request.query.limit) !== 0) {
			options.limit = Number(request.query.limit) || null;

			/* If max limit is set in config, ensure we don't go over it */
			if (limit && options.limit > limit) {
				options.limit = limit;
			}

			if ('skip' in request.query) {
				options.skip = Number(request.query.skip) || null;
			}
		} else if (limit) {
			/* If max limit is set in config, enforce it */
			options.limit = limit;
		}

		/* Parse sorting option */
		if (['sort', 'sortBy', 'sortby', 'order', 'orderBy', 'orderby'].some(attribute => Object.keys(request.query).includes(attribute))) {
			const sortValue = request.query.sort || request.query.sortBy || request.query.sortby || request.query.order || request.query.orderBy || request.query.orderby;
			const sort = sortValue.split(',');
			const sorter = sort[1] === 'desc' ? -1 : 1;
			options.sort = [[sort[0], sorter]];
		}

		/* Parse "where" clause, if any */
		/* If the permission is "owner", check that we are the owner, or an admin */
		conditions = _.extend(conditions, this.app.request.getConstraints(request), this.app.request.getCreatorConstraint(request, role));

		/* If we have reference fields */
		const references = [];
		for (const field of Object.keys(rules)) {
			const rule = rules[field];
			if (typeof rule !== 'string' && rule.type.toLowerCase() === 'reference') {
				references.push({
					from: rule.in,
					localField: rule.by || field,
					foreignField: rule.to,
					as: `${field}_data`,
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
			const array = this.formatResponse(await this.db.read(request.collection, conditions, options, references));
			const rules = this.getRules(request.collection);

			/* Get the list of fields we should not be able to see */
			const omit = this.app.user.disallowedFields(role, rules);

			/* Get the list of fields that only owners can see */
			const ownerFields = this.app.user.ownerFields(rules);

			/* Process fields against both lists */
			for (let i = 0; i < array.data.length; ++i) {
				/* Omit fields from the disallowedFields */
				array.data[i] = _.omit(array.data[i], omit);

				/* Check for ownership */
				const owner = array.data[i]._creator || array.data[i]._id;

				if (role !== 'admin' && (!request.isLogged || owner !== request.session.user._id)) {
					for (const ownerField of ownerFields) {
						delete array.data[i][ownerField];
					}
				}
			}

			/* If we only want a single result, return it bare */
			/* Otherwise, an array */
			if (request.query.single) {
				return array.data.length > 0 ? array.data[0] : false;
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
		await this.importDriver();

		/* Prepare the raw request */
		request = this.app.request.parse(request);

		/* Check if we're logged in */
		this.app.user.isUserAuthenticatedForRoute(request, response);

		/* Get the collection definition */
		const rules = this.getRules(request.collection);

		let conditions = {};
		const data = request.body;

		/* Validate the updated data */
		const errors = this.app.request.validateData(request, response);
		if (errors.length > 0) {
			return new Response(this.app, request, response, new SaplingError(errors));
		}

		/* Get the user role from session */
		const role = this.app.user.getRole(request);

		/* Specially format certain fields */
		for (const field of Object.keys(rules)) {
			const rule = rules[field];

			/* Format reference fields */
			if (rule.type === 'reference' || rule.type === 'id') {
				if (conditions.references) {
					conditions.references.push(field);
				} else {
					conditions.references = [field];
				}
			}

			if (data[field]) {
				/* Format date fields */
				if (rule.type === 'date') {
					data[field] = Number(moment(data[field]).format('x'));
				}

				/* Format boolean fields */
				if (rule.type === 'boolean') {
					data[field] = Boolean(data[field]);
				}
			}
		}

		/* Deal with file uploads */
		if (request.files) {
			if (this.app.uploads) {
				_.extend(data, await this.app.uploads.handleUpload(request, response, rules));
			} else {
				return new Response(this.app, request, response, new SaplingError('File uploads are not allowed'));
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
			conditions = _.extend(conditions, this.app.request.getConstraints(request), this.app.request.getCreatorConstraint(request, role));

			/* Update hidden fields */
			data._lastUpdated = Date.now();
			if (request.session && request.session.user) {
				data._lastUpdator = request.session.user._id;
				data._lastUpdatorEmail = request.session.user.email;
			}

			/* Send to the database */
			try {
				return this.formatResponse(await this.db.modify(request.collection, conditions, data));
			} catch (error) {
				return new Response(this.app, request, response, new SaplingError(error));
			}
		}
		/* If we're creating a new record */

		/* Add in the user metadata */
		if (request.session && request.session.user) {
			data._creator = request.session.user._id;
			data._creatorEmail = request.session.user.email;
		}

		data._created = Date.now();

		/* Send to the database */
		try {
			return this.formatResponse(await this.db.write(request.collection, data));
		} catch (error) {
			return new Response(this.app, request, response, new SaplingError(error));
		}
	}


	/**
	 * Serve an incoming DELETE request to the database
	 *
	 * @param {object} request Request object from Express
	 */
	async delete(request) {
		await this.importDriver();

		/* Prepare the raw request */
		request = this.app.request.parse(request);

		let conditions = {};

		/* Get the user role from session */
		const role = this.app.user.getRole(request);

		/* Parse "where" clause, if any */
		/* If the permission is "owner", check that we are the owner, or an admin */
		conditions = _.extend(conditions, this.app.request.getConstraints(request), this.app.request.getCreatorConstraint(request, role));

		/* Send it to the database */
		return this.formatResponse(await this.db.remove(request.collection, conditions));
	}
}
