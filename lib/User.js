/**
 * User
 *
 * Built-in user account functionality
 */

'use strict';

/* Dependencies */
const Response = require('./Response');
const SaplingError = require('./SaplingError');


/**
 * The User class
 */
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
		if (typeof permission === 'string') {
			permission = [permission];
		}

		/* Stranger must NOT be logged in */
		if (permission.includes('stranger')) {
			if (user) {
				return false;
			}
		} else if (permission.includes('member') || permission.includes('owner')) {
			/* "member" or "owner" must be logged in */
			/* "owner" is handled further in the process */
			if (!user) {
				return false;
			}
		} else if (permission.includes('anyone')) {
			/* Remove any restriction from "anyone" routes */
			return true;
		} else {
			/* Handle custom roles */
			const role = 'role' in user ? user.role : 'stranger';
			return this.app.storage.inheritRole(role, permission);
		}

		/* Default to allowed */
		return true;
	}


	/**
	 * Check if the given user is logged in for routes
	 * that require logging in.
	 *
	 * @param {object} request The request object from Express
	 * @param {object} response The response object from Express
	 */
	isUserAuthenticatedForRoute(request, response) {
		if (request.permission && !request.permission.role.includes('anyone') && !request.permission.role.includes('stranger') && (!request.session || !request.session.user)) {
			new Response(this.app, request, response, new SaplingError({
				status: '401',
				code: '4002',
				title: 'Unauthorized',
				detail: 'You must log in before completing this action.',
				meta: {
					type: 'login',
					error: 'unauthorized'
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
		for (const route of routes) {
			/* If the given route matches the url */
			/* TODO: Check how fragile this is for things like trailing slashes */
			if (route === url) {
				/* Find the given permission rule in the loaded permissionset */
				const permissionKey = `${method.toUpperCase()} ${route}`;
				const userType = this.app.permissions[permissionKey].role;

				/* Return the first match */
				if (userType) {
					return [userType];
				}
			}
		}

		/* Default to anyone */
		return ['anyone'];
	}
};
