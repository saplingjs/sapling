/**
 * User
 * 
 * Built-in user account functionality
 */

'use strict';

module.exports = class User {

	/**
	 * Initialise the User class
	 * 
	 * @param {object} App The App instance
	 */
	constructor(App) {
		this.app = App;
	}


	/**
	 * Check if the given user is permitted carry out a specific action
	 * for the given permission level
	 * 
	 * @param {string} permission The role level required for a given action
	 * @param {object} user The user object
	 */
	isUserAllowed(permission, user) {
		/* Ensure array */
		if(typeof permission === 'string') {
			permission = [ permission ];
		}

		/* Stranger must NOT be logged in */
		if (permission.includes('stranger')) {
			if (user) {
				return false;
			}
		}
		
		/* "member" or "owner" must be logged in */
		/* "owner" is handled further in the process */
		else if (permission.includes('member') || permission.includes('owner')) {
			if (!user) {
				return false;
			}
		}

		/* Remove any restriction from "anyone" routes */
		else if (permission.includes("anyone")) {
			return true;
		}

		/* Handle custom roles */
		else {
			const role = user && user.role || "stranger";
			return this.app.storage.inheritRole(role, permission);
		}

		/* Default to allowed */
		return true;
	}


	/**
	 * Check if the given user is logged in for routes
	 * that require logging in.
	 * 
	 * @param {object} req The request object from Express
	 */
	isUserAuthenticatedForRoute(req) {
		if (req.permission && !req.permission.role.includes("anyone") && !req.permission.role.includes("stranger") && (!req.session || !req.session.user)) {
			new Response(this.app, req, res, new SaplingError({
				"status": "401",
				"code": "4002",
				"title": "Unauthorized",
				"detail": "You must log in before completing this action.",
				"meta": {
					"type": "login",
					"error": "unauthorized"
				}
			}));
			return false;
		}
		return true;
	}

	
	/**
	 * Get the defined permission role for a given method and route
	 * 
	 * @param {string} method One of "get", "post" or "delete"
	 * @param {string} url The route being tested
	 */
	getRolesForRoute(method, url) {
		const routes = this.app.routeStack[method];
		
		/* Go through all the routes */
		for (let i = 0; i < routes.length; ++i) {
			/* If the given route matches the url */
			/* TODO: Check how fragile this is for things like trailing slashes */
			if (routes[i] == url) {
				/* Find the given permission rule in the loaded permissionset */
				const permissionKey = `${method.toUpperCase()} ${routes[i]}`;
				const userType = this.app.permissions[permissionKey].role;

				/* Return the first match */
				if (userType) {
					return [ userType ];
				}
			}
		}

		/* Default to anyone */
		return [ "anyone" ];
	}
};
