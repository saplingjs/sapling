/**
 * Load permissions
 */


/* Dependencies */
const fs = require("fs");
const path = require("path");

const { console } = require("../lib/Cluster");
const SaplingError = require("../lib/SaplingError");


/**
 * Load the permissions file, and implement the middleware
 * to validate the permission before continuing to the
 * route handler.
 * 
 * @param {function} next Chain callback
 */
module.exports = async function loadPermissions(next) {
	/* Load the permissions file */
	const permissionsPath = path.join(this.dir, "permissions.json");
	this.permissions = {};
	let perms = {};

	try {
		perms = JSON.parse(fs.readFileSync(permissionsPath));
	} catch (e) {
		console.warn(`Permissions at path: ${permissionsPath} not found.`);
	}

	/* Loop over the urls in permissions */
	Object.keys(perms).forEach(url => {
		/* Format expected: "GET /url/here" */
		let { method, route } = this.parseMethodRouteKey(url);

		if(!route)
			return false;

		/* The minimum role level required for this method+route combination */
		let perm = perms[url];

		if(typeof perms[url] === 'string') {
			/* If it's a string, convert it to object */
			perm = { role: [ perms[url] ], redirect: false };

		} else if(Array.isArray(perms[url])) {
			/* If it's an array, convert it to object */
			perm = { role: perms[url], redirect: false };

		} else if(typeof perms[url] === 'object' && perms[url] !== null) {
			/* If it's an object, ensure it's proper */
			if(!('role' in perms[url])) {
				throw new SaplingError(`Permission setting for ${url} is missing a role`);
			}
			if(!(typeof perms[url].role === 'string' || Array.isArray(perms[url].role))) {
				throw new SaplingError(`Permission setting for ${url} is malformed`);
			}
			if(typeof perms[url].role === 'string') {
				perm = { role: [ perms[url].role ], redirect: perms[url].redirect };
			}

		} else {
			/* If it's something else, we don't want it */
			throw new SaplingError(`Permission setting for ${url} is malformed`);
		}

		/* Save to object */
		this.permissions[url] = perm;
		
		/* Default method is `all`. */
		if (!["get", "post", "delete"].includes(method)) {
			method = "all";
		}

		/* Create middleware for each particular method+route combination */
		this.server[method](route, (req, res, next) => {
			console.log("PERMISSION", method, route, perm);

			/* Save for later */
			req.permission = perm;

			/* If the current route is not allowed for the current user, display an error */
			if (!this.user.isUserAllowed(req.permission.role, req.session.user)) {
				if(req.permission.redirect) {
					res.redirect(req.permission.redirect);
				} else {
					new Response(this, req, res, new SaplingError("You do not have permission to complete this action."));
				}
			} else next();
		});
		
	});

	if(next) next();
};