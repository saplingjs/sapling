import test from 'ava';
import path from 'path';
import _ from 'underscore';
import { fileURLToPath } from 'url';

import Request from '../../lib/Request.js';
import Response from '../../lib/Response.js';
import SaplingError from '../../lib/SaplingError.js';
import Storage from '../../lib/Storage.js';
import UnauthorizedError from '../../lib/UnauthorizedError.js';
import User from '../../lib/User.js';
import parseMethodRouteKey from '../../core/parseMethodRouteKey.js';

import loadPermissions from '../../core/loadPermissions.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();
	t.context.app.dir = path.join(__dirname, '../_data/permissions');
	t.context.app.config.permissions = 'string.json';

	t.context.app.parseMethodRouteKey = parseMethodRouteKey;

	t.context.app.user = new User(t.context.app);
	t.context.app.request = new Request(t.context.app);

	t.context.app.name = 'test';
	t.context.app.storage = new Storage(t.context.app);
	await t.context.app.storage.importDriver();

	t.context.request = (await import('../_utils/request.js')).default();
	t.context.response = (await import('../_utils/response.js')).default();
});


test.serial('loads permissions by string', async t => {
	t.context.app.config.permissions = 'string.json';

	await loadPermissions.call(t.context.app);

	t.deepEqual(t.context.app.permissions, {
		'get /my-account': {
			redirect: false,
			role: [
				'member'
			]
		}
	});
});

test.serial('loads permissions by array', async t => {
	t.context.app.config.permissions = 'array.json';

	await loadPermissions.call(t.context.app);

	t.deepEqual(t.context.app.permissions, {
		'get /my-account': {
			redirect: false,
			role: [
				'member',
				'moderator'
			]
		}
	});
});

test.serial('loads permissions by object', async t => {
	t.context.app.config.permissions = 'object.json';

	await loadPermissions.call(t.context.app);

	t.deepEqual(t.context.app.permissions, {
		'get /my-account': {
			redirect: '/login',
			role: [
				'member'
			]
		},
		'post /data/posts': {
			redirect: '/login',
			role: [
				'member',
				'moderator'
			]
		}
	});
});

test.serial('creates middleware', async t => {
	t.plan(7);

	t.context.app.config.permissions = 'methods.json';

	t.context.app.server = {
		/* Creates get middleware that responds with an error when unauthorised */
		get: (route, handler) => {
			t.is(route, '/my-account');

			const response = handler.call(t.context.app, t.context.request, t.context.response, () => true);

			t.true(response instanceof Response);
			t.true(response.error instanceof UnauthorizedError);
		},

		/* Creates post middleware that allows it continue when authorised */
		post: (route, handler) => {
			t.is(route, '/data/users');

			handler.call(t.context.app, _.extend(t.context.request, {
				session: {
					user: {
						role: "admin"
					}
				}
			}), t.context.response, () => {
				t.pass();
			});
		},

		/* Creates delete middleware that redirects */
		delete: (route, handler) => {
			t.is(route, '/data/users');

			handler.call(t.context.app, _.extend(t.context.request, {
				session: {
					user: {
						role: "member"
					}
				}
			}), _.extend(t.context.response, {
				redirect: destination => {
					t.is(destination, '/');
				}
			}), () => true);
		}
	};

	await loadPermissions.call(t.context.app);
});


test.serial('warns with non-existent permissions file', async t => {
	t.plan(1);

	t.context.app.config.permissions = 'nonexistent.json';

	process.env.NODE_ENV = 'production';
	console.log = () => true;

	console.warn = (workerId, message) => {
		const permissionsPath = path.join(t.context.app.dir, t.context.app.config.permissions);
		t.is(message, `Permissions at path: ${permissionsPath} not found.`);
	};

	await loadPermissions.call(t.context.app);
});

test.serial('throws an error loading permissions with an undefined method', async t => {
	t.context.app.config.permissions = 'undefinedMethod.json';

	await t.throwsAsync(async () => {
		await loadPermissions.call(t.context.app);
	}, {
		instanceOf: SaplingError,
		message: 'Problem parsing \'FOO /my-account\': foo is not a valid method'
	})
});

test.serial('throws an error loading permissions with an invalid definition', async t => {
	t.context.app.config.permissions = 'invalid.json';

	await t.throwsAsync(async () => {
		await loadPermissions.call(t.context.app);
	}, {
		instanceOf: SaplingError,
		message: 'Permission setting for GET /my-account is malformed'
	})
});

test.serial('throws an error loading permissions with an invalid object role definition', async t => {
	t.context.app.config.permissions = 'invalidObject.json';

	await t.throwsAsync(async () => {
		await loadPermissions.call(t.context.app);
	}, {
		instanceOf: SaplingError,
		message: 'Permission setting for GET /my-account is malformed'
	})
});

test.serial('throws an error loading permissions with an missing object role definition', async t => {
	t.context.app.config.permissions = 'incompleteObject.json';

	await t.throwsAsync(async () => {
		await loadPermissions.call(t.context.app);
	}, {
		instanceOf: SaplingError,
		message: 'Permission setting for GET /my-account is missing a role'
	})
});

test('executes callback', async t => {
	t.plan(1);

	return new Promise((resolve) => {
		loadPermissions.call(t.context.app, () => {
			t.pass();
			resolve();
		});
	});
});


test.after.always(t => {
	process.env.NODE_ENV = 'test';
});
