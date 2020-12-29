/**
 * Storage
 *
 * Middleware between the app and the database driver to do all
 * the higher level heavy lifting with data.
 */


/* Dependencies */
const path = require('path');
const url = require('url');
const _ = require('underscore');
const moment = require('moment');

const filenamify = require('filenamify');
const unusedFilename = require('unused-filename');
const imageSize = require('image-size');

const { console } = require('./Cluster');
const SaplingError = require('./SaplingError');
const Response = require('./Response');
const Validation = require('./Validation');


/* Default user structure */
/* Extensible through a users model */
const user_structure = {
	email: { type: 'String', minlen: 3, unique: true, required: true, identifiable: true },
	password: { type: 'String', minlen: 3, required: true, access: 'owner' },
	_salt: { type: 'String', access: 'owner' },
	role: { type: 'String', values: ['admin', 'member'], default: 'member', access: { r: 'anyone', w: 'admin' } },
	_authkey: { type: 'String', access: 'owner' }
};


/* File uploads structure */
const uploads_structure = {
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


/* File categories */
const upload_types = {
	archive: ['application/zip', 'application/gzip', 'application/x-7z-compressed', 'application/x-bzip', 'application/x-bzip2', 'application/vnd.rar', 'application/x-tar'],
	image: ['image/png', 'image/jpeg', 'image/webp'],
	video: ['video/ogg', 'video/mp4', 'video/H264', 'video/mpeg', 'video/webm'],
	audio: ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/aac'],
	document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
	font: ['font/ttf', 'font/otf', 'font/woff', 'font/woff2']
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
		if (!this.schema.users) {
			this.schema.users = user_structure;
		} else {
			/* Allow customization of the structure */
			_.defaults(this.schema.users, user_structure);
		}

		/* Every app also needs an uploads collection */
		/* Cold override as this cannot be customised by a model */
		this.schema.uploads = uploads_structure;

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
		const query = url.parse(request.url, true);
		const parts = query.pathname.split('/');

		/* Request method */
		const method = request.method && request.method.toUpperCase();

		/* Trim uneeded parts of the request */
		if (parts[0] == '') {
			parts.splice(0, 1);
		}

		if (parts[parts.length - 1] == '') {
			parts.splice(-1, 1);
		}

		if (parts[0] == 'data') {
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
		if ((method == 'POST' || method == 'DELETE') && !request.permission) {
			console.warn(`You should add a permission for \`${request.url}\`.`);
		}

		/* Modify the request object */
		return _.extend(request, {
			collection,
			fields,
			values,
			query: query.query, // Query params
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

		if (driver == 'memory') {
			this.db = new (require('../drivers/db/Memory'))(options);
		} else {
			this.db = new (require(`@sapling/db-driver-${driver}`))(options);
		}

		await this.db.connect(dbConfig);

		/* Create each collection in the schema in the database */
		for (const collection in this.schema) {
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
			const rule = rules[key];

			/* Normalise the access rule to be an object with r */
			const access = typeof rule.access === 'string' ? {
				r: rule.access
			} : rule.access;

			/* Get the fields that are owner-only */
			if (access && access.r == 'owner') {
				fields.push(key);
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
		if (test == 'admin' || role == 'anyone') {
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
	 */
	validateData({ collection, body, session, type }) {
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
		for (var key in data) {
			/* Get the corresponding ruleset */
			var rule = rules[key];

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
			if (error.length) {
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

		/* For insertion, handle required fields and default values */
		if (type === 'all') {
			/* Go through every defined field */
			for (var key in rules) {
				/* Get the ruleset for this field */
				var rule = rules[key];

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

		return errors.length && errors;
	}


	/**
	 * Parse URL segments into "where" clause constraints
	 *
	 * @param {object} request Request object from Express
	 */
	getConstraints(request) {
		const conditions = {};

		if (request.type == 'filter') {
			/* Add any and all constraints to the query */
			if (request.fields.length == request.values.length) {
				for (let index = 0; index < request.fields.length; ++index) {
					let values = request.values[index].split(',');
					if (values.length == 1) {
						values = values[0];
					}

					conditions[request.fields[index]] = values;
				}
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
		this.app.user.isUserAuthenticatedForRoute(request);

		/* Parse limit options */
		if (request.query.limit) {
			const limit = request.query.limit.split(',');
			options.limit = Number(limit[1]) || Number(limit[0]);
			if (limit.length == 2) {
				options.skip = Number(limit[0]);
			}
		}

		/* Parse sorting option */
		if (request.query.sort) {
			const sort = request.query.sort.split(',');
			const sorter = sort[1] === 'desc' ? -1 : 1;
			options.sort = [[sort[0], sorter]];
		}

		/* Parse "where" clause, if any */
		/* If the permission is "owner", check that we are the owner, or an admin */
		conditions = _.extend(conditions, this.getConstraints(request), this.getCreatorConstraint(request, role));

		/* If we have reference fields */
		const references = [];
		Object.keys(rules).forEach(field => {
			const rule = rules[field];
			if (typeof rule !== 'string') {
				if (rule.type.toLowerCase() === 'reference') {
					references.push({
						from: rule.in,
						localField: rule.by || field,
						foreignField: rule.to,
						as: `${field}_data`
					});
				}
			}
		});

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

				if (role != 'admin' && (!request.isLogged || owner != request.session.user._id)) {
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
		this.app.user.isUserAuthenticatedForRoute(request);

		/* Get the collection definition */
		const rules = this.schema[request.collection] || {};

		let conditions = {};
		const data = request.body;

		/* Validate the updated data */
		const errors = this.validateData(request);
		if (errors) {
			new Response(this.app, request, response, new SaplingError(errors));
			return false;
		}

		/* Get the user role from session */
		const role = this.getRole(request);

		/* Specially format certain fields */
		Object.keys(rules).forEach(field => {
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

			/* Format date fields */
			if (type === 'date') {
				if (data[field]) {
					data[field] = Number(moment(data[field]).format('x'));
				}
			}

			/* Format boolean fields */
			if (type === 'boolean') {
				if (data[field]) {
					data[field] = Boolean(data[field]);
				}
			}
		});

		/* Deal with file uploads */
		if (request.files) {
			for (const fileField of Object.keys(request.files)) {
				/* Either it's defined in a model or we don't care */
				if ((fileField in Object.keys(rules) && rules[fileField].type === 'file') || !this.config.strict) {
					const file = request.files[fileField];
					const rule = rules[fileField];
					const validator = new Validation();

					/* Make sure the filename is valid and available */
					const filePath = await unusedFilename(path.join(this.app.uploadDir, filenamify(file.name)));
					const fileExtension = file.name.split('.').slice(-1)[0];

					/* Figure out file type */
					let fileGroup = 'other';
					for (const type of Object.keys(upload_types)) {
						if (upload_types[type].includes(file.mimetype)) {
							fileGroup = type;
						}
					}

					/* Special case for some archives */
					if ((fileExtension == 'zip' || fileExtension == 'rar') && file.mimetype == 'application/octet-stream') {
						fileGroup = 'archive';
					}

					/* If we have a model */
					if (rule) {
						/* Ensure the file matches the given filetype (mime, group or ext) */
						validator.validateFileType(file, fileField, rule);

						/* Ensure it's not too large */
						validator.validateFileMaxsize(file, fileField, rule);
					}

					/* Create file meta */
					const fileObject = {
						url: path.join('/', path.relative(this.dir, filePath)),
						filesize: file.size,
						type: fileGroup,
						extension: fileExtension,
						mimetype: file.mimetype
					};

					/* If it's an image, get the width and height */
					if (fileGroup == 'image') {
						const dimensions = await imageSize(file.tempFilePath);
						fileObject.width = dimensions.width;
						fileObject.height = dimensions.height;

						/* Validate dimensions */
						if (rule) {
							validator.validateFileMinwidth(dimensions, fileField, rule);
							validator.validateFileMaxwidth(dimensions, fileField, rule);
							validator.validateFileMinheight(dimensions, fileField, rule);
							validator.validateFileMinheight(dimensions, fileField, rule);
						}

						/* TODO: Create thumbnail */
					}

					/* If there are any errors, give up */
					if (validator.errors.length > 0) {
						new Response(this.app, request, response, new SaplingError(validator.errors));
						return false;
					}

					/* Move to storage */
					/* TODO: Expose for AWS plugins etc */
					await file.mv(filePath);

					data[fileField] = fileObject;
				}
			}
		}

		/* If we're updating an existing record */
		if (request.type == 'filter') {
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
	 * @param {object} response Response object from Express
	 */
	async delete(request, response) {
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
