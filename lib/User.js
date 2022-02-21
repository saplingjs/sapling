/**
 * User
 *
 * Built-in user account and permissions functionality
 */

/* Dependencies */
import routeMatcher from 'path-match';

import Response from './Response.js';
import SaplingError from './SaplingError.js';
import Utils from './Utils.js';


/**
 * The User class
 */
export default class User {
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
			const role = (user && user.role) ? user.role : 'stranger';
			return this.isRoleAllowed(role, permission);
		}

		/* Default to allowed */
		return true;
	}


	/**
	 * Check if a given role equals or supersedes the required role.
	 *
	 * @param {string} test The role being tested
	 * @param {any} role String or array of strings of access level being tested against
	 * @returns {boolean} true if "test" is a higher or equal level role as "role"; false if it is lesser
	 */
	isRoleAllowed(test, roles) {
		/* Ensure array */
		if (typeof roles === 'string') {
			roles = [roles];
		}

		const rules = this.app.storage.getRules('users');

		return roles.some(role => {
			/* Get the indices of both comparison targets */
			const roleIndex = rules.role.values.indexOf(role);
			const testIndex = rules.role.values.indexOf(test);

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
		});
	}


	/**
	 * Check if the given user is logged in for routes
	 * that require logging in.
	 *
	 * @param {object} request The request object from Express
	 * @param {object} response The response object from Express
	 */
	isUserAuthenticatedForRoute(request, response) {
		if (
			request.permission && !request.permission.role.includes('anyone')
			&& ((request.permission.role.includes('stranger') && 'user' in request.session)
			|| (!request.permission.role.includes('stranger') && !('user' in request.session)))
		) {
			new Response(this.app, request, response, new SaplingError({
				status: '401',
				code: '4002',
				title: 'Unauthorized',
				detail: 'You are not authorized to access this resource.',
				meta: {
					type: 'login',
					error: 'unauthorized',
				},
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
		const lowerMethod = String(method).toLowerCase();
		const routes = this.app.routeStack[lowerMethod] || [];

		/* Go through all the routes */
		for (const route of routes) {
			/* If the given route matches the url */
			if (routeMatcher()(route)(url) !== false) {
				/* Find the given permission rule in the loaded permissionset */
				const permissionKey = `${lowerMethod} ${route}`.toLowerCase();
				const userType = permissionKey in this.app.permissions ? this.app.permissions[permissionKey].role : 'anyone';

				/* Return the first match */
				return new Utils().coerceArray(userType);
			}
		}

		/* Default to anyone */
		return ['anyone'];
	}


	/**
	 * Get the user role from the session
	 *
	 * @param {object} request Request object from Express
	 * @returns {string/null} Role as string, or null if not logged in
	 */
	getRole(request) {
		if (request.session && request.session.user) {
			return request.session.user.role;
		}

		return null;
	}


	/**
	 * Returns an array of fields that should
	 * be omitted from the response due to permissions.
	 *
	 * @param {string} role The role being checked
	 * @param {string} rules The rules of the collection being checked against
	 */
	disallowedFields(role, rules) {
		const omit = [];

		/* Loop every field in the collection */
		for (const key in rules) {
			if (Object.prototype.hasOwnProperty.call(rules, key)) {
				const rule = rules[key];

				/* Normalise the access rule to be an object with r,w */
				const access = typeof rule.access === 'string' ? {
					r: rule.access,
					w: rule.access,
				} : rule.access;

				/* Skip if not defined or anyone can view */
				if (!access || access.r === 'anyone' || access.r === 'owner') {
					continue;
				}

				/* Leave out the fields that the viewer can't access */
				if (this.isRoleAllowed(role, access.r) === false) {
					omit.push(key);
				}
			}
		}

		return omit;
	}


	/**
	 * Get a list of fields in a given model that only "owner"
	 * level users are allowed to see.
	 *
	 * @param {string} rules The model being checked
	 */
	ownerFields(rules) {
		const fields = [];

		/* Loop every field in the collection */
		for (const key in rules) {
			if (Object.prototype.hasOwnProperty.call(rules, key)) {
				const rule = rules[key];

				/* Normalise the access rule to be an object with r */
				const access = typeof rule.access === 'string' ? {
					r: rule.access,
				} : rule.access;

				/* Get the fields that are owner-only */
				if (access && access.r === 'owner') {
					fields.push(key);
				}
			}
		}

		return fields;
	}
}
