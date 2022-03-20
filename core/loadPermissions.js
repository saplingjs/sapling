/**
 * Load permissions
 */

/* Dependencies */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { console } from '../lib/Cluster.js';
import Response from '../lib/Response.js';
import SaplingError from '../lib/SaplingError.js';


/**
 * Digest and validate permission files and apply some formatting
 *
 * @returns {object} Permissions
 */
export async function digest() {
	/* Load the permissions file */
	const permissionsPath = path.join(this.dir, this.config.permissions);
	const formattedPerms = {};
	let loadedPerms = {};

	try {
		loadedPerms = JSON.parse(await fs.readFile(permissionsPath));
	} catch {
		console.warn(`Permissions at path: ${permissionsPath} not found.`);
	}

	/* Loop over the urls in permissions */
	for (const url of Object.keys(loadedPerms)) {
		/* Format expected: "GET /url/here" */
		const { method, route } = this.parseMethodRouteKey(url);

		/* The minimum role level required for this method+route combination */
		let perm = loadedPerms[url];

		if (typeof loadedPerms[url] === 'string') {
			/* If it's a string, convert it to object */
			perm = { role: [loadedPerms[url]], redirect: false };
		} else if (Array.isArray(loadedPerms[url])) {
			/* If it's an array, convert it to object */
			perm = { role: loadedPerms[url], redirect: false };
		} else if (typeof loadedPerms[url] === 'object' && loadedPerms[url] !== null) {
			/* If it's an object, ensure it's proper */
			if (!('role' in loadedPerms[url])) {
				throw new SaplingError(`Permission setting for ${url} is missing a role`);
			}

			if (!(typeof loadedPerms[url].role === 'string' || Array.isArray(loadedPerms[url].role))) {
				throw new SaplingError(`Permission setting for ${url} is malformed`);
			}

			if (typeof loadedPerms[url].role === 'string') {
				perm = { role: [loadedPerms[url].role], redirect: loadedPerms[url].redirect };
			}
		} else {
			/* If it's something else, we don't want it */
			throw new SaplingError(`Permission setting for ${url} is malformed`);
		}

		/* Save to object */
		formattedPerms[`${method} ${route}`] = perm;
	}

	return formattedPerms;
}


/**
 * Load the permissions file, and implement the middleware
 * to validate the permission before continuing to the
 * route handler.
 *
 * @param {function} next Chain callback
 */
export default async function loadPermissions(next) {
	/* Digest permissions */
	this.permissions = await digest.call(this);

	/* Loop over the urls in permissions */
	for (const url of Object.keys(this.permissions)) {
		/* Format expected: "GET /url/here" */
		const { method, route } = this.parseMethodRouteKey(url);

		/* Create middleware for each particular method+route combination */
		this.server[method](route, (request, response, next) => {
			console.log('PERMISSION', method, route, this.permissions[url]);

			/* Save for later */
			request.permission = this.permissions[url];

			/* If the current route is not allowed for the current user, display an error */
			if (this.user.isUserAllowed(request.permission.role, request.session.user) === false) {
				if (request.permission.redirect) {
					response.redirect(request.permission.redirect);
				} else {
					return new Response(this, request, response, new SaplingError('You do not have permission to complete this action.'));
				}
			} else {
				next();
			}
		});
	}

	if (next) {
		next();
	}
}
