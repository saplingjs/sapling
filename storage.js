/**
 * Storage
 * 
 * Middleware between the app and the database driver to do all
 * the higher level heavy lifting with data.
 */


/* Dependencies */
const fs = require("fs");
const path = require("path");
const url = require("url");
const _ = require("underscore");
const moment = require("moment");

const Validation = require("./lib/Validation");
const Cluster = require("./lib/Cluster");


/* Default user structure */
/* Extensible through a model */
const user_structure = {
	email: {type: "String", minlen: 3, unique: true, required: true},
	password: {type: "String", minlen: 3, required: true, access: "owner"},
	_salt: {type: "String", access: "owner"},
	role: {type: "String", values: ["admin", "member"], default: "member", access: {r: "anyone", w: "anyone"}},
	authkey: {type: "String", access: "owner"}
};


/**
 * Take an incoming request and make sense of it
 * 
 * @param {object} req The request object from Express
 */
function parseRequest (req) {
	/* Get the URL segments from the requested URL */
	const query = url.parse(req.url, true);
	const parts = query.pathname.split("/");

	/* Request method */
	const method = req.method && req.method.toUpperCase();

	/* Trim uneeded parts of the request */
	if (parts[0] == '') parts.splice(0, 1);
	if (parts[parts.length - 1] == '') parts.splice(parts.length - 1, 1);
	if (parts[0] == 'api') parts.splice(0, 1);

	/* Name each of the URL segments */
	const collection = parts[0];
	const field = parts[1];
	const value = parts[2];
	let cmd     = parts[3];

	/* Can have a command on collection */
	/* TODO: find out if this is necessary */
	if (parts.length == 2) {
		cmd = field;
	}

	Cluster.console.log("Request", collection, field, value, cmd);

	/* Leave a warning if no permission on a writable request */
	if ((method == "POST" || method == "DELETE") && !req.permission) {
		Cluster.console.warn(`You should add a permission for \`${req.url}\`.`)
	}

	/* Modify the req object */
	_.extend(req, {
		collection,
		field,
		value,
		cmd,
		query: query.query, // Query params
		type: parts.length >= 3 ? "filter" : "all",
		isLogged: !!(req.session && req.session.user)
	});
}

/**
 * The Storage class
 */
class Storage {

	/**
	 * Initialise the Storage class
	 * 
	 * @param {object} opts Options object
	 */
	async init(opts) {
		/* Load the options into the class */
		this.name = opts.name;
		this.schema = opts.schema;
		this.config = opts.config;
		this.dir = opts.dir;
		
		/* Every app with storage needs a users collection */
		if (!this.schema.users) {
			this.schema.users = user_structure;
		} else {
			/* Allow customization of the structure */
			_.defaults(this.schema.users, user_structure);
		}

		const dbConfig = this.config.db;
		dbConfig.name = this.name;
		dbConfig.dataLimit = this.config.dataLimit;

		/* Connect to the database backend with the desired driver */
		this.db = new (require(`./db/${opts.config.db.type}`))(opts);
		await this.db.connect(dbConfig);

		/* Create each collection in the schema in the database */
		for (const collection in this.schema) {
			try {
				await this.db.createCollection(collection, this.schema[collection]);
			} catch (err) {
				Cluster.console.warn(err);
			}
		}

		Cluster.console.log("CREATED DBS");
	}


	/**
	 * Returns an array of fields that should
	 * be omitted from the response due to permissions.
	 * 
	 * @param {string} permission The permission level being checked
	 * @param {string} collection The collection being checked against
	 */
	disallowedFields(permission, collection) {
		/* Get the collection definition */
		const rules = this.schema[collection];
		const omit = [];

		/* Loop every field in the collection */
		for (const key in rules) {
			const rule = rules[key];

			/* Normalise the access rule to be an object with r,w */
			const access = typeof rule.access === "string" ? {
				r: rule.access,
				w: rule.access
			} : rule.access;

			/* Skip if not defined or anyone can view */
			if (!access || access.r === "anyone" || access.r === "owner") continue;

			/* Leave out the fields that the viewer can't access */
			if (this.inheritRole(permission, access.r) === false) {
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
			const access = typeof rule.access === "string" ? {
				r: rule.access
			} : rule.access;

			/* Get the fields that are owner-only */
			if (access && access.r == "owner") {
				fields.push(key)
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
	 * @param {object} req Request object from Express
	 */
	validateData({table, body, session, type}) {
		/* Get the collection definition */
		const rules = this.schema[table];

		let errors = [];
		const data = body || {};
		let permission = null;
		
		/* Get the role from session, if any */
		if (session && session.user) {
			permission = session.user.role;
		}

		/* Model must be defined before pushing data */
		/* TODO: check if this is strict-only */
		if (!rules) {
			return {
				"status": "500",
				"code": "1010",
				"title": "Non-existent",
				"detail": "This model does not exist.",
				"meta": {
					"type": "data",
					"error": "nonexistent"
				}
			};
		}

		/* Go through every key in incoming data */
		for (var key in data) {
			/* Get the corresponding ruleset */
			var rule = rules[key];

			/* If the field isn't defined */
			if (!rule) {
				/* In strict mode, don't allow unknown fields */
				if (this.config.strict) { 
					Cluster.console.warn("UNKNOWN FIELD", key);
					delete data[key]; 
				}

				/* Otherwise skip this field */
				continue;
			}

			const dataType = (rule.type || rule).toLowerCase();

			/* If the data is a number, convert from string */
			if (dataType === "number") {
				data[key] = parseFloat(data[key], 10);
			}

			/* Test in the validation library */
			const error = Validation.test(data[key], key, rule);
			if (error.length) {
				errors = error;
			}
			
			/* If this field has no defined access level, we can skip the rest of the checks */
			if (!rule.access) continue;

			/* Get the write access level */
			const access = rule.access.w || rule.access;

			/* If the field is owner-only, defer to individual op methods to check against it */
			if (access === "owner") continue;

			/* If we do not have access, raise hell */
			if (this.inheritRole(permission, access) === false) {
				Cluster.console.warn(`NO ACCESS TO FIELD '${key}'`);
				Cluster.console.warn("Current permission level:", permission);
				Cluster.console.warn("Required permission level:", access);
				delete data[key];
			}
		}

		/* For insertion, handle required fields and default values */
		if (type === "all") {
			/* Go through every defined field */
			for (var key in rules) {
				/* Get the ruleset for this field */
				var rule = rules[key];

				/* If the value exists, it will have already been validated above */
				if (key in data) continue;
				if (typeof rules[key] !== "object") continue;

				/* We now know the given field does not have a corresponding value
				   in the incoming data */

				/* If required, generate error */
				if (rules[key].required) {
					errors.push({
						"status": "422",
						"code": "1001",
						"title": "Invalid Input",
						"detail": `You must provide a value for key \`${key}\``,
						"meta": {
							"key": key,
							"rule": "required"
						}
					});
				}

				/* Set the data to the default value, if provided */
				if ("default" in rules[key]) {
					data[key] = rules[key]["default"];
				}
			}
		}
		
		Cluster.console.log("ERRORS", errors);

		return errors.length && errors;
	}


	/**
	 * Parse URL segments into "where" clause constraints
	 * 
	 * @param {object} req Request object from Express
	 */
	getConstraints(req) {
		let conditions = [];

		if (req.type == "filter") {
			/* TODO: Find out what this is */
			if (req.cmd) {
				conditions[req.field] = [+req.value, +req.cmd];
			} else {
				/* Split the constraint segments in case we have multiple */
				const multif = req.field.split(",");
				const multiv = req.value.split(",");

				/* Add any and all constraints to the query */
				if(multif.length == multiv.length) {
					for (index = 0; index < multif.length; ++index) {
						conditions[multif[index]] = multiv[index];
					}
				}
			}
		}

		return conditions;
	}


	/**
	 * Serve an incoming GET request from the database
	 * 
	 * @param {object} req Request object from Express
	 */
	async get(req) {
		/* Prepare the raw request */
		parseRequest(req);

		/* Get the collection definition */
		const rules = this.schema[req.table];
		let options = {};
		const conditions = {};

		/* Get the user role from session */
		let role = null;
		if (req.session && req.session.user) {
			role = req.session.user.role;
		}

		/* Check if we're logged in */
		if (req.permission && req.permission != "anyone" && req.permission != "stranger" && (!req.session || !req.session.user)) {
			return {
				"status": "401",
				"code": "4002",
				"title": "Unauthorized",
				"detail": "You must log in before completing this action.",
				"meta": {
					"type": "login",
					"error": "unauthorized"
				}
			};
		}

		/* If the permission is "owner", check that we are the owner, or an admin */
		if (req.permission === "owner" && role !== "admin") {
			conditions['_creator'] = req.session.user._id;
		}

		/* Parse limit options */
		if (req.query.limit) {
			const limit = req.query.limit.split(",");
			options.limit = +limit[1] || +limit[0];
			if (limit.length == 2) { options.skip = +limit[0]; }
		}

		/* Parse sorting option */
		if (req.query.sort) {
			const sort = req.query.sort.split(",");
			const sorter = sort[1] === "desc" ? -1 : 1;
			options.sort = [[sort[0], sorter]];
		}

		/* Values in array */
		if (req.cmd && req.type === "all") {
			if (!req.body || !Object.keys(req.body).length) { return "Body empty"; }
			options = {"in": req.body};
		}

		/* Parse "where" clause, if any */
		conditions = _.extend(conditions, this.getConstraints(req));

		/* If we have reference fields */
		const references = [];
		Object.keys(rules).forEach(field => {
			const rule = rules[field];
			if(typeof rule !== "string") {
				if(rule.type.toLowerCase() === "reference") {
					references.push({
						from: rule.in,
						localField: rule.by || field,
						foreignField: rule.to,
						as: `${field}_data`
					});
				}
			}
		});

		Cluster.console.log(req.table, conditions, options);

		/* Get it from the database */
		await this.db.read(req.table, conditions, options, references).then((err, arr) => {
			if (err) {
				return err;
			}

			/* Get the list of fields we should not be able to see */
			const omit = this.disallowedFields(role, req.table);
	
			/* Get the list of fields that only owners can see */
			const ownerFields = this.ownerFields(req.table);
			
			/* Process fields against both lists */
			for (let i = 0; i < arr.length; ++i) {
				/* Omit fields from the disallowedFields */
				arr[i] = _.omit(arr[i], omit);

				/* Check for ownership */
				const owner = arr[i]._creator || arr[i]._id;
				
				if (role != 'admin' && (!req.isLogged || owner != req.session.user._id)) {
					for (let j = 0; j < ownerFields.length; ++j) {
						delete arr[i][ownerFields[j]];
					}
				}
			}

			/* If we only have a single result, return it bare */
			/* Otherwise, an array */
			if (req.query.single) {
				return arr[0];
			} else {
				return arr;
			}
		});
	}


	/**
	 * Serve an incoming POST request to the database
	 * 
	 * @param {object} req Request object from Express
	 */
	async post(req) {
		/* Prepare the raw request */
		parseRequest(req);

		/* Check if we're logged in */
		if (req.permission && req.permission != "anyone" && req.permission != "stranger" && !req.session.user) {
			return {
				"status": "401",
				"code": "4002",
				"title": "Unauthorized",
				"detail": "You must log in before completing this action.",
				"meta": {
					"type": "login",
					"error": "unauthorized"
				}
			};
		}

		/* Get the collection definition */
		const rules = this.schema[req.table];

		const conditions = {};
		const data = req.body;

		// special case, unfortunately :\
		if (req.cmd == "in") {
			return await this.get(req);
		}

		/* Validate the updated data */
		const errors = this.validateData(req);
		if (errors) {
			return errors;
		}

		/* Get the user role from session */
		let role = null;
		if (req.session && req.session.user) {
			role = req.session.user.role;
		}

		/* If the permission is "owner", check that we are the owner, or an admin */
		if (req.permission === "owner" && role !== "admin") {
			conditions['_creator'] = req.session.user._id;
		}

		/* Specially format certain fields */
		Object.keys(rules).forEach(field => {
			const rule = rules[field];
			const type = (rule.type || rule).toLowerCase();

			/* Format reference fields */
			if(type === "reference" || type === "id") {
				if(conditions["references"])
					conditions["references"].push(field);
				else
					conditions["references"] = [field];
			}

			/* Format date fields */
			if(type === "date") {
				if(data[field])
					data[field] = Number(moment(data[field]).format("x"));
			}

			/* Format boolean fields */
			if(type === "boolean") {
				if(data[field])
					data[field] = Boolean(data[field]);
			}
		});

		/* If we're updating an existing record */
		if (req.type == "filter") {
			/* Parse "where" clause, if any */
			conditions = _.extend(conditions, this.getConstraints(req));

			/* Update hidden fields */
			data['_lastUpdated'] = Date.now();
			if (req.session && req.session.user) {
				data['_lastUpdator'] = req.session.user._id;
				data['_lastUpdatorEmail'] = req.session.user.email;
			}

			/* Send to the database */
			await this.db.modify(req.table, conditions, data);

		} else {
			/* If we're creating a new record */

			/* Add in the user metadata */
			if (req.session && req.session.user) {
				data['_creator'] = req.session.user._id;
				data['_creatorEmail'] = req.session.user.email;
			}
			data['_created'] = Date.now();

			/* Send to the database */
			await this.db.write(req.table, conditions, data);
		}
	}


	/**
	 * Serve an incoming DELETE request to the database
	 * 
	 * @param {object} req Request object from Express
	 */
	async delete(req) {
		/* Prepare the raw request */
		parseRequest(req);

		const conditions = {};

		/* Get the user role from session */
		let role = null;
		if (req.session && req.session.user) {
			role = req.session.user.role;
		}
		
		/* If the permission is "owner", check that we are the owner, or an admin */
		if (req.permission === "owner" && role !== "admin") {
			conditions["_creator"] = req.session.user._id;
		}

		/* Parse "where" clause, if any */
		conditions = _.extend(conditions, this.getConstraints(req));

		/* Send it to the database */
		return await this.db.remove(req.table, conditions);
	}
}


module.exports = Storage;
